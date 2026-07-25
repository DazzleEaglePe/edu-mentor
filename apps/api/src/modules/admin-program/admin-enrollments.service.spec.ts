import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import type {
  AdminEnrollment,
  AdminEnrollmentPage,
  CreateAdminEnrollmentInput,
  CreateAdminEnrollmentResult,
  ListAdminEnrollmentFilters,
  UpdateAdminEnrollmentInput,
  UpdateAdminEnrollmentResult,
} from './admin-enrollment.js';
import type { AdminEnrollmentsRepository } from './admin-enrollments.repository.js';
import { AdminEnrollmentsService } from './admin-enrollments.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const PARTICIPANT_USER_ID = '11111111-1111-4111-8111-111111111111';
const OLEADA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ENROLLMENT_ID = '22222222-2222-4222-8222-222222222222';

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

const enrollment: AdminEnrollment = {
  currentPhase: 'FASE_0',
  currentWeek: null,
  enrolledAt: '2026-07-25T12:00:00.000Z',
  id: ENROLLMENT_ID,
  oleada: {
    id: OLEADA_ID,
    name: 'Oleada',
  },
  phase1GraduatedAt: null,
  status: 'ACTIVE',
  user: {
    email: 'participant@example.test',
    fullName: 'Participant',
    id: PARTICIPANT_USER_ID,
    isActive: true,
    mustChangePassword: false,
    roles: ['PARTICIPANT'],
    version: 1,
  },
  version: 1,
};

const page: AdminEnrollmentPage = {
  data: [enrollment],
  meta: {
    hasNextPage: false,
    limit: 20,
    page: 1,
    total: 1,
  },
};

interface Calls {
  createInput?: CreateAdminEnrollmentInput;
  list?: readonly unknown[];
  updateInput?: UpdateAdminEnrollmentInput;
}

function createService(options?: {
  readonly createResult?: CreateAdminEnrollmentResult;
  readonly updateResult?: UpdateAdminEnrollmentResult;
}): {
  readonly calls: Calls;
  readonly service: AdminEnrollmentsService;
} {
  const calls: Calls = {};
  const repository = {
    create: async (input: CreateAdminEnrollmentInput) => {
      calls.createInput = input;
      return options?.createResult ?? { enrollment, kind: 'created' };
    },
    list: async (
      organizationId: string,
      pageNumber: number,
      limit: number,
      filters: ListAdminEnrollmentFilters,
    ) => {
      calls.list = [organizationId, pageNumber, limit, filters];
      return page;
    },
    update: async (input: UpdateAdminEnrollmentInput) => {
      calls.updateInput = input;
      return options?.updateResult ?? { enrollment, kind: 'updated' };
    },
  };
  const fingerprints = {
    hashIdempotencyKey: () => 'key-hash',
    hashRequest: () => 'request-hash',
  };

  return {
    calls,
    service: new AdminEnrollmentsService(
      repository as unknown as AdminEnrollmentsRepository,
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

describe('AdminEnrollmentsService', () => {
  it('scopes list filters to the authenticated organization', async () => {
    const { calls, service } = createService();
    const filters = {
      oleadaId: OLEADA_ID,
      phase: 'FASE_1',
      status: 'ACTIVE',
    } as const;

    assert.equal(await service.list(principal, 2, 10, filters), page);
    assert.deepEqual(calls.list, [ORGANIZATION_ID, 2, 10, filters]);
  });

  it('fingerprints the complete creation command', async () => {
    const { calls, service } = createService();

    assert.equal(
      await service.create(principal, {
        currentPhase: 'FASE_1',
        idempotencyKey: ' enrollment-create-0001 ',
        oleadaId: OLEADA_ID,
        traceId: 'trace-create',
        userId: PARTICIPANT_USER_ID,
      }),
      enrollment,
    );
    assert.deepEqual(calls.createInput, {
      actorUserId: ADMIN_USER_ID,
      currentPhase: 'FASE_1',
      expiresAt: calls.createInput?.expiresAt,
      idempotencyKeyHash: 'key-hash',
      oleadaId: OLEADA_ID,
      organizationId: ORGANIZATION_ID,
      requestHash: 'request-hash',
      traceId: 'trace-create',
      userId: PARTICIPANT_USER_ID,
    });
    assert.ok(calls.createInput?.expiresAt instanceof Date);
  });

  it('maps capacity and eligibility failures to stable errors', async () => {
    const capacity = createService({
      createResult: {
        capacity: 1,
        kind: 'capacity_reached',
      },
    });
    const capacityError = await expectApiError(
      capacity.service.create(principal, {
        currentPhase: 'FASE_0',
        idempotencyKey: 'enrollment-create-0001',
        oleadaId: OLEADA_ID,
        traceId: 'trace-capacity',
        userId: PARTICIPANT_USER_ID,
      }),
      409,
      'OLEADA_CAPACITY_REACHED',
    );
    assert.deepEqual(capacityError.details, { capacity: 1 });

    const eligibility = createService({
      createResult: {
        kind: 'user_not_eligible',
      },
    });
    await expectApiError(
      eligibility.service.create(principal, {
        currentPhase: 'FASE_0',
        idempotencyKey: 'enrollment-create-0002',
        oleadaId: OLEADA_ID,
        traceId: 'trace-eligibility',
        userId: PARTICIPANT_USER_ID,
      }),
      422,
      'USER_NOT_ELIGIBLE_FOR_ENROLLMENT',
    );
  });

  it('rejects an update without a requested transition', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.update(principal, {
        enrollmentId: ENROLLMENT_ID,
        expectedVersion: 1,
        traceId: 'trace-empty',
      }),
      422,
      'VALIDATION_ERROR',
    );
    assert.equal(calls.updateInput, undefined);
  });

  it('maps stale, terminal and invalid phase updates', async () => {
    const stale = createService({
      updateResult: {
        currentVersion: 3,
        kind: 'conflict',
      },
    });
    const staleError = await expectApiError(
      stale.service.update(principal, {
        currentWeek: 2,
        enrollmentId: ENROLLMENT_ID,
        expectedVersion: 2,
        traceId: 'trace-stale',
      }),
      409,
      'VERSION_CONFLICT',
    );
    assert.deepEqual(staleError.details, {
      currentVersion: 3,
      expectedVersion: 2,
    });

    const terminal = createService({
      updateResult: {
        kind: 'terminal',
      },
    });
    await expectApiError(
      terminal.service.update(principal, {
        enrollmentId: ENROLLMENT_ID,
        expectedVersion: 3,
        status: 'ACTIVE',
        traceId: 'trace-terminal',
      }),
      409,
      'ENROLLMENT_TERMINAL',
    );

    const phase = createService({
      updateResult: {
        currentPhase: 'FASE_0',
        kind: 'invalid_phase_transition',
        requestedPhase: 'FASE_2',
      },
    });
    await expectApiError(
      phase.service.update(principal, {
        currentPhase: 'FASE_2',
        enrollmentId: ENROLLMENT_ID,
        expectedVersion: 1,
        traceId: 'trace-phase',
      }),
      409,
      'INVALID_PHASE_TRANSITION',
    );
  });
});
