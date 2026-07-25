import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOCAL_AUTH_DATA_PEPPER,
  LOCAL_AUTH_TOKEN_SECRET,
  loadRuntimeConfig,
} from '../../../config/runtime-config.js';
import { AccessTokenService } from './access-token.service.js';

const NOW = new Date('2026-07-25T12:00:00.000Z');
const USER_ID = '00000000-0000-4000-8000-000000000101';
const SESSION_ID = '00000000-0000-4000-8000-000000000102';

function makeService(tokenSecret = LOCAL_AUTH_TOKEN_SECRET): AccessTokenService {
  return new AccessTokenService(
    loadRuntimeConfig({
      AUTH_DATA_PEPPER: LOCAL_AUTH_DATA_PEPPER,
      AUTH_TOKEN_SECRET: tokenSecret,
      NODE_ENV: 'test',
    }),
  );
}

describe('AccessTokenService', () => {
  it('issues a pinned access-token profile and verifies its identity claims', async () => {
    const service = makeService();
    const token = await service.issue(USER_ID, SESSION_ID, NOW);

    assert.deepEqual(await service.verify(token, NOW), {
      sessionId: SESSION_ID,
      userId: USER_ID,
    });
  });

  it('rejects expired, oversized, and differently signed tokens', async () => {
    const service = makeService();
    const token = await service.issue(USER_ID, SESSION_ID, NOW);
    const anotherKey = Buffer.alloc(32, 0xc3).toString('base64url');

    assert.equal(await service.verify(token, new Date(NOW.getTime() + 906_000)), null);
    assert.equal(await makeService(anotherKey).verify(token, NOW), null);
    assert.equal(await service.verify('x'.repeat(4097), NOW), null);
  });
});
