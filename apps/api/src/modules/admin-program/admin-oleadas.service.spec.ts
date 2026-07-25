import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import { ApiError } from '../../common/http/api-error.js';
import type {
  AdminOleadaPage,
  CreateAdminOleadaInput,
  CreateAdminOleadaResult,
  UpdateAdminOleadaInput,
  UpdateAdminOleadaResult,
} from './admin-oleada.js';
import type { AdminOleadasRepository } from './admin-oleadas.repository.js';
import { AdminOleadasService } from './admin-oleadas.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const OLEADA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

const page: AdminOleadaPage = {
  data: [],
  meta: {
    hasNextPage: false,
    limit: 20,
    page: 1,
    total: 0,
  },
};

interface Calls {
  createInput?: CreateAdminOleadaInput;
  list?: readonly unknown[];
  updateInput?: UpdateAdminOleadaInput;
}

function createService(options?: {
  readonly createResult?: CreateAdminOleadaResult;
  readonly updateResult?: UpdateAdminOleadaResult;
}): {
  readonly calls: Calls;
  readonly service: AdminOleadasService;
} {
  const calls: Calls = {};
  const repository = {
    create: async (input: CreateAdminOleadaInput) => {
      calls.createInput = input;
      return (
        options?.createResult ?? {
          kind: 'created',
          oleada: {
            activeEnrollmentCount: 0,
            capacity: input.capacity,
            endDate: input.endDate.toISOString().slice(0, 10),
            id: OLEADA_ID,
            name: input.name,
            sector: input.sector,
            startDate: input.startDate.toISOString().slice(0, 10),
            status: 'DRAFT',
            version: 1,
          },
        }
      );
    },
    list: async (...args: readonly unknown[]) => {
      calls.list = args;
      return page;
    },
    update: async (input: UpdateAdminOleadaInput) => {
      calls.updateInput = input;
      return (
        options?.updateResult ?? {
          kind: 'updated',
          oleada: {
            activeEnrollmentCount: 0,
            capacity: input.capacity ?? 30,
            endDate: '2027-02-28',
            id: input.oleadaId,
            name: input.name ?? 'Oleada',
            sector: input.sector ?? 'Tecnología',
            startDate: '2026-08-01',
            status: input.status ?? 'DRAFT',
            version: input.expectedVersion + 1,
          },
        }
      );
    },
  };
  const fingerprints = {
    hashIdempotencyKey: () => 'key-hash',
    hashRequest: () => 'request-hash',
  };

  return {
    calls,
    service: new AdminOleadasService(
      repository as unknown as AdminOleadasRepository,
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

describe('AdminOleadasService', () => {
  it('scopes list filters to the authenticated organization', async () => {
    const { calls, service } = createService();

    assert.equal(await service.list(principal, 2, 10, 'OPEN'), page);
    assert.deepEqual(calls.list, [ORGANIZATION_ID, 2, 10, 'OPEN']);
  });

  it('normalizes and parses a creation before persistence', async () => {
    const { calls, service } = createService();

    const oleada = await service.create(principal, {
      capacity: 25,
      endDate: '2027-02-28',
      idempotencyKey: ' admin-oleada-0001 ',
      name: '  Tecnología 2026 ',
      sector: ' Tecnología ',
      startDate: '2026-08-01',
      traceId: 'trace-create-oleada',
    });

    assert.equal(oleada.status, 'DRAFT');
    assert.deepEqual(calls.createInput, {
      actorUserId: ADMIN_USER_ID,
      capacity: 25,
      endDate: new Date('2027-02-28T00:00:00.000Z'),
      expiresAt: calls.createInput?.expiresAt,
      idempotencyKeyHash: 'key-hash',
      name: 'Tecnología 2026',
      organizationId: ORGANIZATION_ID,
      requestHash: 'request-hash',
      sector: 'Tecnología',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      traceId: 'trace-create-oleada',
    });
    assert.ok(calls.createInput?.expiresAt instanceof Date);
  });

  it('rejects impossible calendar dates and reversed ranges', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.create(principal, {
        capacity: 25,
        endDate: '2027-02-28',
        idempotencyKey: 'admin-oleada-0001',
        name: 'Oleada',
        sector: 'Tecnología',
        startDate: '2026-02-30',
        traceId: 'trace-invalid-calendar',
      }),
      422,
      'VALIDATION_ERROR',
    );
    await expectApiError(
      service.create(principal, {
        capacity: 25,
        endDate: '2026-07-31',
        idempotencyKey: 'admin-oleada-0001',
        name: 'Oleada',
        sector: 'Tecnología',
        startDate: '2026-08-01',
        traceId: 'trace-invalid-range',
      }),
      422,
      'INVALID_DATE_RANGE',
    );
    assert.equal(calls.createInput, undefined);
  });

  it('rejects an empty update before touching persistence', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.update(principal, {
        expectedVersion: 1,
        oleadaId: OLEADA_ID,
        traceId: 'trace-empty',
      }),
      422,
      'VALIDATION_ERROR',
    );
    assert.equal(calls.updateInput, undefined);
  });

  it('maps capacity and transition failures to stable errors', async () => {
    const capacity = createService({
      updateResult: {
        activeEnrollmentCount: 18,
        kind: 'capacity_below_active',
      },
    });
    const capacityError = await expectApiError(
      capacity.service.update(principal, {
        capacity: 17,
        expectedVersion: 2,
        oleadaId: OLEADA_ID,
        traceId: 'trace-capacity',
      }),
      422,
      'CAPACITY_BELOW_ACTIVE_ENROLLMENTS',
    );
    assert.deepEqual(capacityError.details, {
      activeEnrollmentCount: 18,
    });

    const transition = createService({
      updateResult: {
        currentStatus: 'DRAFT',
        kind: 'invalid_transition',
        requestedStatus: 'IN_PROGRESS',
      },
    });
    await expectApiError(
      transition.service.update(principal, {
        expectedVersion: 1,
        oleadaId: OLEADA_ID,
        status: 'IN_PROGRESS',
        traceId: 'trace-transition',
      }),
      409,
      'INVALID_STATUS_TRANSITION',
    );
  });

  it('conceals a target outside the organization', async () => {
    const { service } = createService({
      updateResult: {
        kind: 'not_found',
      },
    });

    await expectApiError(
      service.update(principal, {
        expectedVersion: 1,
        name: 'No debe cruzar tenant',
        oleadaId: OLEADA_ID,
        traceId: 'trace-hidden',
      }),
      404,
      'RESOURCE_NOT_FOUND',
    );
  });
});
