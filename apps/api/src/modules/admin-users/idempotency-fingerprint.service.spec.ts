import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { IdempotencyFingerprintService } from './idempotency-fingerprint.service.js';

describe('IdempotencyFingerprintService', () => {
  const fingerprints = new IdempotencyFingerprintService(
    loadRuntimeConfig({
      NODE_ENV: 'test',
    }),
  );

  it('canonicalizes semantically unordered roles without retaining plaintext', () => {
    const first = fingerprints.hashCreateAdminUserRequest({
      email: 'mentor@example.test',
      fullName: 'Mentor',
      roles: ['MENTOR', 'PARTICIPANT'],
      temporaryPassword: 'Temporary-2026!',
    });
    const reordered = fingerprints.hashCreateAdminUserRequest({
      email: 'mentor@example.test',
      fullName: 'Mentor',
      roles: ['PARTICIPANT', 'MENTOR'],
      temporaryPassword: 'Temporary-2026!',
    });
    const changedPassword = fingerprints.hashCreateAdminUserRequest({
      email: 'mentor@example.test',
      fullName: 'Mentor',
      roles: ['MENTOR', 'PARTICIPANT'],
      temporaryPassword: 'Different-2026!',
    });

    assert.equal(first, reordered);
    assert.notEqual(first, changedPassword);
    assert.match(first, /^[a-f0-9]{64}$/u);
    assert.equal(first.includes('Temporary'), false);
  });

  it('uses a separate domain for idempotency keys', () => {
    const keyHash = fingerprints.hashIdempotencyKey('admin-user-lifecycle-0001');
    const requestHash = fingerprints.hashCreateAdminUserRequest({
      email: 'mentor@example.test',
      fullName: 'Mentor',
      roles: ['MENTOR'],
      temporaryPassword: 'admin-user-lifecycle-0001',
    });

    assert.notEqual(keyHash, requestHash);
    assert.match(keyHash, /^[a-f0-9]{64}$/u);
  });
});
