import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ApiError } from '../../common/http/api-error.js';
import { HealthService } from './health.service.js';

interface Probe {
  ping(): Promise<void>;
}

function successfulProbe(): Probe {
  return {
    ping: () => Promise.resolve(),
  };
}

function unavailableProbe(): Probe {
  return {
    ping: () => Promise.reject(new Error('private dependency details')),
  };
}

describe('HealthService', () => {
  it('reports ready only when PostgreSQL and Redis respond', async () => {
    const service = new HealthService(successfulProbe(), successfulProbe());

    await assert.doesNotReject(async () => {
      assert.deepEqual(await service.getReadiness(), {
        dependencies: {
          postgres: 'ok',
          redis: 'ok',
        },
        service: 'api',
        status: 'ok',
      });
    });
  });

  it('returns sanitized dependency states when a dependency is unavailable', async () => {
    const service = new HealthService(unavailableProbe(), successfulProbe());

    await assert.rejects(
      () => service.getReadiness(),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, 'SERVICE_NOT_READY');
        assert.equal(error.getStatus(), 503);
        assert.deepEqual(error.details, {
          dependencies: {
            postgres: 'unavailable',
            redis: 'ok',
          },
        });
        return true;
      },
    );
  });
});
