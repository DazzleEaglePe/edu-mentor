export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

export const LOCAL_DATABASE_URL =
  'postgresql://edu_mentor:local_development_only@localhost:5432/edu_mentor?schema=public';
export const LOCAL_REDIS_URL = 'redis://localhost:6379';

type NodeEnvironment = 'development' | 'production' | 'test';

export interface RuntimeConfig {
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

  return {
    databaseUrl: parseServiceUrl(
      'DATABASE_URL',
      environment.DATABASE_URL,
      LOCAL_DATABASE_URL,
      new Set(['postgres:', 'postgresql:']),
      nodeEnvironment,
    ),
    nodeEnvironment,
    port: parsePort(environment.PORT),
    redisUrl: parseServiceUrl(
      'REDIS_URL',
      environment.REDIS_URL,
      LOCAL_REDIS_URL,
      new Set(['redis:', 'rediss:']),
      nodeEnvironment,
    ),
  };
}
