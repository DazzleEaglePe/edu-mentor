import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../../config/runtime-config.js';
import { deriveKey, hmacBase64Url } from './key-derivation.js';

@Injectable()
export class OpaqueTokenService {
  private readonly csrfTokenKey: Uint8Array;
  private readonly ipHashKey: Uint8Array;
  private readonly rateLimitHmacKey: Uint8Array;
  private readonly refreshTokenKey: Uint8Array;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.csrfTokenKey = deriveKey(config.auth.dataPepper, 'csrf-token');
    this.ipHashKey = deriveKey(config.auth.dataPepper, 'ip-hash');
    this.rateLimitHmacKey = deriveKey(config.auth.dataPepper, 'auth-rate-limit');
    this.refreshTokenKey = deriveKey(config.auth.dataPepper, 'refresh-token');
  }

  createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return hmacBase64Url(this.refreshTokenKey, token);
  }

  hashIp(ip: string): string {
    return hmacBase64Url(this.ipHashKey, ip);
  }

  hashCsrfToken(token: string): string {
    return hmacBase64Url(this.csrfTokenKey, token);
  }

  rateLimitKey(value: string): string {
    return hmacBase64Url(this.rateLimitHmacKey, value);
  }
}
