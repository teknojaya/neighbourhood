import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isLoopbackDatabaseUrl } from '../lib/db-url.js';

/** Never migrate or reset the application database from a test run. */
export function testDatabaseUrl() {
  try { process.loadEnvFile('.env'); } catch { /* CI may supply variables directly. */ }
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('Set TEST_DATABASE_URL to a local PostgreSQL database ending in _test.');
  const url = new URL(value);
  if (!isLoopbackDatabaseUrl(value) || !url.pathname.endsWith('_test')) {
    throw new Error('Database tests require a loopback host and a database name ending in _test.');
  }
  if (process.env.DATABASE_URL) {
    const app = new URL(process.env.DATABASE_URL);
    if (url.host === app.host && url.pathname === app.pathname) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
  }
  return value;
}

export default function setup() {
  const url = testDatabaseUrl();
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit', timeout: 60_000,
  });
}
