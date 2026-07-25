import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';
import { deriveKey } from '../../modules/auth/crypto/key-derivation.js';

function hmacHex(key: Uint8Array, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

@Injectable()
export class IdempotencyFingerprintService {
  private readonly dataPepper: string;
  private readonly idempotencyKeyKey: Uint8Array;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.dataPepper = config.auth.dataPepper;
    this.idempotencyKeyKey = deriveKey(config.auth.dataPepper, 'idempotency-key');
  }

  hashIdempotencyKey(value: string): string {
    return hmacHex(this.idempotencyKeyKey, value);
  }

  hashRequest(operation: string, canonicalPayload: Readonly<Record<string, unknown>>): string {
    const requestFingerprintKey = deriveKey(this.dataPepper, `idempotency-request/${operation}`);
    return hmacHex(requestFingerprintKey, JSON.stringify(canonicalPayload));
  }
}
