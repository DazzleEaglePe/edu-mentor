import type { Prisma } from '../../generated/prisma/client.js';

import type { AdminUser } from './admin-user.js';

export const adminUserInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
} as const satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

export function toAdminUser(user: UserWithRoles): AdminUser {
  return {
    email: user.email,
    fullName: user.fullName,
    id: user.id,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    roles: user.userRoles.map((userRole) => userRole.role.key).sort(),
    version: user.version,
  };
}

export function userSnapshot(user: AdminUser): Prisma.InputJsonValue {
  return {
    fullName: user.fullName,
    isActive: user.isActive,
    roles: [...user.roles],
    version: user.version,
  };
}
