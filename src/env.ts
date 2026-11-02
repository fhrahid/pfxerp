import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Minimal .env loader (no external dependency).
 * Loads `<project-root>/.env` without overriding variables that are already set.
 */
export function loadEnv(): void {
  const candidates = [resolve(__dirname, '../.env'), resolve(process.cwd(), '.env')];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

if (process.env.NODE_ENV === 'production') {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.LEDGER_SECRET_KEY) {
    throw new Error('JWT_SECRET and LEDGER_SECRET_KEY must be different values');
  }
  for (const key of ['JWT_SECRET', 'LEDGER_SECRET_KEY']) {
    const value = process.env[key];
    if (!value || value.length < 64 || value.startsWith('replace_with_') || value.startsWith('dev_')) {
      throw new Error(`${key} must be set to a unique secret of at least 64 characters in production`);
    }
  }
  if (process.env.AUTO_SEED === 'true' && !process.env.INITIAL_CEO_PASSWORD) {
    throw new Error('INITIAL_CEO_PASSWORD must be set when production auto-seeding is enabled');
  }
}
