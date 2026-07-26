import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { createClient } from 'redis';

import { AppModule } from '../app.module.js';
import { configureHttpApp } from '../configure-http-app.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../config/runtime-config.js';
import {
  SYNTHETIC_DEMO_PASSWORD,
  SYNTHETIC_EMAILS,
  SYNTHETIC_IDS,
} from './support/synthetic-seed-data.js';

const WEB_ORIGIN = 'http://localhost:3000';
const TITLE_PREFIX = 'Group Workflow ';

interface TemporaryParticipant {
  readonly email: string;
  readonly enrollmentId: string;
  readonly fullName: string;
  readonly phase: 'FASE_1' | 'FASE_2';
  readonly userId: string;
}

const GROUP_PARTICIPANTS: readonly TemporaryParticipant[] = [
  {
    email: 'group.participant.2@example.test',
    enrollmentId: '91111111-1111-4111-8111-111111111111',
    fullName: 'Participante Grupal 2',
    phase: 'FASE_1',
    userId: '81111111-1111-4111-8111-111111111111',
  },
  {
    email: 'group.participant.3@example.test',
    enrollmentId: '92222222-2222-4222-8222-222222222222',
    fullName: 'Participante Grupal 3',
    phase: 'FASE_1',
    userId: '82222222-2222-4222-8222-222222222222',
  },
  {
    email: 'group.participant.4@example.test',
    enrollmentId: '93333333-3333-4333-8333-333333333333',
    fullName: 'Participante Grupal 4',
    phase: 'FASE_1',
    userId: '83333333-3333-4333-8333-333333333333',
  },
  {
    email: 'group.participant.5@example.test',
    enrollmentId: '94444444-4444-4444-8444-444444444444',
    fullName: 'Participante Grupal 5',
    phase: 'FASE_1',
    userId: '84444444-4444-4444-8444-444444444444',
  },
  {
    email: 'group.participant.6@example.test',
    enrollmentId: '95555555-5555-4555-8555-555555555555',
    fullName: 'Participante Grupal 6',
    phase: 'FASE_1',
    userId: '85555555-5555-4555-8555-555555555555',
  },
  {
    email: 'group.participant.7@example.test',
    enrollmentId: '96666666-6666-4666-8666-666666666666',
    fullName: 'Participante Grupal 7',
    phase: 'FASE_1',
    userId: '86666666-6666-4666-8666-666666666666',
  },
  {
    email: 'group.participant.8@example.test',
    enrollmentId: '97777777-7777-4777-8777-777777777777',
    fullName: 'Participante Grupal 8',
    phase: 'FASE_1',
    userId: '87777777-7777-4777-8777-777777777777',
  },
] as const;

const CHECKPOINT_PARTICIPANT: TemporaryParticipant = {
  email: 'checkpoint.participant@example.test',
  enrollmentId: '98888888-8888-4888-8888-888888888888',
  fullName: 'Participante Checkpoint',
  phase: 'FASE_2',
  userId: '88888888-8888-4888-8888-888888888888',
};

const TEMPORARY_PARTICIPANTS = [...GROUP_PARTICIPANTS, CHECKPOINT_PARTICIPANT] as const;
const GROUP_ENROLLMENT_IDS = [
  SYNTHETIC_IDS.enrollment,
  ...GROUP_PARTICIPANTS.map((participant) => participant.enrollmentId),
] as const;

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
  readonly attendanceStatus: 'PENDING' | 'ATTENDED' | 'ABSENT';
  readonly confirmationStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  readonly confirmedAt: string | null;
  readonly enrollmentId: string;
  readonly participant: {
    readonly fullName: string;
    readonly id: string;
  };
  readonly version: number;
}

