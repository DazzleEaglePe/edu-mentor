export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

export const LOCAL_DATABASE_URL =
  'postgresql://edu_mentor:local_development_only@localhost:5432/edu_mentor?schema=public';
export const LOCAL_REDIS_URL = 'redis://localhost:6379';
export const LOCAL_AUTH_TOKEN_SECRET = 'ZWR1LW1lbnRvci1sb2NhbC10b2tlbi1zZWNyZXQtdjEhIQ';
export const LOCAL_AUTH_DATA_PEPPER = 'ZWR1LW1lbnRvci1sb2NhbC1kYXRhLXBlcHBlci12MSEh';

type NodeEnvironment = 'development' | 'production' | 'test';

export interface AuthRuntimeConfig {
  readonly accessTokenTtlSeconds: number;
  readonly allowedOrigins: readonly string[];
  readonly cookieSecure: boolean;
  readonly csrfTtlSeconds: number;
  readonly dataPepper: string;
  readonly refreshTokenTtlSeconds: number;
  readonly tokenSecret: string;
  readonly trustProxyHops: number;
}

export interface RuntimeConfig {
  readonly auth: AuthRuntimeConfig;
  readonly databaseUrl: string;
  readonly nodeEnvironment: NodeEnvironment;
  readonly port: number;
  readonly redisUrl: string;
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const nodeEnvironment = value ?? 'development';

  if (
    nodeEnvironment !== 'development' &&
    nodeEnvironment !== 'production' &&
    nodeEnvironment !== 'test'
  ) {
    throw new Error('NODE_ENV must be one of: development, test, production.');
  }

  return nodeEnvironment;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  const resolved = value ?? String(fallback);

  if (resolved === 'true') {
    return true;
  }
  if (resolved === 'false') {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

function parseTrustProxyHops(value: string | undefined): number {
  const trustProxyHops = Number(value ?? 0);

  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 2.');
  }

  return trustProxyHops;
}

function parseBase64UrlSecret(
  name: 'AUTH_TOKEN_SECRET' | 'AUTH_DATA_PEPPER',
  value: string | undefined,
  localFallback: string,
  nodeEnvironment: NodeEnvironment,
): string {
  const resolved = value ?? (nodeEnvironment === 'production' ? undefined : localFallback);

  if (resolved === undefined) {
    throw new Error(`${name} is required in production.`);
  }

  if (!/^[A-Za-z0-9_-]+$/u.test(resolved)) {
    throw new Error(`${name} must be unpadded base64url.`);
  }

  const decoded = Buffer.from(resolved, 'base64url');

  if (decoded.byteLength < 32) {
    throw new Error(`${name} must decode to at least 32 bytes.`);
  }

  if (nodeEnvironment === 'production' && resolved === localFallback) {
    throw new Error(`${name} cannot use the local development value in production.`);
  }

  return resolved;
}

function parseAllowedOrigins(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
): readonly string[] {
  const values = (value ?? (nodeEnvironment === 'production' ? '' : 'http://localhost:3000'))
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (values.length === 0) {
    throw new Error('AUTH_ALLOWED_ORIGINS must contain at least one origin.');
  }

  return values.map((origin) => {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('AUTH_ALLOWED_ORIGINS must contain valid origins.');
    }

    if (parsed.origin !== origin || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      throw new Error('AUTH_ALLOWED_ORIGINS entries must not include paths or credentials.');
    }

    if (nodeEnvironment === 'production' && parsed.protocol !== 'https:') {
      throw new Error('AUTH_ALLOWED_ORIGINS must use HTTPS in production.');
    }

    return parsed.origin;
  });
}

function parseServiceUrl(
  name: 'DATABASE_URL' | 'REDIS_URL',
  value: string | undefined,
  fallback: string,
  allowedProtocols: ReadonlySet<string>,
  nodeEnvironment: NodeEnvironment,
): string {
  const resolved = value ?? (nodeEnvironment === 'production' ? undefined : fallback);

  if (resolved === undefined) {
    throw new Error(`${name} is required in production.`);
  }

  let parsed: URL;

  try {
    parsed = new URL(resolved);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error(`${name} uses an unsupported protocol.`);
  }

  return resolved;
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnvironment = parseNodeEnvironment(environment.NODE_ENV);
  const databaseUrl = parseServiceUrl(
    'DATABASE_URL',
    environment.DATABASE_URL,
    LOCAL_DATABASE_URL,
    new Set(['postgres:', 'postgresql:']),
    nodeEnvironment,
  );
  const redisUrl = parseServiceUrl(
    'REDIS_URL',
    environment.REDIS_URL,
    LOCAL_REDIS_URL,
    new Set(['redis:', 'rediss:']),
    nodeEnvironment,
  );
  const cookieSecure = parseBoolean(
    'AUTH_COOKIE_SECURE',
    environment.AUTH_COOKIE_SECURE,
    nodeEnvironment === 'production',
  );

  if (nodeEnvironment === 'production' && !cookieSecure) {
    throw new Error('AUTH_COOKIE_SECURE must be true in production.');
  }

  return {
    auth: {
      accessTokenTtlSeconds: 15 * 60,
      allowedOrigins: parseAllowedOrigins(environment.AUTH_ALLOWED_ORIGINS, nodeEnvironment),
      cookieSecure,
      csrfTtlSeconds: 60 * 60,
      dataPepper: parseBase64UrlSecret(
        'AUTH_DATA_PEPPER',
        environment.AUTH_DATA_PEPPER,
        LOCAL_AUTH_DATA_PEPPER,
        nodeEnvironment,
      ),
      refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
      tokenSecret: parseBase64UrlSecret(
        'AUTH_TOKEN_SECRET',
        environment.AUTH_TOKEN_SECRET,
        LOCAL_AUTH_TOKEN_SECRET,
        nodeEnvironment,
      ),
      trustProxyHops: parseTrustProxyHops(environment.TRUST_PROXY_HOPS),
    },
    databaseUrl,
    nodeEnvironment,
    port: parsePort(environment.PORT),
    redisUrl,
  };
}
