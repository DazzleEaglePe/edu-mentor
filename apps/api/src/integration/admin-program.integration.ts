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
const IDEMPOTENCY_KEY = 'admin-oleada-integration-0001';
const EXTERNAL_OLEADA_ID = 'f1111111-1111-4111-8111-111111111111';
const CAPACITY_OLEADA_ID = 'f2222222-2222-4222-8222-222222222222';
const PARTICIPANT_A_ID = 'f3333333-3333-4333-8333-333333333333';
const PARTICIPANT_B_ID = 'f4444444-4444-4444-8444-444444444444';
const ENROLLMENT_KEY_A = 'admin-enrollment-integration-a-0001';
const ENROLLMENT_KEY_B = 'admin-enrollment-integration-b-0001';

interface AdminOleadaResponse {
  readonly activeEnrollmentCount: number;
  readonly capacity: number;
  readonly endDate: string;
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly startDate: string;
  readonly status: string;
  readonly version: number;
}

interface AdminOleadaPageResponse {
  readonly data: readonly AdminOleadaResponse[];
  readonly meta: {
    readonly total: number;
  };
}

interface AdminEnrollmentResponse {
  readonly currentPhase: string;
  readonly currentWeek: number | null;
  readonly enrolledAt: string;
  readonly id: string;
  readonly oleada: {
    readonly id: string;
    readonly name: string;
  };
  readonly phase1GraduatedAt: string | null;
  readonly status: string;
  readonly user: {
    readonly id: string;
  };
  readonly version: number;
}

interface AdminEnrollmentPageResponse {
  readonly data: readonly AdminEnrollmentResponse[];
  readonly meta: {
    readonly total: number;
  };
}

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

function createOleadaRequest(
  baseUrl: string,
  admin: BrowserSession,
  idempotencyKey: string | undefined,
  name = 'Oleada Salud Demo 2027',
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/admin/oleadas`, {
    body: JSON.stringify({
      capacity: 24,
      endDate: '2027-08-31',
      name,
      sector: 'Salud',
      startDate: '2027-03-01',
    }),
    headers: mutationHeaders(admin, {
      'content-type': 'application/json',
      ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
    }),
    method: 'POST',
  });
}

function updateOleadaRequest(
  baseUrl: string,
  admin: BrowserSession,
  oleadaId: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/admin/oleadas/${oleadaId}`, {
    body: JSON.stringify(body),
    headers: mutationHeaders(admin, {
      'content-type': 'application/json',
    }),
    method: 'PATCH',
  });
}

function createEnrollmentRequest(
  baseUrl: string,
  admin: BrowserSession,
  userId: string,
  idempotencyKey: string,
  currentPhase: 'FASE_0' | 'FASE_1' = 'FASE_0',
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/admin/enrollments`, {
    body: JSON.stringify({
      currentPhase,
      oleadaId: CAPACITY_OLEADA_ID,
      userId,
    }),
    headers: mutationHeaders(admin, {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    }),
    method: 'POST',
  });
}

function updateEnrollmentRequest(
  baseUrl: string,
  admin: BrowserSession,
  enrollmentId: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/admin/enrollments/${enrollmentId}`, {
    body: JSON.stringify(body),
    headers: mutationHeaders(admin, {
      'content-type': 'application/json',
    }),
    method: 'PATCH',
  });
}

