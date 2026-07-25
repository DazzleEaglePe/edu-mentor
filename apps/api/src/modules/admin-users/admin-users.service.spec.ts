import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import { ApiError } from '../../common/http/api-error.js';
import { AuthorizationPolicy } from '../auth/authorization-policy.js';
import type { PasswordHasher } from '../auth/crypto/password-hasher.js';
import type {
  AdminUserPage,
  CreateAdminUserInput,
  CreateAdminUserResult,
  ResetAdminUserPasswordInput,
  ResetAdminUserPasswordResult,
  UpdateAdminUserResult,
} from './admin-user.js';
import type { AdminUsersRepository } from './admin-users.repository.js';
import { AdminUsersService } from './admin-users.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EXTERNAL_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const TARGET_USER_ID = '11111111-1111-4111-8111-111111111111';

const principal: AuthPrincipal = {
  activeEnrollment: null,
  email: 'admin@example.test',
  fullName: 'Admin',
  mentorCapabilities: [],
  mustChangePassword: false,
  organization: {
    id: ORGANIZATION_ID,
    name: 'Organization',
  },
  roles: ['ADMIN'],
  sessionId: '77777777-7777-4777-8777-777777777777',
  userId: ADMIN_USER_ID,
};

const page: AdminUserPage = {
  data: [],
  meta: {
    hasNextPage: false,
    limit: 20,
    page: 1,
    total: 0,
  },
};

interface RepositoryCalls {
  createInput?: CreateAdminUserInput;
  hashedPassword?: string;
  listOrganizationId?: string;
  resetInput?: ResetAdminUserPasswordInput;
  updateCount: number;
}

function createService(options?: {
  readonly createResult?: CreateAdminUserResult;
  readonly organizationId?: string | null;
  readonly resetResult?: ResetAdminUserPasswordResult;
  readonly updateResult?: UpdateAdminUserResult;
}): {
  readonly calls: RepositoryCalls;
  readonly service: AdminUsersService;
} {
  const calls: RepositoryCalls = {
    updateCount: 0,
  };
  const repository = {
    create: async (input: CreateAdminUserInput) => {
      calls.createInput = input;
      return (
        options?.createResult ?? {
          kind: 'created',
          user: {
            email: input.email,
            fullName: input.fullName,
            id: TARGET_USER_ID,
            isActive: true,
            mustChangePassword: true,
            roles: input.roles,
            version: 1,
          },
        }
      );
    },
    findOrganizationId: async () => options?.organizationId ?? ORGANIZATION_ID,
    list: async (organizationId: string) => {
      calls.listOrganizationId = organizationId;
      return page;
    },
    resetPassword: async (input: ResetAdminUserPasswordInput) => {
      calls.resetInput = input;
      return options?.resetResult ?? { kind: 'reset', sessionsRevoked: 1 };
    },
    update: async () => {
      calls.updateCount += 1;
      return (
        options?.updateResult ?? {
          kind: 'updated',
          user: {
            email: 'participant@example.test',
            fullName: 'Updated',
            id: TARGET_USER_ID,
            isActive: true,
            mustChangePassword: false,
            roles: ['PARTICIPANT'],
            version: 2,
          },
        }
      );
    },
  };
  const passwords = {
    hash: async (password: string) => {
      calls.hashedPassword = password;
      return 'synthetic-password-hash';
    },
  };
  const fingerprints = {
    hashRequest: () => 'request-hash',
    hashIdempotencyKey: () => 'idempotency-key-hash',
  };

  return {
    calls,
    service: new AdminUsersService(
      repository as unknown as AdminUsersRepository,
      new AuthorizationPolicy(),
      passwords as unknown as PasswordHasher,
      fingerprints as unknown as IdempotencyFingerprintService,
    ),
  };
}

async function expectApiError(
  promise: Promise<unknown>,
  statusCode: number,
  code: string,
): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );

  assert.ok(error instanceof ApiError);
  assert.equal(error.getStatus(), statusCode);
  assert.equal(error.code, code);
  return error;
}

