import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  ALLOW_PASSWORD_CHANGE_REQUIRED,
  IS_PUBLIC_ROUTE,
} from '../../../common/auth/auth-metadata.js';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import { ApiError } from '../../../common/http/api-error.js';

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, targets);
    const isAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED,
      targets,
    );

    if (isPublic === true || isAllowed === true) {
      return true;
    }

    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;

    if (principal?.mustChangePassword === true) {
      throw new ApiError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Debes cambiar tu contraseña temporal antes de continuar.',
      );
    }

    return true;
  }
}
