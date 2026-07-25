import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../../config/runtime-config.js';
import { deriveKey } from './key-derivation.js';

const ACCESS_TOKEN_ISSUER = 'edu-mentor-api';
const ACCESS_TOKEN_AUDIENCE = 'edu-mentor-web';
const ACCESS_TOKEN_TYPE = 'at+jwt';
const ACCESS_TOKEN_ALGORITHM = 'HS256';
const MAX_ACCESS_TOKEN_LENGTH = 4096;

export interface VerifiedAccessToken {
  readonly sessionId: string;
  readonly userId: string;
}

@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;
  private readonly ttlSeconds: number;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.key = deriveKey(config.auth.tokenSecret, 'access-token');
    this.ttlSeconds = config.auth.accessTokenTtlSeconds;
  }

  issue(userId: string, sessionId: string, now = new Date()): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);

    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALGORITHM,
        typ: ACCESS_TOKEN_TYPE,
      })
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .setIssuedAt(issuedAt)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setJti(randomUUID())
      .setSubject(userId)
      .sign(this.key);
  }

  async verify(token: string, now = new Date()): Promise<VerifiedAccessToken | null> {
    if (token.length === 0 || token.length > MAX_ACCESS_TOKEN_LENGTH) {
      return null;
    }

    try {
      const result = await jwtVerify(token, this.key, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        audience: ACCESS_TOKEN_AUDIENCE,
        clockTolerance: 5,
        currentDate: now,
        issuer: ACCESS_TOKEN_ISSUER,
        requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'],
      });

      if (
        result.protectedHeader.typ !== ACCESS_TOKEN_TYPE ||
        typeof result.payload.sub !== 'string' ||
        typeof result.payload.sid !== 'string'
      ) {
        return null;
      }

      return {
        sessionId: result.payload.sid,
        userId: result.payload.sub,
      };
    } catch {
      return null;
    }
  }
}
