import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import { CSRF_BROWSER_COOKIE_NAME } from '../../../common/http/cookies.js';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import type { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { OpaqueTokenService } from '../crypto/opaque-token.service.js';
import { CsrfService } from './csrf.service.js';

class MemoryRedis {
  readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  setExpiring(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

function request(
  browserId: string,
  csrfToken: string,
  headers: Record<string, string> = {},
): AuthenticatedRequest {
  return {
    headers: {
      cookie: `${CSRF_BROWSER_COOKIE_NAME}=${browserId}`,
      origin: 'http://localhost:3000',
      'x-csrf-token': csrfToken,
      ...headers,
    },
    method: 'POST',
  };
}

describe('CsrfService', () => {
  it('accepts only a matching stateful challenge from an allowed same-site origin', async () => {
    const config = loadRuntimeConfig({ NODE_ENV: 'test' });
    const redis = new MemoryRedis();
    const service = new CsrfService(
      config,
      new OpaqueTokenService(config),
      redis as unknown as RedisService,
    );
    const challenge = await service.issue();

    assert.equal(await service.validate(request(challenge.browserId, challenge.csrfToken)), true);
    assert.equal(await service.validate(request(challenge.browserId, 'incorrect-token')), false);
    assert.equal(
      await service.validate(
        request(challenge.browserId, challenge.csrfToken, {
          origin: 'https://attacker.example.test',
        }),
      ),
      false,
    );
    assert.equal(
      await service.validate(
        request(challenge.browserId, challenge.csrfToken, {
          'sec-fetch-site': 'cross-site',
        }),
      ),
      false,
    );
  });
});
