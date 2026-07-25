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
const CREATED_EMAIL = 'lifecycle.mentor@example.test';
const INITIAL_TEMPORARY_PASSWORD = 'Lifecycle-Temporary-2026!';
const RESET_TEMPORARY_PASSWORD = 'Lifecycle-Replaced-2026!';
const IDEMPOTENCY_KEY = 'admin-user-lifecycle-0001';

interface AdminUserResponse {
  readonly email: string;
  readonly fullName: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly roles: readonly string[];
  readonly version: number;
}

interface AuthMeResponse {
  readonly id: string;
  readonly mustChangePassword: boolean;
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
    readonly message: string;
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

async function login(baseUrl: string, email: string, password: string): Promise<Response> {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const browserCookie = readCookie(csrfResponse, 'edu_csrf_browser');
  const csrf = (await csrfResponse.json()) as CsrfResponse;

  return fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      email,
      password,
    }),
    headers: {
      'content-type': 'application/json',
      cookie: browserCookie,
      origin: WEB_ORIGIN,
      'x-csrf-token': csrf.csrfToken,
    },
    method: 'POST',
  });
}

async function authenticate(
  baseUrl: string,
  email: string,
  password: string,
): Promise<BrowserSession> {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const browserCookie = readCookie(csrfResponse, 'edu_csrf_browser');
  const csrf = (await csrfResponse.json()) as CsrfResponse;
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      email,
      password,
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

function createUserRequest(
  baseUrl: string,
  admin: BrowserSession,
  idempotencyKey: string | undefined,
  fullName = 'Mentora Lifecycle',
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/admin/users`, {
    body: JSON.stringify({
      email: CREATED_EMAIL,
      fullName,
      roles: ['PARTICIPANT', 'MENTOR'],
      temporaryPassword: INITIAL_TEMPORARY_PASSWORD,
    }),
    headers: mutationHeaders(admin, {
      'content-type': 'application/json',
      ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
    }),
    method: 'POST',
  });
}

describe('admin user lifecycle', () => {
  let app: INestApplication;
  let baseUrl: string;
  let createdUserId: string | undefined;
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
      await pool.query('DELETE FROM idempotency_record WHERE organization_id = $1', [
        SYNTHETIC_IDS.organization,
      ]);
      await pool.query('DELETE FROM audit_log WHERE organization_id = $1', [
        SYNTHETIC_IDS.organization,
      ]);

      if (createdUserId !== undefined) {
        await pool.query('DELETE FROM auth_session WHERE user_id = $1', [createdUserId]);
        await pool.query('DELETE FROM user_role WHERE user_id = $1', [createdUserId]);
        await pool.query('DELETE FROM mentor_profile WHERE user_id = $1', [createdUserId]);
        await pool.query('DELETE FROM "user" WHERE id = $1', [createdUserId]);
      }

      await pool.query('DELETE FROM auth_session WHERE user_id = ANY($1::uuid[])', [
        [SYNTHETIC_IDS.adminUser, SYNTHETIC_IDS.participantUser],
      ]);
      await pool.end();
    }
  });

  it('creates exactly once, conceals tenants, resets credentials, and audits safely', async () => {
    const admin = await authenticate(baseUrl, SYNTHETIC_EMAILS.admin, SYNTHETIC_DEMO_PASSWORD);
    const missingKey = await createUserRequest(baseUrl, admin, undefined);
    assert.equal(missingKey.status, 422);
    assert.equal(((await missingKey.json()) as ErrorResponse).error.code, 'VALIDATION_ERROR');

    const [firstResponse, concurrentResponse] = await Promise.all([
      createUserRequest(baseUrl, admin, IDEMPOTENCY_KEY),
      createUserRequest(baseUrl, admin, IDEMPOTENCY_KEY),
    ]);
    assert.equal(firstResponse.status, 201);
    assert.equal(concurrentResponse.status, 201);

    const firstUser = (await firstResponse.json()) as AdminUserResponse;
    const concurrentUser = (await concurrentResponse.json()) as AdminUserResponse;
    createdUserId = firstUser.id;
    assert.deepEqual(concurrentUser, firstUser);
    assert.equal(firstUser.email, CREATED_EMAIL);
    assert.equal(firstUser.isActive, true);
    assert.equal(firstUser.mustChangePassword, true);
    assert.deepEqual(firstUser.roles, ['MENTOR', 'PARTICIPANT']);
    assert.equal(firstUser.version, 1);

    const storedCreation = await pool.query<{
      audit_count: number;
      idempotency_count: number;
      key_hash: string;
      mentor_profile_count: number;
      request_hash: string;
      user_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM "user" WHERE organization_id = $1 AND normalized_email = $2)
           user_count,
         (SELECT COUNT(*)::int FROM mentor_profile WHERE user_id = $3) mentor_profile_count,
         (
           SELECT COUNT(*)::int
           FROM audit_log
           WHERE organization_id = $1 AND entity_id = $3 AND action = 'admin.user_created'
         ) audit_count,
         (SELECT COUNT(*)::int FROM idempotency_record WHERE organization_id = $1)
           idempotency_count,
         (SELECT key_hash FROM idempotency_record WHERE organization_id = $1 LIMIT 1) key_hash,
         (SELECT request_hash FROM idempotency_record WHERE organization_id = $1 LIMIT 1)
           request_hash`,
      [SYNTHETIC_IDS.organization, CREATED_EMAIL, firstUser.id],
    );
    assert.deepEqual(
      {
        audit_count: storedCreation.rows[0]?.audit_count,
        idempotency_count: storedCreation.rows[0]?.idempotency_count,
        mentor_profile_count: storedCreation.rows[0]?.mentor_profile_count,
        user_count: storedCreation.rows[0]?.user_count,
      },
      {
        audit_count: 1,
        idempotency_count: 1,
        mentor_profile_count: 1,
        user_count: 1,
      },
    );
    assert.equal(storedCreation.rows[0]?.key_hash.length, 64);
    assert.notEqual(storedCreation.rows[0]?.key_hash, IDEMPOTENCY_KEY);
    assert.equal(storedCreation.rows[0]?.request_hash.length, 64);
    assert.notEqual(storedCreation.rows[0]?.request_hash, INITIAL_TEMPORARY_PASSWORD);

    const replay = await createUserRequest(baseUrl, admin, IDEMPOTENCY_KEY);
    assert.equal(replay.status, 201);
    assert.deepEqual((await replay.json()) as AdminUserResponse, firstUser);

    const reusedKey = await createUserRequest(baseUrl, admin, IDEMPOTENCY_KEY, 'Otra identidad');
    assert.equal(reusedKey.status, 409);
    assert.equal(((await reusedKey.json()) as ErrorResponse).error.code, 'IDEMPOTENCY_KEY_REUSED');

    const duplicateEmail = await createUserRequest(baseUrl, admin, 'admin-user-lifecycle-0002');
    assert.equal(duplicateEmail.status, 409);
    assert.equal(
      ((await duplicateEmail.json()) as ErrorResponse).error.code,
      'EMAIL_ALREADY_EXISTS',
    );

    const participant = await authenticate(
      baseUrl,
      SYNTHETIC_EMAILS.participant,
      SYNTHETIC_DEMO_PASSWORD,
    );
    const forbiddenCreate = await createUserRequest(
      baseUrl,
      participant,
      'admin-user-lifecycle-0003',
    );
    assert.equal(forbiddenCreate.status, 403);
    assert.equal(((await forbiddenCreate.json()) as ErrorResponse).error.code, 'FORBIDDEN');

    const externalBefore = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM "user" WHERE id = $1',
      [SYNTHETIC_IDS.externalParticipantUser],
    );
    const externalReset = await fetch(
      `${baseUrl}/api/v1/admin/users/${SYNTHETIC_IDS.externalParticipantUser}/password-reset`,
      {
        body: JSON.stringify({
          temporaryPassword: RESET_TEMPORARY_PASSWORD,
        }),
        headers: mutationHeaders(admin, {
          'content-type': 'application/json',
        }),
        method: 'POST',
      },
    );
    assert.equal(externalReset.status, 404);
    assert.equal(((await externalReset.json()) as ErrorResponse).error.code, 'RESOURCE_NOT_FOUND');
    const externalAfter = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM "user" WHERE id = $1',
      [SYNTHETIC_IDS.externalParticipantUser],
    );
    assert.equal(externalAfter.rows[0]?.password_hash, externalBefore.rows[0]?.password_hash);

    const createdSession = await authenticate(baseUrl, CREATED_EMAIL, INITIAL_TEMPORARY_PASSWORD);
    const reset = await fetch(`${baseUrl}/api/v1/admin/users/${firstUser.id}/password-reset`, {
      body: JSON.stringify({
        temporaryPassword: RESET_TEMPORARY_PASSWORD,
      }),
      headers: mutationHeaders(admin, {
        'content-type': 'application/json',
      }),
      method: 'POST',
    });
    assert.equal(reset.status, 204);
    assert.equal(await reset.text(), '');

    const revokedSession = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: createdSession.accessCookie,
      },
    });
    assert.equal(revokedSession.status, 401);
    assert.equal(((await revokedSession.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal((await login(baseUrl, CREATED_EMAIL, INITIAL_TEMPORARY_PASSWORD)).status, 401);
    const replacementLogin = await login(baseUrl, CREATED_EMAIL, RESET_TEMPORARY_PASSWORD);
    assert.equal(replacementLogin.status, 200);
    const replacementMe = (await replacementLogin.json()) as AuthMeResponse;
    assert.equal(replacementMe.id, firstUser.id);
    assert.equal(replacementMe.mustChangePassword, true);

    const storedReset = await pool.query<{
      actions: readonly string[];
      leaked_secret: boolean;
      must_change_password: boolean;
      version: number;
    }>(
      `SELECT
         ARRAY_AGG(action ORDER BY occurred_at) actions,
         BOOL_OR(
           COALESCE(before::text, '') LIKE '%' || $2 || '%'
           OR COALESCE(after::text, '') LIKE '%' || $2 || '%'
           OR COALESCE(before::text, '') LIKE '%' || $3 || '%'
           OR COALESCE(after::text, '') LIKE '%' || $3 || '%'
         ) leaked_secret,
         (SELECT must_change_password FROM "user" WHERE id = $1) must_change_password,
         (SELECT version FROM "user" WHERE id = $1) version
       FROM audit_log
       WHERE entity_id = $1
         AND action IN ('admin.user_created', 'admin.user_password_reset')`,
      [firstUser.id, INITIAL_TEMPORARY_PASSWORD, RESET_TEMPORARY_PASSWORD],
    );
    assert.deepEqual(storedReset.rows[0]?.actions, [
      'admin.user_created',
      'admin.user_password_reset',
    ]);
    assert.equal(storedReset.rows[0]?.leaked_secret, false);
    assert.equal(storedReset.rows[0]?.must_change_password, true);
    assert.equal(storedReset.rows[0]?.version, 2);
  });
});
