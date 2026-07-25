import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { AuthorizationPolicy } from '../auth/authorization-policy.js';
import type { AdminUserPage, UpdateAdminUserResult } from './admin-user.js';
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
  listOrganizationId?: string;
  updateCount: number;
}

function createService(options?: {
  readonly organizationId?: string | null;
  readonly updateResult?: UpdateAdminUserResult;
}): {
  readonly calls: RepositoryCalls;
  readonly service: AdminUsersService;
} {
  const calls: RepositoryCalls = {
    updateCount: 0,
  };
  const repository = {
    findOrganizationId: async () => options?.organizationId ?? ORGANIZATION_ID,
    list: async (organizationId: string) => {
      calls.listOrganizationId = organizationId;
      return page;
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

  return {
    calls,
    service: new AdminUsersService(
      repository as unknown as AdminUsersRepository,
      new AuthorizationPolicy(),
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
});
