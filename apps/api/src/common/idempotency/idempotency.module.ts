import { Module } from '@nestjs/common';

import { IdempotencyFingerprintService } from './idempotency-fingerprint.service.js';

@Module({
  exports: [IdempotencyFingerprintService],
  providers: [IdempotencyFingerprintService],
})
export class IdempotencyModule {}
