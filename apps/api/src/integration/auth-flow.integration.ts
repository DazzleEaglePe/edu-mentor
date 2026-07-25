import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';

import { AppModule } from '../app.module.js';
import { configureHttpApp } from '../configure-http-app.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../config/runtime-config.js';
import { PasswordHasher } from '../modules/auth/crypto/password-hasher.js';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000301';
const USER_ID = '00000000-0000-4000-8000-000000000302';
const ROLE_ID = '00000000-0000-4000-8000-000000000303';
const INITIAL_PASSWORD = 'Initial-passphrase-01';
const NEW_PASSWORD = 'Changed-passphrase-02';
const EMAIL = 'auth-flow@example.test';
const WEB_ORIGIN = 'http://localhost:3000';

interface CsrfResponse {
  readonly csrfToken: string;
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

interface MeResponse {
  readonly email: string;
  readonly id: string;
  readonly organization: {
    readonly id: string;
  };
  readonly roles: readonly string[];
}

function readSetCookie(response: Response, name: string): string {
  const prefix = `${name}=`;

  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0];

    if (pair?.startsWith(prefix) === true) {
      return header;
    }
  }

  throw new Error(`Response did not set ${name}.`);
}

function readCookie(response: Response, name: string): string {
  const pair = readSetCookie(response, name).split(';', 1)[0];

  if (pair === undefined) {
    throw new Error(`Response set an invalid ${name} cookie.`);
  }

  return pair;
}

function cookieHeader(...cookies: string[]): string {
  return cookies.join('; ');
}

function mutationHeaders(browserCookie: string, csrfToken: string): Record<string, string> {
  return {
    cookie: browserCookie,
    origin: WEB_ORIGIN,
    'x-csrf-token': csrfToken,
  };
}