describe('admin program setup', () => {
  let app: INestApplication;
  let baseUrl: string;
  let createdOleadaId: string | undefined;
  let pool: Pool;

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
    await pool.query(
      `INSERT INTO oleada (
         id,
         organization_id,
         name,
         sector,
         status,
         start_date,
         end_date,
         capacity,
         updated_at
       )
       VALUES ($1, $2, 'Oleada Externa', 'Externo', 'DRAFT', '2027-01-01', '2027-06-30', 10, NOW())`,
      [EXTERNAL_OLEADA_ID, SYNTHETIC_IDS.externalOrganization],
    );
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
       SELECT
         requested.id,
         source.organization_id,
         requested.email,
         requested.email,
         source.password_hash,
         requested.full_name,
         TRUE,
         FALSE,
         1,
         NOW()
       FROM "user" source
       CROSS JOIN (
         VALUES
           ($1::uuid, 'participante.a.integration@example.test', 'Participante A'),
           ($2::uuid, 'participante.b.integration@example.test', 'Participante B')
       ) AS requested(id, email, full_name)
       WHERE source.id = $3`,
      [PARTICIPANT_A_ID, PARTICIPANT_B_ID, SYNTHETIC_IDS.participantUser],
    );
    await pool.query(
      `INSERT INTO user_role (user_id, role_id, assigned_by_user_id)
       VALUES
         ($1, $3, $4),
         ($2, $3, $4)`,
      [PARTICIPANT_A_ID, PARTICIPANT_B_ID, SYNTHETIC_IDS.participantRole, SYNTHETIC_IDS.adminUser],
    );

    app = await NestFactory.create(AppModule, {
      logger: false,
    });
    configureHttpApp(app, app.get<RuntimeConfig>(RUNTIME_CONFIG));
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await app?.close();

    if (pool !== undefined) {
      await pool.query(
        `DELETE FROM idempotency_record
         WHERE organization_id = $1
           AND operation IN ('admin.oleadas.create', 'admin.enrollments.create')`,
        [SYNTHETIC_IDS.organization],
      );
      await pool.query('DELETE FROM audit_log WHERE organization_id = $1', [
        SYNTHETIC_IDS.organization,
      ]);
      await pool.query('DELETE FROM enrollment WHERE user_id = ANY($1::uuid[])', [
        [PARTICIPANT_A_ID, PARTICIPANT_B_ID],
      ]);

      if (createdOleadaId !== undefined) {
        await pool.query('DELETE FROM oleada WHERE id = $1', [createdOleadaId]);
      }

      await pool.query('DELETE FROM oleada WHERE id = $1', [CAPACITY_OLEADA_ID]);
      await pool.query('DELETE FROM oleada WHERE id = $1', [EXTERNAL_OLEADA_ID]);
      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [
          SYNTHETIC_IDS.adminUser,
          SYNTHETIC_IDS.participantUser,
          PARTICIPANT_A_ID,
          PARTICIPANT_B_ID,
        ],
      ]);
      await pool.query('DELETE FROM user_role WHERE user_id = ANY($1::uuid[])', [
        [PARTICIPANT_A_ID, PARTICIPANT_B_ID],
      ]);
      await pool.query('DELETE FROM "user" WHERE id = ANY($1::uuid[])', [
        [PARTICIPANT_A_ID, PARTICIPANT_B_ID],
      ]);
      await pool.end();
    }
  });

  it('lists by tenant and creates/transitions exactly once', async () => {
    const admin = await authenticate(baseUrl, SYNTHETIC_EMAILS.admin);
    const list = await fetch(`${baseUrl}/api/v1/admin/oleadas?page=1&limit=20`, {
      headers: {
        cookie: admin.accessCookie,
      },
    });
    assert.equal(list.status, 200);
    const initialPage = (await list.json()) as AdminOleadaPageResponse;
    assert.equal(initialPage.meta.total, 1);
    assert.equal(initialPage.data[0]?.id, SYNTHETIC_IDS.oleada);
    assert.equal(initialPage.data[0]?.activeEnrollmentCount, 1);
    assert.equal(
      initialPage.data.some((oleada) => oleada.id === EXTERNAL_OLEADA_ID),
      false,
    );

    const missingKey = await createOleadaRequest(baseUrl, admin, undefined);
    assert.equal(missingKey.status, 422);
    assert.equal(((await missingKey.json()) as ErrorResponse).error.code, 'VALIDATION_ERROR');

    const [firstResponse, concurrentResponse] = await Promise.all([
      createOleadaRequest(baseUrl, admin, IDEMPOTENCY_KEY),
      createOleadaRequest(baseUrl, admin, IDEMPOTENCY_KEY),
    ]);
    assert.equal(firstResponse.status, 201);
    assert.equal(concurrentResponse.status, 201);
    const first = (await firstResponse.json()) as AdminOleadaResponse;
    const concurrent = (await concurrentResponse.json()) as AdminOleadaResponse;
    createdOleadaId = first.id;
    assert.deepEqual(concurrent, first);
    assert.deepEqual(first, {
      activeEnrollmentCount: 0,
      capacity: 24,
      endDate: '2027-08-31',
      id: first.id,
      name: 'Oleada Salud Demo 2027',
      sector: 'Salud',
      startDate: '2027-03-01',
      status: 'DRAFT',
      version: 1,
    });

    const storage = await pool.query<{
      audit_count: number;
      idempotency_count: number;
      oleada_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM oleada WHERE id = $1) oleada_count,
         (
           SELECT COUNT(*)::int
           FROM audit_log
           WHERE entity_id = $1 AND action = 'admin.oleada_created'
         ) audit_count,
         (
           SELECT COUNT(*)::int
           FROM idempotency_record
           WHERE resource_id = $1 AND operation = 'admin.oleadas.create'
         ) idempotency_count`,
      [first.id],
    );
    assert.deepEqual(storage.rows[0], {
      audit_count: 1,
      idempotency_count: 1,
      oleada_count: 1,
    });

    const reused = await createOleadaRequest(baseUrl, admin, IDEMPOTENCY_KEY, 'Otra Oleada');
    assert.equal(reused.status, 409);
    assert.equal(((await reused.json()) as ErrorResponse).error.code, 'IDEMPOTENCY_KEY_REUSED');

    const external = await updateOleadaRequest(baseUrl, admin, EXTERNAL_OLEADA_ID, {
      expectedVersion: 1,
      name: 'No debe cruzar organización',
    });
    assert.equal(external.status, 404);
    assert.equal(((await external.json()) as ErrorResponse).error.code, 'RESOURCE_NOT_FOUND');

    const skipped = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 1,
      status: 'IN_PROGRESS',
    });
    assert.equal(skipped.status, 409);
    assert.equal(((await skipped.json()) as ErrorResponse).error.code, 'INVALID_STATUS_TRANSITION');

    const openedResponse = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 1,
      status: 'OPEN',
    });
    assert.equal(openedResponse.status, 200);
    assert.equal(((await openedResponse.json()) as AdminOleadaResponse).version, 2);

    const stale = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 1,
      sector: 'Sector obsoleto',
    });
    assert.equal(stale.status, 409);
    const staleError = (await stale.json()) as ErrorResponse;
    assert.equal(staleError.error.code, 'VERSION_CONFLICT');
    assert.deepEqual(staleError.error.details, {
      currentVersion: 2,
      expectedVersion: 1,
    });

    const inProgress = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 2,
      status: 'IN_PROGRESS',
    });
    assert.equal(inProgress.status, 200);
    assert.equal(((await inProgress.json()) as AdminOleadaResponse).version, 3);

    const closed = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 3,
      status: 'CLOSED',
    });
    assert.equal(closed.status, 200);
    assert.equal(((await closed.json()) as AdminOleadaResponse).version, 4);

    const immutable = await updateOleadaRequest(baseUrl, admin, first.id, {
      expectedVersion: 4,
      name: 'No debe cambiar',
    });
    assert.equal(immutable.status, 409);
    assert.equal(((await immutable.json()) as ErrorResponse).error.code, 'OLEADA_CLOSED');

    const participant = await authenticate(baseUrl, SYNTHETIC_EMAILS.participant);
    const forbidden = await fetch(`${baseUrl}/api/v1/admin/oleadas`, {
      headers: {
        cookie: participant.accessCookie,
      },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(((await forbidden.json()) as ErrorResponse).error.code, 'FORBIDDEN');
  });

  it('serializes the final capacity slot and preserves enrollment transitions', async () => {
    await pool.query(
      `INSERT INTO oleada (
         id,
         organization_id,
         name,
         sector,
         status,
         start_date,
         end_date,
         capacity,
         updated_at
       )
       VALUES ($1, $2, 'Oleada Último Cupo', 'Tecnología', 'OPEN', '2027-09-01', '2028-02-29', 1, NOW())`,
      [CAPACITY_OLEADA_ID, SYNTHETIC_IDS.organization],
    );
    const admin = await authenticate(baseUrl, SYNTHETIC_EMAILS.admin);
    const attempts = await Promise.all([
      createEnrollmentRequest(baseUrl, admin, PARTICIPANT_A_ID, ENROLLMENT_KEY_A),
      createEnrollmentRequest(baseUrl, admin, PARTICIPANT_B_ID, ENROLLMENT_KEY_B),
    ]);
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);

    const winnerIndex = attempts.findIndex((response) => response.status === 201);
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    const winnerResponse = attempts[winnerIndex];
    const loserResponse = attempts[loserIndex];

    assert.ok(winnerResponse !== undefined);
    assert.ok(loserResponse !== undefined);
    const winner = (await winnerResponse.json()) as AdminEnrollmentResponse;
    const loserError = (await loserResponse.json()) as ErrorResponse;
    assert.equal(loserError.error.code, 'OLEADA_CAPACITY_REACHED');

    const winnerUserId = winner.user.id;
    const loserUserId = winnerUserId === PARTICIPANT_A_ID ? PARTICIPANT_B_ID : PARTICIPANT_A_ID;
    const winnerKey = winnerUserId === PARTICIPANT_A_ID ? ENROLLMENT_KEY_A : ENROLLMENT_KEY_B;
    const loserKey = winnerUserId === PARTICIPANT_A_ID ? ENROLLMENT_KEY_B : ENROLLMENT_KEY_A;
    const afterRace = await pool.query<{
      active_count: number;
      audit_count: number;
      completed_idempotency_count: number;
      reservation_count: number;
    }>(
      `SELECT
         (
           SELECT COUNT(*)::int
           FROM enrollment
           WHERE oleada_id = $1 AND status = 'ACTIVE'
         ) active_count,
         (
           SELECT COUNT(*)::int
           FROM audit_log
           WHERE organization_id = $2 AND action = 'admin.enrollment_created'
         ) audit_count,
         (
           SELECT COUNT(*)::int
           FROM idempotency_record
           WHERE organization_id = $2
             AND operation = 'admin.enrollments.create'
         ) reservation_count,
         (
           SELECT COUNT(*)::int
           FROM idempotency_record
           WHERE organization_id = $2
             AND operation = 'admin.enrollments.create'
             AND response_status = 201
         ) completed_idempotency_count`,
      [CAPACITY_OLEADA_ID, SYNTHETIC_IDS.organization],
    );
    assert.deepEqual(afterRace.rows[0], {
      active_count: 1,
      audit_count: 1,
      completed_idempotency_count: 1,
      reservation_count: 1,
    });

    const losingRetryWhileFull = await createEnrollmentRequest(
      baseUrl,
      admin,
      loserUserId,
      loserKey,
    );
    assert.equal(losingRetryWhileFull.status, 409);
    assert.equal(
      ((await losingRetryWhileFull.json()) as ErrorResponse).error.code,
      'OLEADA_CAPACITY_REACHED',
    );

    const withdrawnResponse = await updateEnrollmentRequest(baseUrl, admin, winner.id, {
      expectedVersion: 1,
      status: 'WITHDRAWN',
    });
    assert.equal(withdrawnResponse.status, 200);
    const withdrawn = (await withdrawnResponse.json()) as AdminEnrollmentResponse;
    assert.equal(withdrawn.status, 'WITHDRAWN');
    assert.equal(withdrawn.version, 2);

    const loserCreatedResponse = await createEnrollmentRequest(
      baseUrl,
      admin,
      loserUserId,
      loserKey,
    );
    assert.equal(loserCreatedResponse.status, 201);
    const loserCreated = (await loserCreatedResponse.json()) as AdminEnrollmentResponse;
    assert.equal(loserCreated.user.id, loserUserId);
    assert.equal(loserCreated.currentPhase, 'FASE_0');

    const replayResponse = await createEnrollmentRequest(baseUrl, admin, loserUserId, loserKey);
    assert.equal(replayResponse.status, 201);
    assert.deepEqual((await replayResponse.json()) as AdminEnrollmentResponse, loserCreated);

    const reusedResponse = await createEnrollmentRequest(
      baseUrl,
      admin,
      loserUserId,
      loserKey,
      'FASE_1',
    );
    assert.equal(reusedResponse.status, 409);
    assert.equal(
      ((await reusedResponse.json()) as ErrorResponse).error.code,
      'IDEMPOTENCY_KEY_REUSED',
    );

    const listResponse = await fetch(
      `${baseUrl}/api/v1/admin/enrollments?page=1&limit=20&oleadaId=${CAPACITY_OLEADA_ID}&status=ACTIVE&phase=FASE_0`,
      {
        headers: {
          cookie: admin.accessCookie,
        },
      },
    );
    assert.equal(listResponse.status, 200);
    const page = (await listResponse.json()) as AdminEnrollmentPageResponse;
    assert.equal(page.meta.total, 1);
    assert.equal(page.data[0]?.id, loserCreated.id);

    const phaseOneResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentPhase: 'FASE_1',
      currentWeek: 2,
      expectedVersion: 1,
    });
    assert.equal(phaseOneResponse.status, 200);
    const phaseOne = (await phaseOneResponse.json()) as AdminEnrollmentResponse;
    assert.equal(phaseOne.currentPhase, 'FASE_1');
    assert.equal(phaseOne.currentWeek, 2);
    assert.equal(phaseOne.version, 2);

    const staleResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentWeek: 3,
      expectedVersion: 1,
    });
    assert.equal(staleResponse.status, 409);
    assert.equal(((await staleResponse.json()) as ErrorResponse).error.code, 'VERSION_CONFLICT');

    const skippedResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentPhase: 'FINISHED',
      expectedVersion: 2,
    });
    assert.equal(skippedResponse.status, 409);
    assert.equal(
      ((await skippedResponse.json()) as ErrorResponse).error.code,
      'INVALID_PHASE_TRANSITION',
    );

    const phaseTwoResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentPhase: 'FASE_2',
      expectedVersion: 2,
    });
    assert.equal(phaseTwoResponse.status, 200);
    const phaseTwo = (await phaseTwoResponse.json()) as AdminEnrollmentResponse;
    assert.equal(phaseTwo.currentWeek, null);
    assert.equal(phaseTwo.currentPhase, 'FASE_2');
    assert.ok(phaseTwo.phase1GraduatedAt !== null);
    assert.equal(phaseTwo.version, 3);

    const invalidWeekResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentWeek: 4,
      expectedVersion: 3,
    });
    assert.equal(invalidWeekResponse.status, 422);
    assert.equal(
      ((await invalidWeekResponse.json()) as ErrorResponse).error.code,
      'PHASE_WEEK_MISMATCH',
    );

    const finishedResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      currentPhase: 'FINISHED',
      expectedVersion: 3,
    });
    assert.equal(finishedResponse.status, 200);
    assert.equal(((await finishedResponse.json()) as AdminEnrollmentResponse).version, 4);

    const completedResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      expectedVersion: 4,
      status: 'COMPLETED',
    });
    assert.equal(completedResponse.status, 200);
    assert.equal(((await completedResponse.json()) as AdminEnrollmentResponse).status, 'COMPLETED');

    const terminalResponse = await updateEnrollmentRequest(baseUrl, admin, loserCreated.id, {
      expectedVersion: 5,
      status: 'ACTIVE',
    });
    assert.equal(terminalResponse.status, 409);
    assert.equal(
      ((await terminalResponse.json()) as ErrorResponse).error.code,
      'ENROLLMENT_TERMINAL',
    );

    const externalTargetResponse = await createEnrollmentRequest(
      baseUrl,
      admin,
      SYNTHETIC_IDS.externalParticipantUser,
      'admin-enrollment-external-user-0001',
    );
    assert.equal(externalTargetResponse.status, 422);
    assert.equal(
      ((await externalTargetResponse.json()) as ErrorResponse).error.code,
      'ENROLLMENT_TARGET_INVALID',
    );

    const participant = await authenticate(baseUrl, SYNTHETIC_EMAILS.participant);
    const forbidden = await fetch(`${baseUrl}/api/v1/admin/enrollments`, {
      headers: {
        cookie: participant.accessCookie,
      },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(((await forbidden.json()) as ErrorResponse).error.code, 'FORBIDDEN');

    assert.notEqual(winnerKey, loserKey);
  });
});
