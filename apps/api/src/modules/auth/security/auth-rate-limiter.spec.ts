import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ApiError } from '../../../common/http/api-error.js';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import type { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { OpaqueTokenService } from '../crypto/opaque-token.service.js';
import { AuthRateLimiter } from './auth-rate-limiter.js';

class CountingRedis {
  readonly counts = new Map<string, number>();

  delete(key: string): Promise<void> {
    this.counts.delete(key);
    return Promise.resolve();
  }

  incrementWithExpiry(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return Promise.resolve(next);
  }
}

describe('AuthRateLimiter', () => {
  it('limits an email/IP pair without storing either value in Redis keys', async () => {
    const config = loadRuntimeConfig({ NODE_ENV: 'test' });
    const redis = new CountingRedis();
    const limiter = new AuthRateLimiter(
      new OpaqueTokenService(config),
      redis as unknown as RedisService,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.consume('203.0.113.10', 'person@example.test');
    }

    await assert.rejects(
      () => limiter.consume('203.0.113.10', 'person@example.test'),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.getStatus(), 429);
        assert.equal(error.code, 'LOGIN_RATE_LIMITED');
        return true;
      },
    );

    for (const key of redis.counts.keys()) {
      assert.doesNotMatch(key, /203\.0\.113\.10|person@example\.test/u);
    }
  });
});
