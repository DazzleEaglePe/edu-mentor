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

interface AdminUserResponse {
  readonly email: string;
  readonly fullName: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly roles: readonly string[];
  readonly version: number;
}

interface AdminUserPageResponse {
  readonly data: readonly AdminUserResponse[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

interface CsrfResponse {
  readonly csrfToken: string;
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly message: string;
    readonly traceId: string;
  };
}

interface BrowserSession {
  readonly accessCookie: string;
  readonly browserCookie: string;
  readonly csrfToken: string;
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

function mutationHeaders(session: BrowserSession): Record<string, string> {
  return {
    cookie: `${session.browserCookie}; ${session.accessCookie}`,
    origin: WEB_ORIGIN,
    'x-csrf-token': session.csrfToken,
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

describe('synthetic seed and organization-scoped administration', () => {
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
        [SYNTHETIC_IDS.adminUser, SYNTHETIC_IDS.participantUser],
      ]);
      await pool.query('DELETE FROM user_role WHERE user_id = $1', [SYNTHETIC_IDS.participantUser]);
      await pool.query(
        `INSERT INTO user_role (user_id, role_id, assigned_by_user_id)
         VALUES ($1, $2, $3)`,
        [SYNTHETIC_IDS.participantUser, SYNTHETIC_IDS.participantRole, SYNTHETIC_IDS.adminUser],
      );
      await pool.query('DELETE FROM mentor_profile WHERE user_id = $1', [
        SYNTHETIC_IDS.participantUser,
      ]);
      await pool.query(
        `UPDATE "user"
         SET full_name = 'Participante Demo', is_active = TRUE, version = 1, updated_at = NOW()
         WHERE id = $1`,
        [SYNTHETIC_IDS.participantUser],
      );
      await pool.end();
    }
  });

  it('provides deterministic role fixtures and enforces RBAC, ownership, and versions', async () => {
    const seedShape = await pool.query<{
      enrollment_count: number;
      mentor_capability_count: number;
      mentor_assignment_count: number;
      organization_count: number;
      role_count: number;
      user_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM organization WHERE id = ANY($1::uuid[])) organization_count,
         (SELECT COUNT(*)::int FROM "user" WHERE id = ANY($2::uuid[])) user_count,
         (SELECT COUNT(*)::int FROM role WHERE id = ANY($3::uuid[])) role_count,
         (SELECT COUNT(*)::int FROM enrollment WHERE id = $4) enrollment_count,
         (
           SELECT COUNT(*)::int
           FROM mentor_capability
           WHERE mentor_profile_id = $5
         ) mentor_capability_count,
         (SELECT COUNT(*)::int FROM mentor_assignment WHERE id = $6) mentor_assignment_count`,
      [
        [SYNTHETIC_IDS.organization, SYNTHETIC_IDS.externalOrganization],
        [
          SYNTHETIC_IDS.adminUser,
          SYNTHETIC_IDS.mentorUser,
          SYNTHETIC_IDS.participantUser,
          SYNTHETIC_IDS.externalParticipantUser,
        ],
        [SYNTHETIC_IDS.adminRole, SYNTHETIC_IDS.mentorRole, SYNTHETIC_IDS.participantRole],
        SYNTHETIC_IDS.enrollment,
        SYNTHETIC_IDS.mentorUser,
        SYNTHETIC_IDS.mentorAssignment,
      ],
    );
    assert.deepEqual(seedShape.rows[0], {
      enrollment_count: 1,
      mentor_capability_count: 2,
      mentor_assignment_count: 1,
      organization_count: 2,
      role_count: 3,
      user_count: 4,
    });

    const admin = await authenticate(baseUrl, SYNTHETIC_EMAILS.admin);
    const listResponse = await fetch(`${baseUrl}/api/v1/admin/users?page=1&limit=20`, {
      headers: {
        cookie: admin.accessCookie,
      },
    });
    assert.equal(listResponse.status, 200);
    const page = (await listResponse.json()) as AdminUserPageResponse;
    assert.deepEqual(page.meta, {
      hasNextPage: false,
      limit: 20,
      page: 1,
      total: 3,
    });
    assert.deepEqual(
      page.data.map((user) => user.id).sort(),
      [SYNTHETIC_IDS.adminUser, SYNTHETIC_IDS.mentorUser, SYNTHETIC_IDS.participantUser].sort(),
    );
    assert.equal(
      page.data.some((user) => user.id === SYNTHETIC_IDS.externalParticipantUser),
      false,
    );

    const externalPatch = await fetch(
      `${baseUrl}/api/v1/admin/users/${SYNTHETIC_IDS.externalParticipantUser}`,
      {
        body: JSON.stringify({
          expectedVersion: 1,
          fullName: 'This must never cross organizations',
        }),
        headers: {
          ...mutationHeaders(admin),
          'content-type': 'application/json',
        },
        method: 'PATCH',
      },
    );
    assert.equal(externalPatch.status, 404);
    const concealedError = (await externalPatch.json()) as ErrorResponse;
    assert.equal(concealedError.error.code, 'RESOURCE_NOT_FOUND');
    assert.equal(concealedError.error.message, 'No encontramos el recurso solicitado.');
    const externalUser = await pool.query<{ full_name: string }>(
      'SELECT full_name FROM "user" WHERE id = $1',
      [SYNTHETIC_IDS.externalParticipantUser],
    );
    assert.equal(externalUser.rows[0]?.full_name, 'Participante Externa Demo');

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/admin/users/${SYNTHETIC_IDS.participantUser}`,
      {
        body: JSON.stringify({
          expectedVersion: 1,
          fullName: 'Participante Actualizada',
          roles: ['PARTICIPANT', 'MENTOR'],
        }),
        headers: {
          ...mutationHeaders(admin),
          'content-type': 'application/json',
        },
        method: 'PATCH',
      },
    );
    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()) as AdminUserResponse;
    assert.equal(updated.fullName, 'Participante Actualizada');
    assert.deepEqual(updated.roles, ['MENTOR', 'PARTICIPANT']);
    assert.equal(updated.version, 2);

