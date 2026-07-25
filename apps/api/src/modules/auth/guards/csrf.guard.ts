import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import { ApiError } from '../../../common/http/api-error.js';
import { CsrfService } from '../security/csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(CsrfService) private readonly csrf: CsrfService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.method !== undefined && SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    if (!(await this.csrf.validate(request))) {
      throw new ApiError(
        403,
        'CSRF_VALIDATION_FAILED',
        'No pudimos validar el origen de la solicitud.',
      );
    }

    return true;
  }
}
