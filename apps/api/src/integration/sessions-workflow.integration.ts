import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';

import { AppModule } from '../app.module.js';
import { configureHttpApp } from '../configure-http-app.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../config/runtime-config.js';
import {
  SYNTHETIC_DEMO_PASSWORD,
  SYNTHETIC_EMAILS,
  SYNTHETIC_IDS,
} from './support/synthetic-seed-data.js';

const WEB_ORIGIN = 'http://localhost:3000';
const WORKFLOW_TITLE_PREFIX = 'Workflow ';

interface BrowserSession {
  readonly accessCookie: string;
  readonly browserCookie: string;
  readonly csrfToken: string;
}

interface CsrfResponse {
  readonly csrfToken: string;
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

interface SessionParticipantResponse {
  readonly attendanceStatus: string;
  readonly confirmationStatus: string;
  readonly confirmedAt: string | null;
  readonly enrollmentId: string;
  readonly version: number;
}

interface SessionResponse {
  readonly canConfirm: boolean;
  readonly confirmationSummary: {
    readonly confirmed: number;
    readonly declined: number;
    readonly pending: number;
    readonly total: number;
  };
  readonly id: string;
  readonly mentor: {
    readonly id: string;
  };
  readonly participants: readonly SessionParticipantResponse[];
  readonly status: string;
  readonly title: string;
  readonly version: number;
}

function readCookie(response: Response, name: string): string {
  const prefix = `${name}=`;

  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0];

    if (pair?.startsWith(prefix) === true) {
      return pair;
    }
  }

  throw new Error(`Response did not set ${name}.`);
}

function mutationHeaders(
  session: BrowserSession,
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return {
    cookie: `${session.browserCookie}; ${session.accessCookie}`,
    origin: WEB_ORIGIN,
    'x-csrf-token': session.csrfToken,
    ...extra,
  };
}

async function authenticate(baseUrl: string, email: string): Promise<BrowserSession> {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const browserCookie = readCookie(csrfResponse, 'edu_csrf_browser');
  const csrf = (await csrfResponse.json()) as CsrfResponse;
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      email,
      password: SYNTHETIC_DEMO_PASSWORD,
    }),
    headers: {
      'content-type': 'application/json',
      cookie: browserCookie,
      origin: WEB_ORIGIN,
      'x-csrf-token': csrf.csrfToken,
    },
    method: 'POST',
  });
  assert.equal(loginResponse.status, 200);

  return {
    accessCookie: readCookie(loginResponse, 'edu_access'),
    browserCookie,
    csrfToken: csrf.csrfToken,
  };
}

function createSessionRequest(
  baseUrl: string,
  session: BrowserSession,
  idempotencyKey: string,
  input: {
    readonly startsAt: string;
    readonly title: string;
  },
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/sessions`, {
    body: JSON.stringify({
      description: 'Sesión creada por la integración de workflow.',
      durationMinutes: 45,
      enrollmentIds: [SYNTHETIC_IDS.enrollment],
      meetingUrl: 'https://meet.example.test/workflow-session',
      oleadaId: SYNTHETIC_IDS.oleada,
      phase: 'FASE_1',
      startsAt: input.startsAt,
      timezone: 'America/Lima',
      title: input.title,
      type: 'ONE_ON_ONE',
      weekNumber: 4,
    }),
    headers: mutationHeaders(session, {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    }),
    method: 'POST',
  });
}

function setConfirmationRequest(
  baseUrl: string,
  session: BrowserSession,
  sessionId: string,
  status: 'CONFIRMED' | 'DECLINED',
  expectedVersion: number,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/sessions/${sessionId}/participants/me/confirmation`, {
    body: JSON.stringify({
      expectedVersion,
      status,
    }),
    headers: mutationHeaders(session, {
      'content-type': 'application/json',
    }),
    method: 'PUT',
  });
}

