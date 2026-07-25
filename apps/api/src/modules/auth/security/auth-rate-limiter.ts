import { Inject, Injectable } from '@nestjs/common';

import { ApiError } from '../../../common/http/api-error.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { OpaqueTokenService } from '../crypto/opaque-token.service.js';

const WINDOW_SECONDS = 15 * 60;
const EMAIL_AND_IP_LIMIT = 5;
const IP_LIMIT = 30;
const KEY_PREFIX = 'auth:login:';

@Injectable()
export class AuthRateLimiter {
  constructor(
    @Inject(OpaqueTokenService) private readonly opaqueTokens: OpaqueTokenService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async consume(ip: string, normalizedEmail: string): Promise<void> {
    const combinedKey = this.combinedKey(ip, normalizedEmail);
    const ipKey = this.ipKey(ip);
    const [combinedCount, ipCount] = await Promise.all([
      this.redis.incrementWithExpiry(combinedKey, WINDOW_SECONDS),
      this.redis.incrementWithExpiry(ipKey, WINDOW_SECONDS),
    ]);

    if (combinedCount > EMAIL_AND_IP_LIMIT || ipCount > IP_LIMIT) {
      throw new ApiError(
        429,
        'LOGIN_RATE_LIMITED',
        'Recibimos demasiados intentos. Intenta más tarde.',
      );
    }
  }

  async resetSuccessfulLogin(ip: string, normalizedEmail: string): Promise<void> {
    await this.redis.delete(this.combinedKey(ip, normalizedEmail));
  }

  private combinedKey(ip: string, normalizedEmail: string): string {
    return `${KEY_PREFIX}pair:${this.opaqueTokens.rateLimitKey(`${ip}|${normalizedEmail}`)}`;
  }

  private ipKey(ip: string): string {
    return `${KEY_PREFIX}ip:${this.opaqueTokens.rateLimitKey(ip)}`;
  }
}
