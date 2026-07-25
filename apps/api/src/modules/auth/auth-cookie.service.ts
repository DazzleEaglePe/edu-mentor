import { Inject, Injectable } from '@nestjs/common';

import {
  ACCESS_COOKIE_NAME,
  clearCookie,
  CSRF_BROWSER_COOKIE_NAME,
  type CookieResponse,
  REFRESH_COOKIE_NAME,
  serializeCookie,
} from '../../common/http/cookies.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';
import type { CsrfChallenge } from './security/csrf.service.js';

const AUTH_PATH = '/api/v1/auth';
const API_PATH = '/api/v1';

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

@Injectable()
export class AuthCookieService {
  private readonly accessTokenTtlSeconds: number;
  private readonly cookieSecure: boolean;
  private readonly refreshTokenTtlSeconds: number;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.accessTokenTtlSeconds = config.auth.accessTokenTtlSeconds;
    this.cookieSecure = config.auth.cookieSecure;
    this.refreshTokenTtlSeconds = config.auth.refreshTokenTtlSeconds;
  }

  setAuthCookies(response: CookieResponse, tokens: AuthTokens): void {
    response.append(
      'Set-Cookie',
      serializeCookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
        httpOnly: true,
        maxAgeSeconds: this.accessTokenTtlSeconds,
        path: '/',
        secure: this.cookieSecure,
      }),
    );
    response.append(
      'Set-Cookie',
      serializeCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
        httpOnly: true,
        maxAgeSeconds: this.refreshTokenTtlSeconds,
        path: AUTH_PATH,
        secure: this.cookieSecure,
      }),
    );
    this.disableCaching(response);
  }

  setCsrfBrowserCookie(response: CookieResponse, challenge: CsrfChallenge): void {
    response.append(
      'Set-Cookie',
      serializeCookie(CSRF_BROWSER_COOKIE_NAME, challenge.browserId, {
        httpOnly: true,
        maxAgeSeconds: challenge.ttlSeconds,
        path: API_PATH,
        secure: this.cookieSecure,
      }),
    );
    this.disableCaching(response);
  }

  clearAuthCookies(response: CookieResponse): void {
    response.append('Set-Cookie', clearCookie(ACCESS_COOKIE_NAME, '/', this.cookieSecure));
    response.append('Set-Cookie', clearCookie(REFRESH_COOKIE_NAME, AUTH_PATH, this.cookieSecure));
    this.disableCaching(response);
  }

  disableCaching(response: CookieResponse): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }
}
