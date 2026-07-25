import type { AuthenticatedRequest } from '../auth/authenticated-request.js';

export const ACCESS_COOKIE_NAME = 'edu_access';
export const REFRESH_COOKIE_NAME = 'edu_refresh';
export const CSRF_BROWSER_COOKIE_NAME = 'edu_csrf_browser';

export interface CookieResponse {
  append(name: string, value: string): void;
  setHeader(name: string, value: string): void;
}

interface CookieOptions {
  readonly httpOnly: boolean;
  readonly maxAgeSeconds: number;
  readonly path: string;
  readonly secure: boolean;
}

export function getRequestHeader(request: AuthenticatedRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function parseRequestCookies(request: AuthenticatedRequest): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const cookieHeader = getRequestHeader(request, 'cookie');

  if (cookieHeader === undefined) {
    return result;
  }

  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const name = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();

    if (name.length > 0 && !result.has(name)) {
      result.set(name, value);
    }
  }

  return result;
}

export function getRequestIp(request: AuthenticatedRequest): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  return [
    `${name}=${value}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Path=${options.path}`,
    'SameSite=Lax',
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
  ]
    .filter((part) => part.length > 0)
    .join('; ');
}

export function clearCookie(name: string, path: string, secure: boolean): string {
  return [
    `${name}=`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    `Path=${path}`,
    'SameSite=Lax',
    'HttpOnly',
    secure ? 'Secure' : '',
  ]
    .filter((part) => part.length > 0)
    .join('; ');
}
