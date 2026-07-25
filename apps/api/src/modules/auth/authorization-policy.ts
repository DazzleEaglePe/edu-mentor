import { Injectable } from '@nestjs/common';
import type { RoleKey } from '../../generated/prisma/enums.js';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';

function hiddenResource(): ApiError {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
}

@Injectable()
export class AuthorizationPolicy {
  assertSameOrganization(principal: AuthPrincipal, organizationId: string): void {
    if (principal.organization.id !== organizationId) {
      throw hiddenResource();
    }
  }

  assertSelfOrRole(
    principal: AuthPrincipal,
    ownerUserId: string,
    allowedRoles: readonly RoleKey[],
  ): void {
    if (
      principal.userId !== ownerUserId &&
      !allowedRoles.some((role) => principal.roles.includes(role))
    ) {
      throw hiddenResource();
    }
  }
}
