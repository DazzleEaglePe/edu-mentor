import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  it('uses the approved scrypt profile with a unique salt and verifies safely', async () => {
    const hasher = new PasswordHasher();
    const first = await hasher.hash('A-valid-passphrase-01');
    const second = await hasher.hash('A-valid-passphrase-01');

    assert.match(first, /^scrypt\$v=1\$N=131072,r=8,p=1\$/u);
    assert.notEqual(first, second);
    assert.equal(await hasher.verify('A-valid-passphrase-01', first), true);
    assert.equal(await hasher.verify('A-different-passphrase', first), false);
    assert.equal(await hasher.verify('A-valid-passphrase-01', 'malformed'), false);
  });
});
