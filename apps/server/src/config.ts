export interface ServerConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** Directory with the built client; served as static files when present. */
  clientDist: string | null;
  version: string;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Parse and validate configuration from environment variables. Fails fast on bad values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error(`Invalid NODE_ENV "${nodeEnv}"`);
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid PORT "${env.PORT}"`);
  const logLevel = (env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info')) as ServerConfig['logLevel'];
  if (!LOG_LEVELS.includes(logLevel)) throw new Error(`Invalid LOG_LEVEL "${env.LOG_LEVEL}"`);
  return {
    env: nodeEnv,
    host: env.HOST ?? '0.0.0.0',
    port,
    logLevel,
    clientDist: env.CLIENT_DIST ?? null,
    version: env.APP_VERSION ?? '0.1.0',
  };
}
