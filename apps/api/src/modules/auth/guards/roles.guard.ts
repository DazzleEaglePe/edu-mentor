import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleKey } from '../../../generated/prisma/enums.js';

import { IS_PUBLIC_ROUTE, REQUIRED_ROLES } from '../../../common/auth/auth-metadata.js';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import { ApiError } from '../../../common/http/api-error.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, targets);

    if (isPublic === true) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<readonly RoleKey[]>(
      REQUIRED_ROLES,
      targets,
    );

    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;

    if (principal === undefined || !requiredRoles.some((role) => principal.roles.includes(role))) {
      throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
    }

    return true;
  }
}
