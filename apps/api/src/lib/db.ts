import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { databasePoolMax } from './db-url.js';

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
export { Prisma };
export { databasePoolMax, isLoopbackDatabaseUrl } from './db-url.js';

/** Creates the Prisma client over node-postgres (Prisma 7 driver adapter). */
export function createDb(connectionString: string, max = databasePoolMax()): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

/** PostgreSQL error code of a failed query, if any (e.g. 23505, 23P01). */
export function pgErrorCode(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return '23505';
    const meta = err.meta as { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string } } } | undefined;
    return meta?.driverAdapterError?.cause?.originalCode ?? meta?.code;
  }
  const e = err as { code?: unknown; cause?: { code?: unknown; originalCode?: unknown } };
  if (typeof e?.cause?.originalCode === 'string') return e.cause.originalCode;
  if (typeof e?.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
  return undefined;
}