describe('AdminUsersService', () => {
  it('scopes every list to the authenticated organization', async () => {
    const { calls, service } = createService();

    assert.equal(await service.list(principal, 1, 20), page);
    assert.equal(calls.listOrganizationId, ORGANIZATION_ID);
  });

  it('normalizes a creation before hashing and persisting it', async () => {
    const { calls, service } = createService();

    const user = await service.create(principal, {
      email: '  NEW.USER@Example.Test ',
      fullName: '  Nueva Mentora  ',
      idempotencyKey: '  admin-create-000001  ',
      roles: ['MENTOR', 'ADMIN'],
      temporaryPassword: 'Temporary-2026!',
      traceId: 'trace-create',
    });

    assert.equal(user.email, 'new.user@example.test');
    assert.equal(calls.hashedPassword, 'Temporary-2026!');
    assert.deepEqual(calls.createInput, {
      actorUserId: ADMIN_USER_ID,
      email: 'new.user@example.test',
      expiresAt: calls.createInput?.expiresAt,
      fullName: 'Nueva Mentora',
      idempotencyKeyHash: 'idempotency-key-hash',
      organizationId: ORGANIZATION_ID,
      passwordHash: 'synthetic-password-hash',
      requestHash: 'request-hash',
      roles: ['ADMIN', 'MENTOR'],
      traceId: 'trace-create',
    });
    assert.ok(calls.createInput?.expiresAt instanceof Date);
  });

  it('rejects a missing idempotency key before hashing the password', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.create(principal, {
        email: 'new.user@example.test',
        fullName: 'New user',
        idempotencyKey: undefined,
        roles: ['PARTICIPANT'],
        temporaryPassword: 'Temporary-2026!',
        traceId: 'trace-no-key',
      }),
      422,
      'VALIDATION_ERROR',
    );
    assert.equal(calls.hashedPassword, undefined);
    assert.equal(calls.createInput, undefined);
  });

  it('reports semantic idempotency-key reuse as a stable conflict', async () => {
    const { service } = createService({
      createResult: {
        kind: 'idempotency_key_reused',
      },
    });

    await expectApiError(
      service.create(principal, {
        email: 'new.user@example.test',
        fullName: 'New user',
        idempotencyKey: 'admin-create-000001',
        roles: ['PARTICIPANT'],
        temporaryPassword: 'Temporary-2026!',
        traceId: 'trace-reused-key',
      }),
      409,
      'IDEMPOTENCY_KEY_REUSED',
    );
  });

  it('conceals a cross-organization target before executing the update', async () => {
    const { calls, service } = createService({
      organizationId: EXTERNAL_ORGANIZATION_ID,
    });

    await expectApiError(
      service.update(principal, {
        expectedVersion: 1,
        fullName: 'Should stay private',
        traceId: 'trace-cross-organization',
        userId: TARGET_USER_ID,
      }),
      404,
      'RESOURCE_NOT_FOUND',
    );
    assert.equal(calls.updateCount, 0);
  });

  it('rejects a patch that has no mutable field', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.update(principal, {
        expectedVersion: 1,
        traceId: 'trace-empty-patch',
        userId: TARGET_USER_ID,
      }),
      422,
      'VALIDATION_ERROR',
    );
    assert.equal(calls.updateCount, 0);
  });

  it('rejects a display name that becomes empty after normalization', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.update(principal, {
        expectedVersion: 1,
        fullName: '   ',
        traceId: 'trace-empty-name',
        userId: TARGET_USER_ID,
      }),
      422,
      'VALIDATION_ERROR',
    );
    assert.equal(calls.updateCount, 0);
  });

  it('returns the current version when optimistic concurrency detects a stale write', async () => {
    const { service } = createService({
      updateResult: {
        currentVersion: 4,
        kind: 'conflict',
      },
    });

    const error = await expectApiError(
      service.update(principal, {
        expectedVersion: 3,
        isActive: false,
        traceId: 'trace-stale-write',
        userId: TARGET_USER_ID,
      }),
      409,
      'VERSION_CONFLICT',
    );
    assert.deepEqual(error.details, {
      currentVersion: 4,
      expectedVersion: 3,
    });
  });

  it('scopes a password reset to the authenticated organization', async () => {
    const { calls, service } = createService();

    await service.resetPassword(principal, {
      temporaryPassword: 'Replacement-2026!',
      traceId: 'trace-reset',
      userId: TARGET_USER_ID,
    });

    assert.equal(calls.hashedPassword, 'Replacement-2026!');
    assert.deepEqual(calls.resetInput, {
      actorUserId: ADMIN_USER_ID,
      organizationId: ORGANIZATION_ID,
      passwordHash: 'synthetic-password-hash',
      traceId: 'trace-reset',
      userId: TARGET_USER_ID,
    });
  });

  it('conceals a password-reset target outside the organization', async () => {
    const { service } = createService({
      resetResult: {
        kind: 'not_found',
      },
    });

    await expectApiError(
      service.resetPassword(principal, {
        temporaryPassword: 'Replacement-2026!',
        traceId: 'trace-reset-hidden',
        userId: TARGET_USER_ID,
      }),
      404,
      'RESOURCE_NOT_FOUND',
    );
  });
});
