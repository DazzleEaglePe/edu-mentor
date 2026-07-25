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

export interface CreateAdminUserInput {
  readonly actorUserId: string;
  readonly email: string;
  readonly expiresAt: Date;
  readonly fullName: string;
  readonly idempotencyKeyHash: string;
  readonly organizationId: string;
  readonly passwordHash: string;
  readonly requestHash: string;
  readonly roles: readonly RoleKey[];
  readonly traceId: string;
}

export type CreateAdminUserResult =
  | {
      readonly kind: 'created' | 'replayed';
      readonly user: AdminUser;
    }
  | {
      readonly kind: 'email_conflict';
    }
  | {
      readonly kind: 'idempotency_key_reused';
    };

export interface ResetAdminUserPasswordInput {
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly passwordHash: string;
  readonly traceId: string;
  readonly userId: string;
}

export type ResetAdminUserPasswordResult =
  | {
      readonly kind: 'reset';
      readonly sessionsRevoked: number;
    }
  | {
      readonly kind: 'not_found';
    };

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