interface SessionResponse {
  readonly canConfirm: boolean;
  readonly checkpointMonth: number | null;
  readonly confirmationClosesAt: string;
  readonly confirmationSummary: {
    readonly confirmed: number;
    readonly declined: number;
    readonly pending: number;
    readonly total: number;
  };
  readonly endsAt: string;
  readonly id: string;
  readonly participants: readonly SessionParticipantResponse[];
  readonly phase: 'FASE_1' | 'FASE_2';
  readonly startsAt: string;
  readonly status: string;
  readonly timezone: string;
  readonly title: string;
  readonly type: 'ONE_ON_ONE' | 'GROUP' | 'CHECKPOINT';
  readonly version: number;
  readonly weekNumber: number | null;
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

async function clearLoginRateLimits(): Promise<void> {
  const client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    socket: {
      connectTimeout: 1_000,
      reconnectStrategy: false,
    },
  });

  try {
    await client.connect();
    const keys = await client.keys('auth:login:*');

    if (keys.length > 0) {
      await client.del(keys);
    }
  } finally {
    if (client.isOpen) {
      client.destroy();
    }
  }
}

function createSessionRequest(
  baseUrl: string,
  session: BrowserSession,
  idempotencyKey: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/sessions`, {
    body: JSON.stringify(body),
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

function setAttendanceRequest(
  baseUrl: string,
  session: BrowserSession,
  sessionId: string,
  enrollmentId: string,
  status: 'ATTENDED' | 'ABSENT',
  expectedVersion: number,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/sessions/${sessionId}/participants/${enrollmentId}/attendance`, {
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

async function deleteWorkflowData(pool: Pool): Promise<void> {
  const sessions = await pool.query<{ id: string }>(
    `SELECT id
     FROM "session"
     WHERE title LIKE $1`,
    [`${TITLE_PREFIX}%`],
  );
  const sessionIds = sessions.rows.map((session) => session.id);

  if (sessionIds.length > 0) {
    await pool.query('DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])', [sessionIds]);
    await pool.query('DELETE FROM outbox_event WHERE aggregate_id = ANY($1::uuid[])', [sessionIds]);
    await pool.query('DELETE FROM idempotency_record WHERE resource_id = ANY($1::uuid[])', [
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

  const userIds = TEMPORARY_PARTICIPANTS.map((participant) => participant.userId);
  const enrollmentIds = TEMPORARY_PARTICIPANTS.map((participant) => participant.enrollmentId);
  await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM enrollment WHERE id = ANY($1::uuid[])', [enrollmentIds]);
  await pool.query('DELETE FROM user_role WHERE user_id = ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1::uuid[])', [userIds]);
}

async function insertTemporaryParticipants(pool: Pool): Promise<void> {
  const password = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM "user" WHERE id = $1',
    [SYNTHETIC_IDS.participantUser],
  );
  const passwordHash = password.rows[0]?.password_hash;

  if (passwordHash === undefined) {
    throw new Error('Synthetic participant password hash is missing.');
  }

  for (const participant of TEMPORARY_PARTICIPANTS) {
    await pool.query(
      `INSERT INTO "user" (
         id,
         organization_id,
         email,
         normalized_email,
         password_hash,
         full_name,
         is_active,
         must_change_password,
         version,
         updated_at
       )
       VALUES ($1, $2, $3, $3, $4, $5, true, false, 1, NOW())`,
      [
        participant.userId,
        SYNTHETIC_IDS.organization,
        participant.email,
        passwordHash,
        participant.fullName,
      ],
    );
    await pool.query(
      `INSERT INTO user_role (user_id, role_id, assigned_by_user_id)
       VALUES ($1, $2, $3)`,
      [participant.userId, SYNTHETIC_IDS.participantRole, SYNTHETIC_IDS.adminUser],
    );
    await pool.query(
      `INSERT INTO enrollment (
         id,
         user_id,
         oleada_id,
         status,
         current_phase,
         current_week,
         phase_1_graduated_at,
         enrolled_at,
         version,
         updated_at
       )
       VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, NOW(), 1, NOW())`,
      [
        participant.enrollmentId,
        participant.userId,
        SYNTHETIC_IDS.oleada,
        participant.phase,
        participant.phase === 'FASE_1' ? 4 : null,
        participant.phase === 'FASE_2' ? new Date('2026-09-01T00:00:00.000Z') : null,
      ],
    );
  }
}

describe('group sessions, checkpoints and attendance workflow', () => {
  let admin: BrowserSession;
  let app: INestApplication;
  let baseUrl: string;
  let groupParticipants: readonly BrowserSession[];
  let mentor: BrowserSession;
  let pool: Pool;

  before(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
      throw new Error('DATABASE_URL is required for the integration test.');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      max: 6,
    });
    await clearLoginRateLimits();
    await deleteWorkflowData(pool);
    await insertTemporaryParticipants(pool);

    app = await NestFactory.create(AppModule, {
      logger: false,
    });
    configureHttpApp(app, app.get<RuntimeConfig>(RUNTIME_CONFIG));
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    [mentor, admin, ...groupParticipants] = await Promise.all([
      authenticate(baseUrl, SYNTHETIC_EMAILS.mentor),
      authenticate(baseUrl, SYNTHETIC_EMAILS.admin),
      authenticate(baseUrl, SYNTHETIC_EMAILS.participant),
      ...GROUP_PARTICIPANTS.map((participant) => authenticate(baseUrl, participant.email)),
    ]);
  });

  after(async () => {
    await app?.close();

    if (pool !== undefined) {
      await clearLoginRateLimits();
      await deleteWorkflowData(pool);
      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [SYNTHETIC_IDS.mentorUser, SYNTHETIC_IDS.adminUser, SYNTHETIC_IDS.participantUser],
      ]);
      await pool.end();
    }
  });

  it('creates a group with independent confirmations and a valid Fase 2 checkpoint', async () => {
    const groupResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-group-workflow-0001',
      {
        description: 'Taller grupal sintético para validar confirmaciones mixtas.',
        durationMinutes: 60,
        enrollmentIds: GROUP_ENROLLMENT_IDS,
        meetingUrl: 'https://meet.example.test/group-workflow',
        oleadaId: SYNTHETIC_IDS.oleada,
        phase: 'FASE_1',
        startsAt: '2026-08-26T20:00:00Z',
        timezone: 'America/Lima',
        title: `${TITLE_PREFIX}Taller de empleabilidad`,
        type: 'GROUP',
        weekNumber: 4,
      },
    );
    assert.equal(groupResponse.status, 201);
    const group = (await groupResponse.json()) as SessionResponse;
    assert.equal(group.type, 'GROUP');
    assert.equal(group.weekNumber, 4);
    assert.equal(group.checkpointMonth, null);
    assert.deepEqual(group.confirmationSummary, {
      confirmed: 0,
      declined: 0,
      pending: 8,
      total: 8,
    });
    assert.equal(group.participants.length, 8);

    const confirmationStatuses = [
      'CONFIRMED',
      'CONFIRMED',
      'CONFIRMED',
      'CONFIRMED',
      'CONFIRMED',
      'DECLINED',
    ] as const;
    const confirmationResponses = await Promise.all(
      confirmationStatuses.map((status, index) => {
        const participantSession = groupParticipants[index];

        if (participantSession === undefined) {
          throw new Error('Expected group participant session is missing.');
        }

        return setConfirmationRequest(baseUrl, participantSession, group.id, status, 1);
      }),
    );
    assert.deepEqual(
      confirmationResponses.map((response) => response.status),
      [200, 200, 200, 200, 200, 200],
    );

    const detailResponse = await fetch(`${baseUrl}/api/v1/sessions/${group.id}`, {
      headers: {
        cookie: mentor.accessCookie,
      },
    });
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()) as SessionResponse;
    assert.deepEqual(detail.confirmationSummary, {
      confirmed: 5,
      declined: 1,
      pending: 2,
      total: 8,
    });
    assert.equal(
      detail.participants.filter((participant) => participant.confirmationStatus === 'CONFIRMED')
        .length,
      5,
    );
    assert.equal(
      detail.participants.filter((participant) => participant.confirmationStatus === 'DECLINED')
        .length,
      1,
    );
    assert.equal(
      detail.participants.filter((participant) => participant.confirmationStatus === 'PENDING')
        .length,
      2,
    );

    const checkpointResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-checkpoint-workflow-0001',
      {
        checkpointMonth: 3,
        description: 'Checkpoint sintético de Fase 2.',
        durationMinutes: 45,
        enrollmentIds: [CHECKPOINT_PARTICIPANT.enrollmentId],
        oleadaId: SYNTHETIC_IDS.oleada,
        phase: 'FASE_2',
        startsAt: '2026-09-03T20:00:00Z',
        timezone: 'America/Lima',
        title: `${TITLE_PREFIX}Checkpoint mes 3`,
        type: 'CHECKPOINT',
      },
    );
    assert.equal(checkpointResponse.status, 201);
    const checkpoint = (await checkpointResponse.json()) as SessionResponse;
    assert.equal(checkpoint.type, 'CHECKPOINT');
    assert.equal(checkpoint.phase, 'FASE_2');
    assert.equal(checkpoint.weekNumber, null);
    assert.equal(checkpoint.checkpointMonth, 3);

    const invalidCheckpointResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-checkpoint-workflow-invalid',
      {
        checkpointMonth: 4,
        durationMinutes: 45,
        enrollmentIds: [CHECKPOINT_PARTICIPANT.enrollmentId],
        oleadaId: SYNTHETIC_IDS.oleada,
        phase: 'FASE_2',
        startsAt: '2026-09-04T20:00:00Z',
        timezone: 'America/Lima',
        title: `${TITLE_PREFIX}Checkpoint inválido`,
        type: 'CHECKPOINT',
      },
    );
    assert.equal(invalidCheckpointResponse.status, 422);
    assert.equal(
      ((await invalidCheckpointResponse.json()) as ErrorResponse).error.code,
      'PHASE_PERIOD_MISMATCH',
    );

    const persisted = await pool.query<{
      confirmed: number;
      declined: number;
      pending: number;
      total: number;
    }>(
      `SELECT
         COUNT(*)::int total,
         COUNT(*) FILTER (WHERE confirmation_status = 'CONFIRMED')::int confirmed,
         COUNT(*) FILTER (WHERE confirmation_status = 'DECLINED')::int declined,
         COUNT(*) FILTER (WHERE confirmation_status = 'PENDING')::int pending
       FROM session_participant
       WHERE session_id = $1`,
      [group.id],
    );
    assert.deepEqual(persisted.rows[0], {
      confirmed: 5,
      declined: 1,
      pending: 2,
      total: 8,
    });
  });

  it('records terminal attendance and reserves corrections for administration', async () => {
    const attendanceTarget = GROUP_PARTICIPANTS[6];
    const participantSession = groupParticipants[7];

    if (attendanceTarget === undefined || participantSession === undefined) {
      throw new Error('Attendance test participant is missing.');
    }

    const createdResponse = await createSessionRequest(
      baseUrl,
      mentor,
      'session-attendance-workflow-0001',
      {
        durationMinutes: 45,
        enrollmentIds: [attendanceTarget.enrollmentId],
        oleadaId: SYNTHETIC_IDS.oleada,
        phase: 'FASE_1',
        startsAt: '2026-08-29T20:00:00Z',
        timezone: 'America/Lima',
        title: `${TITLE_PREFIX}Registro de asistencia`,
        type: 'ONE_ON_ONE',
        weekNumber: 4,
      },
    );
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as SessionResponse;

    const tooSoonResponse = await setAttendanceRequest(
      baseUrl,
      mentor,
      created.id,
      attendanceTarget.enrollmentId,
      'ATTENDED',
      1,
    );
    assert.equal(tooSoonResponse.status, 422);
    const tooSoonError = (await tooSoonResponse.json()) as ErrorResponse;
    assert.equal(tooSoonError.error.code, 'SESSION_NOT_STARTED');
    assert.deepEqual(tooSoonError.error.details, {
      startsAt: '2026-08-29T20:00:00.000Z',
    });

    await pool.query(
      `UPDATE "session"
       SET starts_at = '2026-07-20T20:00:00Z',
           ends_at = '2026-07-20T20:45:00Z',
           confirmation_closes_at = '2026-07-20T20:00:00Z'
       WHERE id = $1`,
      [created.id],
    );
    await pool.query(
      `UPDATE schedule_reservation
       SET starts_at = '2026-07-20T20:00:00Z',
           ends_at = '2026-07-20T20:45:00Z'
       WHERE session_id = $1`,
      [created.id],
    );

    const participantDenied = await setAttendanceRequest(
      baseUrl,
      participantSession,
      created.id,
      attendanceTarget.enrollmentId,
      'ATTENDED',
      1,
    );
    assert.equal(participantDenied.status, 403);
    assert.equal(((await participantDenied.json()) as ErrorResponse).error.code, 'FORBIDDEN');

    const attendedResponse = await setAttendanceRequest(
      baseUrl,
      mentor,
      created.id,
      attendanceTarget.enrollmentId,
      'ATTENDED',
      1,
    );
    assert.equal(attendedResponse.status, 200);
    const attended = (await attendedResponse.json()) as SessionParticipantResponse;
    assert.equal(attended.attendanceStatus, 'ATTENDED');
    assert.equal(attended.confirmationStatus, 'PENDING');
    assert.equal(attended.version, 2);

    const repeatedResponse = await setAttendanceRequest(
      baseUrl,
      mentor,
      created.id,
      attendanceTarget.enrollmentId,
      'ATTENDED',
      2,
    );
    assert.equal(repeatedResponse.status, 200);
    assert.deepEqual((await repeatedResponse.json()) as SessionParticipantResponse, attended);

    const mentorCannotCorrect = await setAttendanceRequest(
      baseUrl,
      mentor,
      created.id,
      attendanceTarget.enrollmentId,
      'ABSENT',
      2,
    );
    assert.equal(mentorCannotCorrect.status, 409);
    assert.equal(
      ((await mentorCannotCorrect.json()) as ErrorResponse).error.code,
      'ATTENDANCE_ALREADY_RECORDED',
    );

    const correctedResponse = await setAttendanceRequest(
      baseUrl,
      admin,
      created.id,
      attendanceTarget.enrollmentId,
      'ABSENT',
      2,
    );
    assert.equal(correctedResponse.status, 200);
    const corrected = (await correctedResponse.json()) as SessionParticipantResponse;
    assert.equal(corrected.attendanceStatus, 'ABSENT');
    assert.equal(corrected.confirmationStatus, 'PENDING');
    assert.equal(corrected.version, 3);

    const persisted = await pool.query<{
      attendance_event_count: number;
      attendance_status: string;
      audit_count: number;
      version: number;
    }>(
      `SELECT
         (
           SELECT attendance_status::text
           FROM session_participant
           WHERE session_id = $1 AND enrollment_id = $2
         ) attendance_status,
         (
           SELECT version
           FROM session_participant
           WHERE session_id = $1 AND enrollment_id = $2
         ) version,
         (
           SELECT COUNT(*)::int
           FROM audit_log
           WHERE entity_id = $1
             AND action LIKE 'session.participant_attendance_%'
         ) audit_count,
         (
           SELECT COUNT(*)::int
           FROM outbox_event
           WHERE aggregate_id = $1
             AND event_type = 'session.attendance_recorded'
         ) attendance_event_count`,
      [created.id, attendanceTarget.enrollmentId],
    );
    assert.deepEqual(persisted.rows[0], {
      attendance_event_count: 2,
      attendance_status: 'ABSENT',
      audit_count: 2,
      version: 3,
    });
  });
});
