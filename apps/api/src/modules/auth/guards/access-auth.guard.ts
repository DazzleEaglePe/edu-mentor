import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_ROUTE } from '../../../common/auth/auth-metadata.js';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import { ACCESS_COOKIE_NAME, parseRequestCookies } from '../../../common/http/cookies.js';
import { ApiError } from '../../../common/http/api-error.js';
import { AuthRepository } from '../auth.repository.js';
import { AccessTokenService } from '../crypto/access-token.service.js';

@Injectable()
export class AccessAuthGuard implements CanActivate {
  constructor(
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parseRequestCookies(request).get(ACCESS_COOKIE_NAME);
    const verified = token === undefined ? null : await this.accessTokens.verify(token);

    if (verified === null) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Debes iniciar sesión.');
    }

    const principal = await this.repository.findActivePrincipal(
      verified.userId,
      verified.sessionId,
    );

    if (principal === null) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Debes iniciar sesión.');
    }

    request.auth = principal;
    return true;
  }
}
