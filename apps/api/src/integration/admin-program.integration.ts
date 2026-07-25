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

describe('admin program setup: oleadas', () => {
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
         WHERE organization_id = $1 AND operation = 'admin.oleadas.create'`,
        [SYNTHETIC_IDS.organization],
      );
      await pool.query('DELETE FROM audit_log WHERE organization_id = $1', [
        SYNTHETIC_IDS.organization,
      ]);

      if (createdOleadaId !== undefined) {
        await pool.query('DELETE FROM oleada WHERE id = $1', [createdOleadaId]);
      }

      await pool.query('DELETE FROM oleada WHERE id = $1', [EXTERNAL_OLEADA_ID]);
      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [SYNTHETIC_IDS.adminUser, SYNTHETIC_IDS.participantUser],
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
});
