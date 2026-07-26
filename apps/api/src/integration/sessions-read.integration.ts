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
  };
}

interface PostgresError {
  readonly code: string;
  readonly constraint?: string;
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
  readonly participants: readonly {
    readonly attendanceStatus: string;
    readonly confirmationStatus: string;
    readonly confirmedAt: string | null;
    readonly enrollmentId: string;
    readonly participant: {
      readonly id: string;
    };
    readonly version: number;
  }[];
  readonly phase: string;
  readonly startsAt: string;
  readonly status: string;
  readonly title: string;
  readonly version: number;
  readonly weekNumber: number | null;
}

interface SessionPageResponse {
  readonly data: readonly SessionResponse[];
  readonly meta: {
    readonly total: number;
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

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
  );
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

describe('session read model and role scoping', () => {
  let app: INestApplication;
  let baseUrl: string;
  let pool: Pool;

  before(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
      throw new Error('DATABASE_URL is required for the integration test.');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      max: 2,
    });
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
      await pool.query('DELETE FROM audit_log WHERE organization_id = $1', [
        SYNTHETIC_IDS.organization,
      ]);
      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [
          SYNTHETIC_IDS.adminUser,
          SYNTHETIC_IDS.externalParticipantUser,
          SYNTHETIC_IDS.mentorUser,
          SYNTHETIC_IDS.participantUser,
        ],
      ]);
      await pool.end();
    }
  });

  it('returns the same persisted session through list, calendar and detail', async () => {
    const participant = await authenticate(baseUrl, SYNTHETIC_EMAILS.participant);
    const list = await fetch(
      `${baseUrl}/api/v1/sessions?page=1&limit=20&status=SCHEDULED&phase=FASE_1&from=2026-08-01T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z`,
      {
        headers: {
          cookie: participant.accessCookie,
        },
      },
    );
    assert.equal(list.status, 200);
    const page = (await list.json()) as SessionPageResponse;
    assert.equal(page.meta.total, 1);
    const session = page.data[0];
    assert.ok(session !== undefined);
    assert.equal(session.id, SYNTHETIC_IDS.session);
    assert.equal(session.canConfirm, true);
    assert.equal(session.startsAt, '2026-08-12T20:00:00.000Z');
    assert.equal(session.endsAt, '2026-08-12T20:45:00.000Z');
    assert.equal(session.confirmationClosesAt, '2026-08-12T20:00:00.000Z');
    assert.deepEqual(session.confirmationSummary, {
      confirmed: 1,
      declined: 0,
      pending: 0,
      total: 1,
    });
    assert.deepEqual(session.participants, [
      {
        attendanceStatus: 'PENDING',
        confirmationStatus: 'CONFIRMED',
        confirmedAt: '2026-08-10T15:30:00.000Z',
        enrollmentId: SYNTHETIC_IDS.enrollment,
        participant: {
          fullName: 'Participante Demo',
          id: SYNTHETIC_IDS.participantUser,
        },
        version: 2,
      },
    ]);

    const calendar = await fetch(
      `${baseUrl}/api/v1/sessions/calendar?from=2026-08-01T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z`,
      {
        headers: {
          cookie: participant.accessCookie,
        },
      },
    );
    assert.equal(calendar.status, 200);
    const summaries = (await calendar.json()) as readonly SessionResponse[];
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.id, SYNTHETIC_IDS.session);
    assert.equal('participants' in (summaries[0] ?? {}), false);

    const detail = await fetch(`${baseUrl}/api/v1/sessions/${SYNTHETIC_IDS.session}`, {
      headers: {
        cookie: participant.accessCookie,
      },
    });
    assert.equal(detail.status, 200);
    assert.deepEqual((await detail.json()) as SessionResponse, session);
  });

  it('scopes the same session for mentor, admin and an unrelated participant', async () => {
    const [mentor, admin, external] = await Promise.all([
      authenticate(baseUrl, SYNTHETIC_EMAILS.mentor),
      authenticate(baseUrl, SYNTHETIC_EMAILS.admin),
      authenticate(baseUrl, SYNTHETIC_EMAILS.externalParticipant),
    ]);

    for (const session of [mentor, admin]) {
      const list = await fetch(`${baseUrl}/api/v1/sessions?page=1&limit=20`, {
        headers: {
          cookie: session.accessCookie,
        },
      });
      assert.equal(list.status, 200);
      const page = (await list.json()) as SessionPageResponse;
      assert.equal(page.meta.total, 1);
      assert.equal(page.data[0]?.id, SYNTHETIC_IDS.session);
      assert.equal(page.data[0]?.canConfirm, false);
    }

    const externalList = await fetch(`${baseUrl}/api/v1/sessions?page=1&limit=20`, {
      headers: {
        cookie: external.accessCookie,
      },
    });
    assert.equal(externalList.status, 200);
    assert.equal(((await externalList.json()) as SessionPageResponse).meta.total, 0);

    const concealed = await fetch(`${baseUrl}/api/v1/sessions/${SYNTHETIC_IDS.session}`, {
      headers: {
        cookie: external.accessCookie,
      },
    });
    assert.equal(concealed.status, 404);
    assert.equal(((await concealed.json()) as ErrorResponse).error.code, 'RESOURCE_NOT_FOUND');
  });

  it('rejects invalid ranges and unauthenticated reads', async () => {
    const participant = await authenticate(baseUrl, SYNTHETIC_EMAILS.participant);
    const reversed = await fetch(
      `${baseUrl}/api/v1/sessions?page=1&limit=20&from=2026-09-01T00%3A00%3A00Z&to=2026-08-01T00%3A00%3A00Z`,
      {
        headers: {
          cookie: participant.accessCookie,
        },
      },
    );
    assert.equal(reversed.status, 422);
    assert.equal(((await reversed.json()) as ErrorResponse).error.code, 'INVALID_TIME_RANGE');

    const unauthenticated = await fetch(`${baseUrl}/api/v1/sessions?page=1&limit=20`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(((await unauthenticated.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
  });

  it('rejects an overlapping live reservation at the database boundary', async () => {
    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO schedule_reservation (
             id,
             session_id,
             resource_type,
             resource_id,
             starts_at,
             ends_at
           )
           VALUES ($1, $2, 'USER', $3, $4, $5)`,
          [
            '88888888-8888-4888-8888-888888888888',
            SYNTHETIC_IDS.session,
            SYNTHETIC_IDS.mentorUser,
            '2026-08-12T20:15:00.000Z',
            '2026-08-12T21:00:00.000Z',
          ],
        ),
      (error: unknown) =>
        isPostgresError(error) &&
        error.code === '23P01' &&
        error.constraint === 'schedule_reservation_no_overlap',
    );
  });
});
