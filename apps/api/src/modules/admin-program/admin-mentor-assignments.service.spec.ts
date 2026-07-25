import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import type {
  AdminMentorAssignment,
  AdminMentorAssignmentPage,
  CloseAdminMentorAssignmentInput,
  CloseAdminMentorAssignmentResult,
  CreateAdminMentorAssignmentInput,
  CreateAdminMentorAssignmentResult,
  ListAdminMentorAssignmentFilters,
} from './admin-mentor-assignment.js';
import type { AdminMentorAssignmentsRepository } from './admin-mentor-assignments.repository.js';
import { AdminMentorAssignmentsService } from './admin-mentor-assignments.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const MENTOR_USER_ID = '44444444-4444-4444-8444-444444444444';
const OLEADA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ASSIGNMENT_ID = 'aaaaaaaa-1111-4aaa-8111-aaaaaaaaaaaa';

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

const assignment: AdminMentorAssignment = {
  capability: 'SPECIALIST',
  endsAt: null,
  enrollmentId: null,
  id: ASSIGNMENT_ID,
  mentor: {
    fullName: 'Mentora',
    id: MENTOR_USER_ID,
  },
  oleada: {
    id: OLEADA_ID,
    name: 'Oleada',
  },
  startsAt: '2027-01-01T14:00:00.000Z',
  status: 'ACTIVE',
  version: 1,
};

const page: AdminMentorAssignmentPage = {
  data: [assignment],
  meta: {
    hasNextPage: false,
    limit: 20,
    page: 1,
    total: 1,
  },
};

interface Calls {
  closeInput?: CloseAdminMentorAssignmentInput;
  createInput?: CreateAdminMentorAssignmentInput;
  list?: readonly unknown[];
}

