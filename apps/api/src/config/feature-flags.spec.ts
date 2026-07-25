import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadFeatureFlags } from './feature-flags.js';

describe('loadFeatureFlags', () => {
  it('keeps every feature disabled unless explicitly enabled', () => {
    assert.deepEqual(loadFeatureFlags({}), {
      agenda: false,
      deliverables: false,
    });
  });

  it('accepts normalized boolean values', () => {
    assert.deepEqual(
      loadFeatureFlags({
        FEATURE_AGENDA: 'true',
        FEATURE_DELIVERABLES: '0',
      }),
      {
        agenda: true,
        deliverables: false,
      },
    );
  });

  it('rejects ambiguous values', () => {
    assert.throws(
      () => loadFeatureFlags({ FEATURE_AGENDA: 'yes' }),
      /FEATURE_AGENDA must be one of/,
    );
  });
});
