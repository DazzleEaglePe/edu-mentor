import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type {
  SessionListFilters,
  SessionPage,
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

interface Calls {
  readonly calendar: unknown[][];
  readonly findById: unknown[][];
  readonly list: unknown[][];
}

function createService(found: SessionView | null = session): {
  readonly calls: Calls;
  readonly service: SessionsService;
} {
  const calls: Calls = {
    calendar: [],
    findById: [],
    list: [],
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

  return {
    calls,
    service: new SessionsService(repository as unknown as SessionsRepository),
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
});
