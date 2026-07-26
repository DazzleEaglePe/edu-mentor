import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import type { CreateSessionResult, SetOwnConfirmationResult } from './session-mutation.js';
import type { SessionMutationsRepository } from './session-mutations.repository.js';
import type {
  SessionListFilters,
  SessionPage,
  SessionParticipantView,
  SessionSummaryView,
  SessionView,
} from './session-view.js';
import type { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const OLEADA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const principal: AuthPrincipal = {
  activeEnrollment: {
    currentPhase: 'FASE_1',
    currentWeek: 4,
    id: '22222222-2222-4222-8222-222222222222',
    oleada: {
      id: OLEADA_ID,
      name: 'Oleada',
    },
  },
  email: 'participant@example.test',
  fullName: 'Participant',
  mentorCapabilities: [],
  mustChangePassword: false,
  organization: {
    id: ORGANIZATION_ID,
    name: 'Organization',
  },
  roles: ['PARTICIPANT'],
  sessionId: '77777777-7777-4777-8777-777777777777',
  userId: USER_ID,
};

const summary: SessionSummaryView = {
  canConfirm: true,
  confirmationClosesAt: '2026-08-12T20:00:00.000Z',
  confirmationSummary: {
    confirmed: 1,
    declined: 0,
    pending: 0,
    total: 1,
  },
  endsAt: '2026-08-12T20:45:00.000Z',
  id: SESSION_ID,
  phase: 'FASE_1',
  startsAt: '2026-08-12T20:00:00.000Z',
  status: 'SCHEDULED',
  timezone: 'America/Lima',
  title: 'Mentoría',
  type: 'ONE_ON_ONE',
};

const session: SessionView = {
  ...summary,
  checkpointMonth: null,
  description: null,
  meetingUrl: null,
  mentor: {
    fullName: 'Mentora',
    id: '44444444-4444-4444-8444-444444444444',
  },
  oleada: {
    id: OLEADA_ID,
    name: 'Oleada',
  },
  participants: [],
  rescheduledFromId: null,
  version: 1,
  weekNumber: 4,
};

const page: SessionPage = {
  data: [session],
  meta: {
    hasNextPage: false,
    limit: 20,
    page: 1,
    total: 1,
  },
};

const participant: SessionParticipantView = {
  attendanceStatus: 'PENDING',
  confirmationStatus: 'CONFIRMED',
  confirmedAt: '2026-07-25T20:00:00.000Z',
  enrollmentId: '22222222-2222-4222-8222-222222222222',
  participant: {
    fullName: 'Participant',
    id: USER_ID,
  },
  version: 2,
};

interface Calls {
  readonly calendar: unknown[][];
  readonly create: unknown[][];
  readonly findById: unknown[][];
  readonly list: unknown[][];
  readonly setOwnConfirmation: unknown[][];
}

function createService(
  found: SessionView | null = session,
  createResult: CreateSessionResult = {
    kind: 'created',
    session,
  },
  confirmationResult: SetOwnConfirmationResult = {
    kind: 'updated',
    participant,
  },
): {
  readonly calls: Calls;
  readonly service: SessionsService;
} {
  const calls: Calls = {
    calendar: [],
    create: [],
    findById: [],
    list: [],
    setOwnConfirmation: [],
  };
  const repository = {
    calendar: async (...args: readonly unknown[]) => {
      calls.calendar.push([...args]);
      return [summary];
    },
    findById: async (...args: readonly unknown[]) => {
      calls.findById.push([...args]);
      return found;
    },
    list: async (...args: readonly unknown[]) => {
      calls.list.push([...args]);
      return page;
    },
  };
  const mutations = {
    create: async (...args: readonly unknown[]) => {
      calls.create.push([...args]);
      return createResult;
    },
    setOwnConfirmation: async (...args: readonly unknown[]) => {
      calls.setOwnConfirmation.push([...args]);
      return confirmationResult;
    },
  };
  const fingerprints = {
    hashIdempotencyKey: () => 'key-hash',
    hashRequest: () => 'request-hash',
  };

  return {
    calls,
    service: new SessionsService(
      repository as unknown as SessionsRepository,
      mutations as unknown as SessionMutationsRepository,
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

describe('SessionsService', () => {
  it('normalizes a mentor-created one-to-one session before persistence', async () => {
    const { calls, service } = createService();
    const mentor: AuthPrincipal = {
      ...principal,
      roles: ['MENTOR'],
      userId: '44444444-4444-4444-8444-444444444444',
    };

    assert.equal(
      await service.create(mentor, {
        description: '  Objetivo  ',
        durationMinutes: 45,
        enrollmentIds: ['22222222-2222-4222-8222-222222222222'],
        idempotencyKey: ' session-create-0001 ',
        meetingUrl: 'https://meet.example.test/session',
        oleadaId: OLEADA_ID,
        phase: 'FASE_1',
        startsAt: '2026-08-20T15:00:00-05:00',
        timezone: ' America/Lima ',
        title: '  Mentoría 1:1  ',
        traceId: 'trace-create',
        type: 'ONE_ON_ONE',
        weekNumber: 4,
      }),
      session,
    );
    assert.equal(calls.create.length, 1);
    const input = calls.create[0]?.[0] as Record<string, unknown>;
    assert.equal(input.actorIsAdmin, false);
    assert.equal(input.actorUserId, mentor.userId);
    assert.equal(input.mentorUserId, mentor.userId);
    assert.equal(input.title, 'Mentoría 1:1');
    assert.equal(input.description, 'Objetivo');
    assert.equal(input.timezone, 'America/Lima');
    assert.deepEqual(input.startsAt, new Date('2026-08-20T20:00:00.000Z'));
    assert.deepEqual(input.endsAt, new Date('2026-08-20T20:45:00.000Z'));
    assert.equal(input.idempotencyKeyHash, 'key-hash');
    assert.equal(input.requestHash, 'request-hash');
  });

  it('rejects invalid phase fields, timezone and one-to-one participant count', async () => {
    const { calls, service } = createService();
    const mentor: AuthPrincipal = {
      ...principal,
      roles: ['MENTOR'],
      userId: '44444444-4444-4444-8444-444444444444',
    };
    const command = {
      durationMinutes: 45,
      enrollmentIds: ['22222222-2222-4222-8222-222222222222'],
      idempotencyKey: 'session-create-0001',
      oleadaId: OLEADA_ID,
      phase: 'FASE_1' as const,
      startsAt: '2026-08-20T20:00:00Z',
      timezone: 'America/Lima',
      title: 'Mentoría',
      traceId: 'trace-create',
      type: 'ONE_ON_ONE' as const,
      weekNumber: 4,
    };

    await expectApiError(
      service.create(mentor, {
        ...command,
        checkpointMonth: 1,
      }),
      422,
      'PHASE_PERIOD_MISMATCH',
    );
    await expectApiError(
      service.create(mentor, {
        ...command,
        timezone: 'Mars/Olympus',
      }),
      422,
      'INVALID_TIMEZONE',
    );
    await expectApiError(
      service.create(mentor, {
        ...command,
        enrollmentIds: [
          '22222222-2222-4222-8222-222222222222',
          '99999999-9999-4999-8999-999999999999',
        ],
      }),
      422,
      'SESSION_PARTICIPANT_COUNT_INVALID',
    );
    assert.deepEqual(calls.create, []);
  });

  it('redacts a typed schedule conflict according to the repository result', async () => {
    const { service } = createService(session, {
      conflict: {
        canViewConflictingSession: false,
        conflictingSessionId: null,
        occupiedInterval: {
          endsAt: '2026-08-20T20:45:00.000Z',
          startsAt: '2026-08-20T20:00:00.000Z',
          timezone: 'America/Lima',
        },
        resourceId: '22222222-2222-4222-8222-222222222222',
        resourceType: 'ENROLLMENT',
      },
      kind: 'schedule_conflict',
    });
    const mentor: AuthPrincipal = {
      ...principal,
      roles: ['MENTOR'],
      userId: '44444444-4444-4444-8444-444444444444',
    };
    const error = await expectApiError(
      service.create(mentor, {
        durationMinutes: 45,
        enrollmentIds: ['22222222-2222-4222-8222-222222222222'],
        idempotencyKey: 'session-create-0001',
        oleadaId: OLEADA_ID,
        phase: 'FASE_1',
        startsAt: '2026-08-20T20:00:00Z',
        timezone: 'America/Lima',
        title: 'Mentoría',
        traceId: 'trace-create',
        type: 'ONE_ON_ONE',
        weekNumber: 4,
      }),
      409,
      'SCHEDULE_CONFLICT',
    );

    assert.deepEqual(error.details, {
      canViewConflictingSession: false,
      conflictingSessionId: null,
      occupiedInterval: {
        endsAt: '2026-08-20T20:45:00.000Z',
        startsAt: '2026-08-20T20:00:00.000Z',
        timezone: 'America/Lima',
      },
      resourceId: '22222222-2222-4222-8222-222222222222',
      resourceType: 'ENROLLMENT',
    });
  });

  it('parses list boundaries and preserves domain filters', async () => {
    const { calls, service } = createService();

    assert.equal(
      await service.list(principal, {
        from: '2026-08-01T00:00:00-05:00',
        limit: 10,
        oleadaId: OLEADA_ID,
        page: 2,
        phase: 'FASE_1',
        status: 'SCHEDULED',
        to: '2026-09-01T00:00:00-05:00',
      }),
      page,
    );
    assert.deepEqual(calls.list, [
      [
        principal,
        2,
        10,
        {
          from: new Date('2026-08-01T05:00:00.000Z'),
          oleadaId: OLEADA_ID,
          phase: 'FASE_1',
          status: 'SCHEDULED',
          to: new Date('2026-09-01T05:00:00.000Z'),
        } satisfies SessionListFilters,
      ],
    ]);
  });

  it('rejects ambiguous timestamps and reversed ranges', async () => {
    const { calls, service } = createService();

    await expectApiError(
      service.list(principal, {
        from: '2026-08-01T00:00:00',
        limit: 20,
        page: 1,
      }),
      422,
      'VALIDATION_ERROR',
    );
    await expectApiError(
      service.list(principal, {
        from: '2026-09-01T00:00:00Z',
        limit: 20,
        page: 1,
        to: '2026-08-01T00:00:00Z',
      }),
      422,
      'INVALID_TIME_RANGE',
    );
    assert.deepEqual(calls.list, []);
  });

  it('requires and parses both calendar boundaries', async () => {
    const { calls, service } = createService();

    assert.deepEqual(
      await service.calendar(principal, '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'),
      [summary],
    );
    assert.deepEqual(calls.calendar, [
      [principal, new Date('2026-08-01T00:00:00.000Z'), new Date('2026-09-01T00:00:00.000Z')],
    ]);
  });

  it('conceals a session outside the principal scope', async () => {
    const { service } = createService(null);

    await expectApiError(service.get(principal, SESSION_ID), 404, 'RESOURCE_NOT_FOUND');
  });

  it('maps own confirmation updates and optimistic conflicts', async () => {
    const { calls, service } = createService();

    assert.equal(
      await service.setOwnConfirmation(principal, {
        expectedVersion: 1,
        sessionId: SESSION_ID,
        status: 'CONFIRMED',
        traceId: 'trace-confirm',
      }),
      participant,
    );
    assert.deepEqual(calls.setOwnConfirmation, [
      [
        {
          actorUserId: USER_ID,
          expectedVersion: 1,
          organizationId: ORGANIZATION_ID,
          sessionId: SESSION_ID,
          status: 'CONFIRMED',
          traceId: 'trace-confirm',
        },
      ],
    ]);

    const conflict = createService(session, undefined, {
      currentVersion: 2,
      kind: 'conflict',
    });
    const error = await expectApiError(
      conflict.service.setOwnConfirmation(principal, {
        expectedVersion: 1,
        sessionId: SESSION_ID,
        status: 'DECLINED',
        traceId: 'trace-confirm',
      }),
      409,
      'VERSION_CONFLICT',
    );
    assert.deepEqual(error.details, {
      currentVersion: 2,
      expectedVersion: 1,
    });
  });

  it('returns the persisted cutoff when confirmation has closed', async () => {
    const { service } = createService(session, undefined, {
      confirmationClosesAt: '2026-08-20T20:00:00.000Z',
      kind: 'confirmation_closed',
    });
    const error = await expectApiError(
      service.setOwnConfirmation(principal, {
        expectedVersion: 1,
        sessionId: SESSION_ID,
        status: 'CONFIRMED',
        traceId: 'trace-confirm',
      }),
      422,
      'CONFIRMATION_CLOSED',
    );

    assert.deepEqual(error.details, {
      confirmationClosesAt: '2026-08-20T20:00:00.000Z',
    });
  });
});