async function login(
  baseUrl: string,
  browserCookie: string,
  csrfToken: string,
  password: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      email: EMAIL,
      password,
    }),
    headers: {
      ...mutationHeaders(browserCookie, csrfToken),
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

describe('authentication HTTP flow', () => {
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
    const passwordHash = await new PasswordHasher().hash(INITIAL_PASSWORD);

    await pool.query(
      `INSERT INTO organization (id, name, slug, updated_at)
       VALUES ($1, 'Authentication Test Organization', 'authentication-test', NOW())`,
      [ORGANIZATION_ID],
    );
    await pool.query(
      `INSERT INTO role (id, key, name)
       VALUES ($1, 'PARTICIPANT', 'Participant')`,
      [ROLE_ID],
    );
    await pool.query(
      `INSERT INTO "user" (
         id,
         organization_id,
         email,
         normalized_email,
         password_hash,
         full_name,
         must_change_password,
         updated_at
       )
       VALUES ($1, $2, $3, $3, $4, 'Authentication Test User', FALSE, NOW())`,
      [USER_ID, ORGANIZATION_ID, EMAIL, passwordHash],
    );
    await pool.query(
      `INSERT INTO user_role (user_id, role_id)
       VALUES ($1, $2)`,
      [USER_ID, ROLE_ID],
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
      await pool.query('DELETE FROM audit_log WHERE organization_id = $1', [ORGANIZATION_ID]);
      await pool.query('DELETE FROM auth_session WHERE user_id = $1', [USER_ID]);
      await pool.query('DELETE FROM user_role WHERE user_id = $1', [USER_ID]);
      await pool.query('DELETE FROM "user" WHERE id = $1', [USER_ID]);
      await pool.query('DELETE FROM role WHERE id = $1', [ROLE_ID]);
      await pool.query('DELETE FROM organization WHERE id = $1', [ORGANIZATION_ID]);
      await pool.end();
    }
  });

  it('protects mutations, rotates refresh tokens, detects replay, and revokes sessions', async () => {
    const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
    assert.equal(csrfResponse.status, 200);

    const browserSetCookie = readSetCookie(csrfResponse, 'edu_csrf_browser');
    const browserCookie = readCookie(csrfResponse, 'edu_csrf_browser');
    const csrf = (await csrfResponse.json()) as CsrfResponse;
    assert.match(browserSetCookie, /Path=\/api\/v1;/u);
    assert.match(browserSetCookie, /SameSite=Lax/u);
    assert.match(browserSetCookie, /HttpOnly/u);
    assert.equal(csrfResponse.headers.get('cache-control'), 'no-store');

    const missingCsrf = await fetch(`${baseUrl}/api/v1/auth/login`, {
      body: JSON.stringify({
        email: EMAIL,
        password: INITIAL_PASSWORD,
      }),
      headers: {
        'content-type': 'application/json',
        cookie: browserCookie,
        origin: WEB_ORIGIN,
      },
      method: 'POST',
    });
    assert.equal(missingCsrf.status, 403);
    assert.equal(
      ((await missingCsrf.json()) as ErrorResponse).error.code,
      'CSRF_VALIDATION_FAILED',
    );

    const loginResponse = await login(baseUrl, browserCookie, csrf.csrfToken, INITIAL_PASSWORD);
    assert.equal(loginResponse.status, 200);

    const accessSetCookie = readSetCookie(loginResponse, 'edu_access');
    const refreshSetCookie = readSetCookie(loginResponse, 'edu_refresh');
    const accessCookie = readCookie(loginResponse, 'edu_access');
    const originalRefreshCookie = readCookie(loginResponse, 'edu_refresh');
    assert.match(accessSetCookie, /Path=\/;/u);
    assert.match(accessSetCookie, /HttpOnly/u);
    assert.match(refreshSetCookie, /Path=\/api\/v1\/auth;/u);
    assert.match(refreshSetCookie, /HttpOnly/u);
    const me = (await loginResponse.json()) as MeResponse;
    assert.equal(me.id, USER_ID);
    assert.equal(me.email, EMAIL);
    assert.equal(me.organization.id, ORGANIZATION_ID);
    assert.deepEqual(me.roles, ['PARTICIPANT']);

    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: accessCookie,
      },
    });
    assert.equal(meResponse.status, 200);
    assert.equal(meResponse.headers.get('cache-control'), 'no-store');

    const refreshResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      headers: {
        ...mutationHeaders(browserCookie, csrf.csrfToken),
        cookie: cookieHeader(browserCookie, originalRefreshCookie),
      },
      method: 'POST',
    });
    assert.equal(refreshResponse.status, 204);

    const rotatedAccessCookie = readCookie(refreshResponse, 'edu_access');
    const rotatedRefreshCookie = readCookie(refreshResponse, 'edu_refresh');
    assert.notEqual(rotatedRefreshCookie, originalRefreshCookie);

    const replayResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      headers: {
        ...mutationHeaders(browserCookie, csrf.csrfToken),
        cookie: cookieHeader(browserCookie, originalRefreshCookie),
      },
      method: 'POST',
    });
    assert.equal(replayResponse.status, 409);
    assert.equal(
      ((await replayResponse.json()) as ErrorResponse).error.code,
      'REFRESH_TOKEN_REUSED',
    );

    const revokedFamilyResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: rotatedAccessCookie,
      },
    });
    assert.equal(revokedFamilyResponse.status, 401);

    const secondLogin = await login(baseUrl, browserCookie, csrf.csrfToken, INITIAL_PASSWORD);
    assert.equal(secondLogin.status, 200);
    const secondAccessCookie = readCookie(secondLogin, 'edu_access');

    const passwordChange = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      body: JSON.stringify({
        currentPassword: INITIAL_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
      headers: {
        ...mutationHeaders(browserCookie, csrf.csrfToken),
        'content-type': 'application/json',
        cookie: cookieHeader(browserCookie, secondAccessCookie),
      },
      method: 'POST',
    });
    assert.equal(passwordChange.status, 204);

    assert.equal(
      (await login(baseUrl, browserCookie, csrf.csrfToken, INITIAL_PASSWORD)).status,
      401,
    );
    const thirdLogin = await login(baseUrl, browserCookie, csrf.csrfToken, NEW_PASSWORD);
    assert.equal(thirdLogin.status, 200);
    const thirdAccessCookie = readCookie(thirdLogin, 'edu_access');

    const logoutAll = await fetch(`${baseUrl}/api/v1/auth/logout-all`, {
      headers: {
        ...mutationHeaders(browserCookie, csrf.csrfToken),
        cookie: cookieHeader(browserCookie, thirdAccessCookie),
      },
      method: 'POST',
    });
    assert.equal(logoutAll.status, 204);

    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: thirdAccessCookie,
      },
    });
    assert.equal(afterLogout.status, 401);

    const audit = await pool.query<{ action: string }>(
      `SELECT action
       FROM audit_log
       WHERE organization_id = $1
       ORDER BY occurred_at`,
      [ORGANIZATION_ID],
    );
    const actions = audit.rows.map((row) => row.action);

    assert.ok(actions.includes('auth.login_succeeded'));
    assert.ok(actions.includes('auth.session_rotated'));
    assert.ok(actions.includes('auth.refresh_reuse_detected'));
    assert.ok(actions.includes('auth.password_changed'));
    assert.ok(actions.includes('auth.logout_all'));
  });
});