    const mentorProfile = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int count FROM mentor_profile WHERE user_id = $1',
      [SYNTHETIC_IDS.participantUser],
    );
    assert.equal(mentorProfile.rows[0]?.count, 1);
    const audit = await pool.query<{
      action: string;
      actor_user_id: string;
      entity_id: string;
    }>(
      `SELECT action, actor_user_id, entity_id
       FROM audit_log
       WHERE organization_id = $1 AND action = 'admin.user_updated'`,
      [SYNTHETIC_IDS.organization],
    );
    assert.deepEqual(audit.rows, [
      {
        action: 'admin.user_updated',
        actor_user_id: SYNTHETIC_IDS.adminUser,
        entity_id: SYNTHETIC_IDS.participantUser,
      },
    ]);

    const staleResponse = await fetch(
      `${baseUrl}/api/v1/admin/users/${SYNTHETIC_IDS.participantUser}`,
      {
        body: JSON.stringify({
          expectedVersion: 1,
          isActive: false,
        }),
        headers: {
          ...mutationHeaders(admin),
          'content-type': 'application/json',
        },
        method: 'PATCH',
      },
    );
    assert.equal(staleResponse.status, 409);
    const staleError = (await staleResponse.json()) as ErrorResponse;
    assert.equal(staleError.error.code, 'VERSION_CONFLICT');
    assert.deepEqual(staleError.error.details, {
      currentVersion: 2,
      expectedVersion: 1,
    });

    const participant = await authenticate(baseUrl, SYNTHETIC_EMAILS.participant);
    const forbiddenList = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: {
        cookie: participant.accessCookie,
      },
    });
    assert.equal(forbiddenList.status, 403);
    assert.equal(((await forbiddenList.json()) as ErrorResponse).error.code, 'FORBIDDEN');
  });
});
