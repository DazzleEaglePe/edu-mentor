import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { RoleKey } from '../../generated/prisma/enums.js';
import { AuthorizationPolicy } from '../auth/authorization-policy.js';
import type { AdminUser, AdminUserPage } from './admin-user.js';
import { AdminUsersRepository } from './admin-users.repository.js';

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
  ) {}

  list(principal: AuthPrincipal, page: number, limit: number): Promise<AdminUserPage> {
    return this.repository.list(principal.organization.id, page, limit);
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
}
