import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
const integer = (value, fallback, min, max) => {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Invalid numeric configuration: ${value}`);
  return n;
};
export function loadConfig(overrides = {}) {
  const config = {
    mode: process.env.NODE_ENV || 'development',
    port: integer(process.env.PORT, 5000, 1, 65535),
    host: process.env.HOST || '127.0.0.1',
    origins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => new URL(s.trim()).origin),
    databaseMode: process.env.DATABASE_MODE || 'embedded',
    databaseUrl: process.env.DATABASE_URL,
    dataDir: path.resolve(backendRoot, process.env.EMBEDDED_DATA_DIR || '.data/sevasignal'),
    databaseSsl: process.env.DATABASE_SSL === 'true',
    databaseCaFile: process.env.DATABASE_CA_FILE || '',
    sessionHours: integer(process.env.SESSION_TTL_HOURS, 8, 1, 168),
    defaultTtl: integer(process.env.DEFAULT_STATUS_TTL_MINUTES, 60, 1, 240),
    showDemoHelp: process.env.SHOW_DEMO_HELP !== 'false' && process.env.NODE_ENV !== 'production',
    demoPassword: process.env.DEMO_PASSWORD || 'SevaDemo2026!',
    ...overrides,
  };
  if (!['embedded', 'postgres'].includes(config.databaseMode))
    throw new Error('DATABASE_MODE must be embedded or postgres.');
  if (config.mode === 'production' && config.databaseMode === 'embedded')
    throw new Error(
      'Embedded mode is for local development. Use DATABASE_MODE=postgres for a hosted application.',
    );
  if (config.databaseMode === 'postgres' && !config.databaseUrl)
    throw new Error('DATABASE_URL is required in postgres mode.');
  return config;
}
