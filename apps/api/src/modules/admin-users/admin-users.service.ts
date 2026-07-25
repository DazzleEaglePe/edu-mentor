import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { RoleKey } from '../../generated/prisma/enums.js';
import { AuthorizationPolicy } from '../auth/authorization-policy.js';
import { PasswordHasher } from '../auth/crypto/password-hasher.js';
import type { AdminUser, AdminUserPage } from './admin-user.js';
import { AdminUsersRepository } from './admin-users.repository.js';
import { IdempotencyFingerprintService } from './idempotency-fingerprint.service.js';

const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

export interface CreateAdminUserCommand {
  readonly email: string;
  readonly fullName: string;
  readonly idempotencyKey: string | undefined;
  readonly roles: readonly RoleKey[];
  readonly temporaryPassword: string;
  readonly traceId: string;
}

export interface ResetAdminUserPasswordCommand {
  readonly temporaryPassword: string;
  readonly traceId: string;
  readonly userId: string;
}

export interface UpdateAdminUserCommand {
  readonly expectedVersion: number;
  readonly fullName?: string;
  readonly isActive?: boolean;
  readonly roles?: readonly RoleKey[];
  readonly traceId: string;
  readonly userId: string;
}

function hiddenResource(): ApiError {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
}

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(AdminUsersRepository) private readonly repository: AdminUsersRepository,
    @Inject(AuthorizationPolicy) private readonly authorization: AuthorizationPolicy,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(IdempotencyFingerprintService)
    private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  list(principal: AuthPrincipal, page: number, limit: number): Promise<AdminUserPage> {
    return this.repository.list(principal.organization.id, page, limit);
  }

  async create(principal: AuthPrincipal, command: CreateAdminUserCommand): Promise<AdminUser> {
    const idempotencyKey = command.idempotencyKey?.trim();

    if (
      idempotencyKey === undefined ||
      idempotencyKey.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
      idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['Idempotency-Key'],
      });
    }

    const email = command.email.trim().toLowerCase();
    const fullName = command.fullName.trim();

    if (fullName.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['fullName'],
      });
    }

    const roles = [...command.roles].sort();
    const requestHash = this.fingerprints.hashCreateAdminUserRequest({
      email,
      fullName,
      roles,
      temporaryPassword: command.temporaryPassword,
    });
    const passwordHash = await this.passwords.hash(command.temporaryPassword);
    const result = await this.repository.create({
      actorUserId: principal.userId,
      email,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      fullName,
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      organizationId: principal.organization.id,
      passwordHash,
      requestHash,
      roles,
      traceId: command.traceId,
    });

    if (result.kind === 'idempotency_key_reused') {
      throw new ApiError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de idempotencia ya se usó con otros datos.',
      );
    }

    if (result.kind === 'email_conflict') {
      throw new ApiError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'Ya existe un usuario con ese correo en la organización.',
      );
    }

    return result.user;
  }

  async update(principal: AuthPrincipal, command: UpdateAdminUserCommand): Promise<AdminUser> {
    if (
      command.fullName === undefined &&
      command.isActive === undefined &&
      command.roles === undefined
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['fullName', 'isActive', 'roles'],
      });
    }

    const fullName = command.fullName?.trim();

    if (fullName !== undefined && fullName.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['fullName'],
      });
    }

    const targetOrganizationId = await this.repository.findOrganizationId(command.userId);

    if (targetOrganizationId === null) {
      throw hiddenResource();
    }

    this.authorization.assertSameOrganization(principal, targetOrganizationId);
    const result = await this.repository.update({
      actorUserId: principal.userId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      traceId: command.traceId,
      userId: command.userId,
      ...(fullName === undefined ? {} : { fullName }),
      ...(command.isActive === undefined ? {} : { isActive: command.isActive }),
      ...(command.roles === undefined ? {} : { roles: command.roles }),
    });

    if (result.kind === 'not_found') {
      throw hiddenResource();
    }

    if (result.kind === 'conflict') {
      throw new ApiError(
        409,
        'VERSION_CONFLICT',
        'El recurso cambió. Actualiza e inténtalo otra vez.',
        {
          currentVersion: result.currentVersion,
          expectedVersion: command.expectedVersion,
        },
      );
    }

    return result.user;
  }

  async resetPassword(
    principal: AuthPrincipal,
    command: ResetAdminUserPasswordCommand,
  ): Promise<void> {
    const result = await this.repository.resetPassword({
      actorUserId: principal.userId,
      organizationId: principal.organization.id,
      passwordHash: await this.passwords.hash(command.temporaryPassword),
      traceId: command.traceId,
      userId: command.userId,
    });

    if (result.kind === 'not_found') {
      throw hiddenResource();
    }
  }
}
