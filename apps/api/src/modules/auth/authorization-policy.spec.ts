import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { AuthorizationPolicy } from './authorization-policy.js';

const PRINCIPAL: AuthPrincipal = {
  activeEnrollment: null,
  email: 'participant@example.test',
  fullName: 'Synthetic Participant',
  mentorCapabilities: [],
  mustChangePassword: false,
  organization: {
    id: '00000000-0000-4000-8000-000000000201',
    name: 'Synthetic Organization',
  },
  roles: ['PARTICIPANT'],
  sessionId: '00000000-0000-4000-8000-000000000202',
  userId: '00000000-0000-4000-8000-000000000203',
};

function assertHiddenResource(error: unknown): boolean {
  assert.ok(error instanceof ApiError);
  assert.equal(error.getStatus(), 404);
  assert.equal(error.code, 'RESOURCE_NOT_FOUND');
  return true;
}

describe('AuthorizationPolicy', () => {
  const policy = new AuthorizationPolicy();

  it('conceals resources from another organization', () => {
    policy.assertSameOrganization(PRINCIPAL, PRINCIPAL.organization.id);
    assert.throws(
      () => policy.assertSameOrganization(PRINCIPAL, '00000000-0000-4000-8000-000000000299'),
      assertHiddenResource,
    );
  });

  it('allows self-service or an explicitly permitted role and conceals everyone else', () => {
    policy.assertSelfOrRole(PRINCIPAL, PRINCIPAL.userId, ['ADMIN']);
    policy.assertSelfOrRole(
      { ...PRINCIPAL, roles: ['ADMIN'] },
      '00000000-0000-4000-8000-000000000299',
      ['ADMIN'],
    );
    assert.throws(
      () => policy.assertSelfOrRole(PRINCIPAL, '00000000-0000-4000-8000-000000000299', ['ADMIN']),
      assertHiddenResource,
    );
  });
});
