/** Dependency-free database URL helpers (safe for test setup and scripts). */

/**
 * Connections per process. Cloud SQL caps total connections, so keep
 * (max instances × pool) + jobs below the instance limit.
 */
export function databasePoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DATABASE_POOL_MAX?.trim();
  if (!raw) return 10;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('DATABASE_POOL_MAX must be an integer from 1 to 100');
  return value;
}

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]', '::1'];

/**
 * True only for a TCP connection to this machine. A Cloud SQL socket URL
 * (`@localhost/db?host=/cloudsql/...`) has a localhost hostname but is remote.
 * A Cloud SQL Auth Proxy on 127.0.0.1 cannot be detected here.
 */
export function isLoopbackDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !LOOPBACK.includes(url.hostname)) return false;
  const hosts = url.searchParams.getAll('host');
  return hosts.every(host => LOOPBACK.includes(host));
}
