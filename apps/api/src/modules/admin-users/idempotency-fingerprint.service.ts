import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';
import type { RoleKey } from '../../generated/prisma/enums.js';
import { deriveKey } from '../auth/crypto/key-derivation.js';

export interface CreateAdminUserFingerprintInput {
  readonly email: string;
  readonly fullName: string;
  readonly roles: readonly RoleKey[];
  readonly temporaryPassword: string;
}

function hmacHex(key: Uint8Array, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

@Injectable()
export class IdempotencyFingerprintService {
  private readonly idempotencyKeyKey: Uint8Array;
  private readonly requestFingerprintKey: Uint8Array;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.idempotencyKeyKey = deriveKey(config.auth.dataPepper, 'idempotency-key');
    this.requestFingerprintKey = deriveKey(config.auth.dataPepper, 'admin-user-create-request');
  }

  hashIdempotencyKey(value: string): string {
    return hmacHex(this.idempotencyKeyKey, value);
  }

  hashCreateAdminUserRequest(input: CreateAdminUserFingerprintInput): string {
    const canonicalPayload = JSON.stringify({
      email: input.email,
      fullName: input.fullName,
      roles: [...input.roles].sort(),
      temporaryPassword: input.temporaryPassword,
    });

    return hmacHex(this.requestFingerprintKey, canonicalPayload);
  }
}
