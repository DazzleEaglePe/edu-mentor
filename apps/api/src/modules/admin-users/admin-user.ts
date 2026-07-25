import type { RoleKey } from '../../generated/prisma/enums.js';

export interface AdminUser {
  readonly email: string;
  readonly fullName: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly roles: readonly RoleKey[];
  readonly version: number;
}

export interface AdminUserPage {
  readonly data: readonly AdminUser[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface UpdateAdminUserInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly fullName?: string;
  readonly isActive?: boolean;
  readonly organizationId: string;
  readonly roles?: readonly RoleKey[];
  readonly traceId: string;
  readonly userId: string;
}

export type UpdateAdminUserResult =
  | {
      readonly kind: 'updated';
      readonly user: AdminUser;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    };
