import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';
import {
  AuthRepository,
  type ChangePasswordInput,
  type CreateSessionInput,
  type RotateSessionInput,
} from './auth.repository.js';
import type { AuthTokens } from './auth-cookie.service.js';
import { AccessTokenService } from './crypto/access-token.service.js';
import { OpaqueTokenService } from './crypto/opaque-token.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { AuthRateLimiter } from './security/auth-rate-limiter.js';

export interface LoginInput {
  readonly email: string;
  readonly ip: string;
  readonly password: string;
  readonly traceId: string;
  readonly userAgent: string | null;
}

export interface LoginResult extends AuthTokens {
  readonly principal: AuthPrincipal;
}

export interface RefreshInput {
  readonly refreshToken: string;
  readonly traceId: string;
  readonly userAgent: string | null;
}

function normalizedEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function invalidCredentials(): ApiError {
  return new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son válidos.');
}

@Injectable()
export class AuthService {
  private readonly refreshTokenTtlMilliseconds: number;

  constructor(
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(OpaqueTokenService) private readonly opaqueTokens: OpaqueTokenService,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(AuthRateLimiter) private readonly rateLimiter: AuthRateLimiter,
    @Inject(RUNTIME_CONFIG) config: RuntimeConfig,
  ) {
    this.refreshTokenTtlMilliseconds = config.auth.refreshTokenTtlSeconds * 1000;
  }

  async login(input: LoginInput, now = new Date()): Promise<LoginResult> {
    const email = normalizedEmail(input.email);

    await this.rateLimiter.consume(input.ip, email);
    const candidate = await this.repository.findLoginCandidate(email);

    if (candidate === null) {
      await this.passwords.consumeEquivalentWork(input.password);
      throw invalidCredentials();
    }

    const validPassword = await this.passwords.verify(input.password, candidate.passwordHash);

    if (!validPassword) {
      throw invalidCredentials();
    }

    const refreshToken = this.opaqueTokens.createRefreshToken();
    const sessionInput: CreateSessionInput = {
      expiresAt: new Date(now.getTime() + this.refreshTokenTtlMilliseconds),
      id: randomUUID(),
      ipHash: this.opaqueTokens.hashIp(input.ip),
      refreshTokenHash: this.opaqueTokens.hashRefreshToken(refreshToken),
      tokenFamilyId: randomUUID(),
      traceId: input.traceId,
      userAgent: input.userAgent,
      userId: candidate.userId,
    };
    const principal = await this.repository.createSession(sessionInput);

    if (principal === null) {
      throw invalidCredentials();
    }

    const accessToken = await this.accessTokens.issue(principal.userId, principal.sessionId, now);
    await this.rateLimiter.resetSuccessfulLogin(input.ip, email);

    return {
      accessToken,
      principal,
      refreshToken,
    };
  }

  async refresh(input: RefreshInput, now = new Date()): Promise<LoginResult> {
    const refreshToken = this.opaqueTokens.createRefreshToken();
    const rotationInput: RotateSessionInput = {
      newExpiresAt: new Date(now.getTime() + this.refreshTokenTtlMilliseconds),
      newRefreshTokenHash: this.opaqueTokens.hashRefreshToken(refreshToken),
      newSessionId: randomUUID(),
      now,
      presentedRefreshTokenHash: this.opaqueTokens.hashRefreshToken(input.refreshToken),
      traceId: input.traceId,
      userAgent: input.userAgent,
    };
    const result = await this.repository.rotateSession(rotationInput);

    if (result.kind === 'invalid') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Debes iniciar sesión.');
    }
    if (result.kind === 'reused') {
      throw new ApiError(
        409,
        'REFRESH_TOKEN_REUSED',
        'La sesión fue revocada por seguridad. Inicia sesión nuevamente.',
      );
    }

    const accessToken = await this.accessTokens.issue(
      result.principal.userId,
      result.principal.sessionId,
      now,
    );

    return {
      accessToken,
      principal: result.principal,
      refreshToken,
    };
  }

  revokeCurrent(principal: AuthPrincipal, traceId: string, now = new Date()): Promise<void> {
    return this.repository.revokeCurrentSession(
      principal.userId,
      principal.sessionId,
      traceId,
      now,
    );
  }

  revokeAll(principal: AuthPrincipal, traceId: string, now = new Date()): Promise<void> {
    return this.repository.revokeAllSessions(principal.userId, traceId, now);
  }

  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
    traceId: string,
    now = new Date(),
  ): Promise<void> {
    const currentHash = await this.repository.getPasswordHash(principal.userId);

    if (currentHash === null || !(await this.passwords.verify(currentPassword, currentHash))) {
      throw new ApiError(422, 'CURRENT_PASSWORD_INVALID', 'La contraseña actual no es válida.');
    }

    if (await this.passwords.verify(newPassword, currentHash)) {
      throw new ApiError(
        422,
        'PASSWORD_REUSE_NOT_ALLOWED',
        'La nueva contraseña debe ser diferente.',
      );
    }

    const change: ChangePasswordInput = {
      currentSessionId: principal.sessionId,
      newPasswordHash: await this.passwords.hash(newPassword),
      now,
      traceId,
      userId: principal.userId,
    };

    await this.repository.changePassword(change);
  }
}