describe('one-to-one session creation and confirmation workflow', () => {
  let app: INestApplication;
  let baseUrl: string;
  let pool: Pool;
  let mentor: BrowserSession;
  let participant: BrowserSession;

  before(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
      throw new Error('DATABASE_URL is required for the integration test.');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      max: 4,
    });
    app = await NestFactory.create(AppModule, {
      logger: false,
    });
    configureHttpApp(app, app.get<RuntimeConfig>(RUNTIME_CONFIG));
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    [mentor, participant] = await Promise.all([
      authenticate(baseUrl, SYNTHETIC_EMAILS.mentor),
      authenticate(baseUrl, SYNTHETIC_EMAILS.participant),
    ]);
  });

  after(async () => {
    await app?.close();

    if (pool !== undefined) {
      const sessions = await pool.query<{ id: string }>(
        `SELECT id
         FROM "session"
         WHERE title LIKE $1`,
        [`${WORKFLOW_TITLE_PREFIX}%`],
      );
      const sessionIds = sessions.rows.map((session) => session.id);

      if (sessionIds.length > 0) {
        await pool.query('DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])', [sessionIds]);
        await pool.query('DELETE FROM outbox_event WHERE aggregate_id = ANY($1::uuid[])', [
          sessionIds,
        ]);
        await pool.query('DELETE FROM schedule_reservation WHERE session_id = ANY($1::uuid[])', [
          sessionIds,
        ]);
        await pool.query('DELETE FROM session_participant WHERE session_id = ANY($1::uuid[])', [
          sessionIds,
        ]);
        await pool.query('DELETE FROM "session" WHERE id = ANY($1::uuid[])', [sessionIds]);
      }

      await pool.query(
        `DELETE FROM idempotency_record
         WHERE organization_id = $1
           AND operation = 'sessions.create'`,
        [SYNTHETIC_IDS.organization],
      );
      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [SYNTHETIC_IDS.mentorUser, SYNTHETIC_IDS.participantUser],
      ]);
      await pool.end();
    }
  });

  it('creates, replays and confirms one session without duplicating side effects', async () => {
    const createdResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-workflow-create-0001',
      {
        startsAt: '2026-08-20T20:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}1:1 idempotente`,
      },
    );
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as SessionResponse;
    assert.equal(created.mentor.id, SYNTHETIC_IDS.mentorUser);
    assert.equal(created.status, 'SCHEDULED');
    assert.equal(created.canConfirm, false);
    assert.equal(created.version, 1);
    assert.deepEqual(created.confirmationSummary, {
      confirmed: 0,
      declined: 0,
      pending: 1,
      total: 1,
    });
    assert.deepEqual(
      created.participants.map((current) => ({
        confirmationStatus: current.confirmationStatus,
        enrollmentId: current.enrollmentId,
        version: current.version,
      })),
      [
        {
          confirmationStatus: 'PENDING',
          enrollmentId: SYNTHETIC_IDS.enrollment,
          version: 1,
        },
      ],
    );

    const replayResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-workflow-create-0001',
      {
        startsAt: '2026-08-20T20:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}1:1 idempotente`,
      },
    );
    assert.equal(replayResponse.status, 201);
    assert.deepEqual((await replayResponse.json()) as SessionResponse, created);

    const reusedResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-workflow-create-0001',
      {
        startsAt: '2026-08-20T20:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}payload diferente`,
      },
    );
    assert.equal(reusedResponse.status, 409);
    assert.equal(
      ((await reusedResponse.json()) as ErrorResponse).error.code,
      'IDEMPOTENCY_KEY_REUSED',
    );

    const participantDetail = await fetch(`${baseUrl}/api/v1/sessions/${created.id}`, {
      headers: {
        cookie: participant.accessCookie,
      },
    });
    assert.equal(participantDetail.status, 200);
    assert.equal(((await participantDetail.json()) as SessionResponse).canConfirm, true);

    const participantCannotCreate = await createSessionRequest(
      baseUrl,
      participant,
      'session-workflow-create-denied',
      {
        startsAt: '2026-08-20T22:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}denegada`,
      },
    );
    assert.equal(participantCannotCreate.status, 403);
    assert.equal(((await participantCannotCreate.json()) as ErrorResponse).error.code, 'FORBIDDEN');

    const confirmedResponse = await setConfirmationRequest(
      baseUrl,
      participant,
      created.id,
      'CONFIRMED',
      1,
    );
    assert.equal(confirmedResponse.status, 200);
    const confirmed = (await confirmedResponse.json()) as SessionParticipantResponse;
    assert.equal(confirmed.confirmationStatus, 'CONFIRMED');
    assert.equal(confirmed.version, 2);
    assert.ok(confirmed.confirmedAt !== null);

    const unchangedResponse = await setConfirmationRequest(
      baseUrl,
      participant,
      created.id,
      'CONFIRMED',
      2,
    );
    assert.equal(unchangedResponse.status, 200);
    assert.deepEqual((await unchangedResponse.json()) as SessionParticipantResponse, confirmed);

    const staleResponse = await setConfirmationRequest(
      baseUrl,
      participant,
      created.id,
      'DECLINED',
      1,
    );
    assert.equal(staleResponse.status, 409);
    const staleError = (await staleResponse.json()) as ErrorResponse;
    assert.equal(staleError.error.code, 'VERSION_CONFLICT');
    assert.deepEqual(staleError.error.details, {
      currentVersion: 2,
      expectedVersion: 1,
    });

    const declinedResponse = await setConfirmationRequest(
      baseUrl,
      participant,
      created.id,
      'DECLINED',
      2,
    );
    assert.equal(declinedResponse.status, 200);
    const declined = (await declinedResponse.json()) as SessionParticipantResponse;
    assert.equal(declined.confirmationStatus, 'DECLINED');
    assert.equal(declined.version, 3);

    const mentorCannotConfirm = await setConfirmationRequest(
      baseUrl,
      mentor,
      created.id,
      'CONFIRMED',
      3,
    );
    assert.equal(mentorCannotConfirm.status, 403);
    assert.equal(((await mentorCannotConfirm.json()) as ErrorResponse).error.code, 'FORBIDDEN');

    const persisted = await pool.query<{
      audit_count: number;
      confirmation_event_count: number;
      confirmation_status: string;
      create_event_count: number;
      idempotency_count: number;
      participant_count: number;
      reservation_count: number;
      session_count: number;
      version: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM "session" WHERE id = $1) session_count,
         (
           SELECT COUNT(*)::int
           FROM session_participant
           WHERE session_id = $1
         ) participant_count,
         (
           SELECT COUNT(*)::int
           FROM schedule_reservation
           WHERE session_id = $1 AND released_at IS NULL
         ) reservation_count,
         (
           SELECT COUNT(*)::int
           FROM idempotency_record
           WHERE resource_id = $1 AND operation = 'sessions.create'
         ) idempotency_count,
         (
           SELECT COUNT(*)::int
           FROM audit_log
           WHERE entity_id = $1
         ) audit_count,
         (
           SELECT COUNT(*)::int
           FROM outbox_event
           WHERE aggregate_id = $1 AND event_type = 'session.created'
         ) create_event_count,
         (
           SELECT COUNT(*)::int
           FROM outbox_event
           WHERE aggregate_id = $1
             AND event_type = 'session.participant_confirmation_changed'
         ) confirmation_event_count,
         (
           SELECT confirmation_status::text
           FROM session_participant
           WHERE session_id = $1
         ) confirmation_status,
         (
           SELECT version
           FROM session_participant
           WHERE session_id = $1
         ) version`,
      [created.id],
    );
    assert.deepEqual(persisted.rows[0], {
      audit_count: 3,
      confirmation_event_count: 2,
      confirmation_status: 'DECLINED',
      create_event_count: 1,
      idempotency_count: 1,
      participant_count: 1,
      reservation_count: 2,
      session_count: 1,
      version: 3,
    });

    await pool.query(
      `UPDATE "session"
       SET confirmation_closes_at = '2026-07-01T00:00:00Z'
       WHERE id = $1`,
      [created.id],
    );
    const closedResponse = await setConfirmationRequest(
      baseUrl,
      participant,
      created.id,
      'CONFIRMED',
      3,
    );
    assert.equal(closedResponse.status, 422);
    const closedError = (await closedResponse.json()) as ErrorResponse;
    assert.equal(closedError.error.code, 'CONFIRMATION_CLOSED');
    assert.deepEqual(closedError.error.details, {
      confirmationClosesAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('returns a typed visible conflict without reserving the idempotency key', async () => {
    const response = await createSessionRequest(baseUrl, mentor, 'session-workflow-conflict-0001', {
      startsAt: '2026-08-12T20:00:00Z',
      title: `${WORKFLOW_TITLE_PREFIX}conflicto conocido`,
    });
    assert.equal(response.status, 409);
    const error = (await response.json()) as ErrorResponse;
    assert.equal(error.error.code, 'SCHEDULE_CONFLICT');
    assert.deepEqual(error.error.details, {
      canViewConflictingSession: true,
      conflictingSessionId: SYNTHETIC_IDS.session,
      occupiedInterval: {
        endsAt: '2026-08-12T20:45:00.000Z',
        startsAt: '2026-08-12T20:00:00.000Z',
        timezone: 'America/Lima',
      },
      resourceId: SYNTHETIC_IDS.enrollment,
      resourceType: 'ENROLLMENT',
    });

    const stored = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int count
       FROM idempotency_record
       WHERE organization_id = $1
         AND operation = 'sessions.create'`,
      [SYNTHETIC_IDS.organization],
    );
    assert.equal(stored.rows[0]?.count, 1);
  });

  it('allows exactly one winner when two sessions race for the same resources', async () => {
    const responses = await Promise.all([
      createSessionRequest(baseUrl, mentor, 'session-workflow-race-0001', {
        startsAt: '2026-08-21T20:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}race A`,
      }),
      createSessionRequest(baseUrl, mentor, 'session-workflow-race-0002', {
        startsAt: '2026-08-21T20:00:00Z',
        title: `${WORKFLOW_TITLE_PREFIX}race B`,
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);

    const winnerResponse = responses.find((response) => response.status === 201);
    const loserResponse = responses.find((response) => response.status === 409);
    assert.ok(winnerResponse !== undefined);
    assert.ok(loserResponse !== undefined);
    const winner = (await winnerResponse.json()) as SessionResponse;
    const conflict = (await loserResponse.json()) as ErrorResponse;
    assert.equal(conflict.error.code, 'SCHEDULE_CONFLICT');
    assert.equal(conflict.error.details?.canViewConflictingSession, true);
    assert.equal(conflict.error.details?.conflictingSessionId, winner.id);

    const stored = await pool.query<{
      idempotency_count: number;
      reservation_count: number;
      session_count: number;
    }>(
      `SELECT
         (
           SELECT COUNT(*)::int
           FROM "session"
           WHERE title LIKE 'Workflow race%'
         ) session_count,
         (
           SELECT COUNT(*)::int
           FROM schedule_reservation
           WHERE session_id = $1
         ) reservation_count,
         (
           SELECT COUNT(*)::int
           FROM idempotency_record
           WHERE organization_id = $2
             AND operation = 'sessions.create'
         ) idempotency_count`,
      [winner.id, SYNTHETIC_IDS.organization],
    );
    assert.deepEqual(stored.rows[0], {
      idempotency_count: 2,
      reservation_count: 2,
      session_count: 1,
    });
  });
});