function createService(options?: {
  readonly closeResult?: CloseAdminMentorAssignmentResult;
  readonly createResult?: CreateAdminMentorAssignmentResult;
}): {
  readonly calls: Calls;
  readonly service: AdminMentorAssignmentsService;
} {
  const calls: Calls = {};
  const repository = {
    close: async (input: CloseAdminMentorAssignmentInput) => {
      calls.closeInput = input;
      return options?.closeResult ?? { kind: 'closed' };
    },
    create: async (input: CreateAdminMentorAssignmentInput) => {
      calls.createInput = input;
      return options?.createResult ?? { assignment, kind: 'created' };
    },
    list: async (
      organizationId: string,
      pageNumber: number,
      limit: number,
      filters: ListAdminMentorAssignmentFilters,
    ) => {
      calls.list = [organizationId, pageNumber, limit, filters];
      return page;
    },
  };
  const fingerprints = {
    hashIdempotencyKey: () => 'key-hash',
    hashRequest: () => 'request-hash',
  };

  return {
    calls,
    service: new AdminMentorAssignmentsService(
      repository as unknown as AdminMentorAssignmentsRepository,
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

describe('AdminMentorAssignmentsService', () => {
  it('scopes list filters to the authenticated organization', async () => {
    const { calls, service } = createService();
    const filters = {
      active: true,
      mentorUserId: MENTOR_USER_ID,
      oleadaId: OLEADA_ID,
    } as const;

    assert.equal(await service.list(principal, 2, 10, filters), page);
    assert.deepEqual(calls.list, [ORGANIZATION_ID, 2, 10, filters]);
  });

  it('normalizes timestamps before persistence', async () => {
    const { calls, service } = createService();

    assert.equal(
      await service.create(principal, {
        capability: 'SPECIALIST',
        endsAt: '2027-06-01T10:00:00-05:00',
        enrollmentId: null,
        idempotencyKey: 'mentor-assignment-create-0001',
        mentorUserId: MENTOR_USER_ID,
        oleadaId: OLEADA_ID,
        startsAt: '2027-01-01T09:00:00-05:00',
        traceId: 'trace-create',
      }),
      assignment,
    );
    assert.deepEqual(calls.createInput, {
      actorUserId: ADMIN_USER_ID,
      capability: 'SPECIALIST',
      endsAt: new Date('2027-06-01T15:00:00.000Z'),
      enrollmentId: null,
      expiresAt: calls.createInput?.expiresAt,
      idempotencyKeyHash: 'key-hash',
      mentorUserId: MENTOR_USER_ID,
      oleadaId: OLEADA_ID,
      organizationId: ORGANIZATION_ID,
      requestHash: 'request-hash',
      startsAt: new Date('2027-01-01T14:00:00.000Z'),
      traceId: 'trace-create',
    });
    assert.ok(calls.createInput?.expiresAt instanceof Date);
  });

  it('rejects ambiguous timestamps and an invalid period', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.create(principal, {
        capability: 'SPECIALIST',
        endsAt: null,
        enrollmentId: null,
        idempotencyKey: 'mentor-assignment-create-0001',
        mentorUserId: MENTOR_USER_ID,
        oleadaId: OLEADA_ID,
        startsAt: '2027-01-01T09:00:00',
        traceId: 'trace-ambiguous',
      }),
      422,
      'VALIDATION_ERROR',
    );
    await expectApiError(
      service.create(principal, {
        capability: 'SPECIALIST',
        endsAt: '2027-01-01T13:00:00Z',
        enrollmentId: null,
        idempotencyKey: 'mentor-assignment-create-0001',
        mentorUserId: MENTOR_USER_ID,
        oleadaId: OLEADA_ID,
        startsAt: '2027-01-01T14:00:00Z',
        traceId: 'trace-period',
      }),
      422,
      'INVALID_ASSIGNMENT_PERIOD',
    );
    assert.equal(calls.createInput, undefined);
  });

  it('maps eligibility and active-scope conflicts', async () => {
    const eligibility = createService({
      createResult: {
        kind: 'mentor_not_eligible',
      },
    });
    await expectApiError(
      eligibility.service.create(principal, {
        capability: 'SPECIALIST',
        endsAt: null,
        enrollmentId: null,
        idempotencyKey: 'mentor-assignment-create-0001',
        mentorUserId: MENTOR_USER_ID,
        oleadaId: OLEADA_ID,
        startsAt: '2027-01-01T14:00:00Z',
        traceId: 'trace-eligibility',
      }),
      422,
      'MENTOR_NOT_ELIGIBLE_FOR_ASSIGNMENT',
    );

    const scope = createService({
      createResult: {
        kind: 'active_scope_conflict',
      },
    });
    await expectApiError(
      scope.service.create(principal, {
        capability: 'SPECIALIST',
        endsAt: null,
        enrollmentId: null,
        idempotencyKey: 'mentor-assignment-create-0002',
        mentorUserId: MENTOR_USER_ID,
        oleadaId: OLEADA_ID,
        startsAt: '2027-01-01T14:00:00Z',
        traceId: 'trace-scope',
      }),
      409,
      'ACTIVE_MENTOR_ASSIGNMENT_EXISTS',
    );
  });

  it('closes by version and maps stale or future assignments', async () => {
    const closed = createService();

    await closed.service.close(principal, {
      expectedVersion: 3,
      mentorAssignmentId: ASSIGNMENT_ID,
      traceId: 'trace-close',
    });
    assert.deepEqual(closed.calls.closeInput, {
      actorUserId: ADMIN_USER_ID,
      expectedVersion: 3,
      mentorAssignmentId: ASSIGNMENT_ID,
      organizationId: ORGANIZATION_ID,
      traceId: 'trace-close',
    });

    const stale = createService({
      closeResult: {
        currentVersion: 4,
        kind: 'conflict',
      },
    });
    const staleError = await expectApiError(
      stale.service.close(principal, {
        expectedVersion: 3,
        mentorAssignmentId: ASSIGNMENT_ID,
        traceId: 'trace-stale',
      }),
      409,
      'VERSION_CONFLICT',
    );
    assert.deepEqual(staleError.details, {
      currentVersion: 4,
      expectedVersion: 3,
    });

    const future = createService({
      closeResult: {
        kind: 'not_started',
      },
    });
    await expectApiError(
      future.service.close(principal, {
        expectedVersion: 1,
        mentorAssignmentId: ASSIGNMENT_ID,
        traceId: 'trace-future',
      }),
      409,
      'MENTOR_ASSIGNMENT_NOT_STARTED',
    );
  });
});
