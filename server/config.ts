import fs from 'node:fs';
import path from 'node:path';

export type Environment = 'development' | 'test' | 'production';

export interface AppConfig {
  databasePath: string;
  environment: Environment;
  port: number;
}

const allowedEnvironments = new Set<Environment>(['development', 'test', 'production']);

export function loadLocalEnvironment(filePath = path.resolve(process.cwd(), '.env')): void {
  if (fs.existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = env.NODE_ENV ?? 'development';
  if (!allowedEnvironments.has(environment as Environment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = env.PORT ?? '3001';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('PORT must be an integer from 0 through 65535.');
  }

  const configuredDatabasePath = env.DATABASE_PATH ?? 'data/frontier.sqlite';
  const databasePath = path.resolve(process.cwd(), configuredDatabasePath);

  return {
    databasePath,
    environment: environment as Environment,
    port,
  };
}
