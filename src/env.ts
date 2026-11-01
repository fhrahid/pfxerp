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
