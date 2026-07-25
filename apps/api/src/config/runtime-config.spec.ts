import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOCAL_AUTH_DATA_PEPPER,
  LOCAL_AUTH_TOKEN_SECRET,
  LOCAL_DATABASE_URL,
  LOCAL_REDIS_URL,
  loadRuntimeConfig,
} from './runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('uses local-only defaults outside production', () => {
    assert.deepEqual(loadRuntimeConfig({}), {
      auth: {
        accessTokenTtlSeconds: 900,
        allowedOrigins: ['http://localhost:3000'],
        cookieSecure: false,
        csrfTtlSeconds: 3600,
        dataPepper: LOCAL_AUTH_DATA_PEPPER,
        refreshTokenTtlSeconds: 604800,
        tokenSecret: LOCAL_AUTH_TOKEN_SECRET,
        trustProxyHops: 0,
      },
      databaseUrl: LOCAL_DATABASE_URL,
      nodeEnvironment: 'development',
      port: 3001,
      redisUrl: LOCAL_REDIS_URL,
    });
  });

  it('requires explicit service URLs in production', () => {
    assert.throws(
      () => loadRuntimeConfig({ NODE_ENV: 'production' }),
      /DATABASE_URL is required in production/,
    );
  });

  it('rejects invalid ports and unsupported URL protocols', () => {
    assert.throws(() => loadRuntimeConfig({ PORT: '70000' }), /PORT must be an integer/);
    assert.throws(
      () => loadRuntimeConfig({ DATABASE_URL: 'https://database.example.test' }),
      /DATABASE_URL uses an unsupported protocol/,
    );
    assert.throws(
      () => loadRuntimeConfig({ REDIS_URL: 'http://cache.example.test' }),
      /REDIS_URL uses an unsupported protocol/,
    );
  });

  it('accepts TLS Redis and PostgreSQL URLs without exposing them in errors', () => {
    const config = loadRuntimeConfig({
      AUTH_ALLOWED_ORIGINS: 'https://mentor.example.test',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_DATA_PEPPER: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      AUTH_TOKEN_SECRET: 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
      DATABASE_URL: 'postgresql://service:secret@database.example.test:5432/app',
      NODE_ENV: 'production',
      PORT: '8080',
      REDIS_URL: 'rediss://service:secret@cache.example.test:6380',
    });

    assert.equal(config.port, 8080);
    assert.equal(config.nodeEnvironment, 'production');
    assert.deepEqual(config.auth.allowedOrigins, ['https://mentor.example.test']);
    assert.equal(config.auth.cookieSecure, true);
    assert.match(config.databaseUrl, /^postgresql:/u);
    assert.match(config.redisUrl, /^rediss:/u);
  });

  it('rejects weak auth secrets and insecure production origins', () => {
    assert.throws(
      () => loadRuntimeConfig({ AUTH_TOKEN_SECRET: 'too-short' }),
      /AUTH_TOKEN_SECRET must decode to at least 32 bytes/,
    );
    assert.throws(
      () =>
        loadRuntimeConfig({
          AUTH_ALLOWED_ORIGINS: 'http://mentor.example.test',
          AUTH_COOKIE_SECURE: 'true',
          AUTH_DATA_PEPPER: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
          AUTH_TOKEN_SECRET: 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
          DATABASE_URL: 'postgresql://database.example.test/app',
          NODE_ENV: 'production',
          REDIS_URL: 'rediss://cache.example.test',
        }),
      /AUTH_ALLOWED_ORIGINS must use HTTPS/,
    );
  });
});
