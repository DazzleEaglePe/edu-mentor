import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request.js';
import {
  CSRF_BROWSER_COOKIE_NAME,
  getRequestHeader,
  parseRequestCookies,
} from '../../../common/http/cookies.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../../../config/runtime-config.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { OpaqueTokenService } from '../crypto/opaque-token.service.js';

const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_KEY_PREFIX = 'auth:csrf:';
const TOKEN_BYTES = 32;

export interface CsrfChallenge {
  readonly browserId: string;
  readonly csrfToken: string;
  readonly ttlSeconds: number;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  return (
    leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer)
  );
}

@Injectable()
export class CsrfService {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly ttlSeconds: number;

  constructor(
    @Inject(RUNTIME_CONFIG) config: RuntimeConfig,
    @Inject(OpaqueTokenService) private readonly opaqueTokens: OpaqueTokenService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {
    this.allowedOrigins = new Set(config.auth.allowedOrigins);
    this.ttlSeconds = config.auth.csrfTtlSeconds;
  }

  async issue(): Promise<CsrfChallenge> {
    const browserId = randomBytes(TOKEN_BYTES).toString('base64url');
    const csrfToken = randomBytes(TOKEN_BYTES).toString('base64url');

    await this.redis.setExpiring(
      this.keyForBrowser(browserId),
      this.opaqueTokens.hashCsrfToken(csrfToken),
      this.ttlSeconds,
    );

    return {
      browserId,
      csrfToken,
      ttlSeconds: this.ttlSeconds,
    };
  }

  async validate(request: AuthenticatedRequest): Promise<boolean> {
    if (!this.hasTrustedOrigin(request)) {
      return false;
    }

    const browserId = parseRequestCookies(request).get(CSRF_BROWSER_COOKIE_NAME);
    const csrfToken = getRequestHeader(request, CSRF_HEADER_NAME);

    if (
      browserId === undefined ||
      csrfToken === undefined ||
      browserId.length > 128 ||
      csrfToken.length > 128
    ) {
      return false;
    }

    const expected = await this.redis.get(this.keyForBrowser(browserId));

    return expected !== null && safeEqual(expected, this.opaqueTokens.hashCsrfToken(csrfToken));
  }

  private hasTrustedOrigin(request: AuthenticatedRequest): boolean {
    const fetchSite = getRequestHeader(request, 'sec-fetch-site');

    if (fetchSite === 'cross-site') {
      return false;
    }

    const origin = getRequestHeader(request, 'origin');

    if (origin !== undefined) {
      return this.allowedOrigins.has(origin);
    }

    const referer = getRequestHeader(request, 'referer');

    if (referer === undefined) {
      return false;
    }

    try {
      return this.allowedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  private keyForBrowser(browserId: string): string {
    return `${CSRF_KEY_PREFIX}${this.opaqueTokens.rateLimitKey(browserId)}`;
  }
}
