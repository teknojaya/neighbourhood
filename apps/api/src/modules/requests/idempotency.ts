import { createHash } from 'node:crypto';
import { IdempotencyKeySchema } from '@neighbourhood/shared';
import type { Request } from 'express';
import type { Db, Tx } from '../../lib/db.js';
import type { Prisma } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';

export interface MutationResult<T> { status: number; body: T }
const TTL_MS = 24 * 60 * 60 * 1000;

export function idempotencyKey(req: Request) {
  const parsed = IdempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
  if (!parsed.success) throw new HttpError('VALIDATION_FAILED', 'A valid Idempotency-Key header is required');
  return parsed.data;
}

// Parsed payloads have defaults applied; sort object keys so JSON order is irrelevant.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The response and all business writes commit together; failures leave no key behind. */
export async function runIdempotent<T>(
  db: Db, userId: string, key: string, scope: string, payload: unknown,
  mutate: (tx: Tx) => Promise<MutationResult<T>>,
): Promise<MutationResult<T>> {
  const requestHash = createHash('sha256').update(canonical({ scope, payload })).digest('hex');
  return db.$transaction(async (tx) => {
    // Serializes simultaneous retries on this user/key across every API instance.
    // Selecting an integer avoids exposing PostgreSQL's void type to Prisma.
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${userId}:${key}`}, 0))`;
    const stored = await tx.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
    if (stored && Date.now() - stored.createdAt.getTime() < TTL_MS) {
      if (stored.requestHash !== requestHash) throw new HttpError('CONFLICT', 'This Idempotency-Key was used for a different request');
      return { status: stored.responseStatus, body: stored.responseBody as T };
    }
    if (stored) await tx.idempotencyKey.delete({ where: { userId_key: { userId, key } } });
    const result = await mutate(tx);
    await tx.idempotencyKey.create({
      data: { userId, key, requestHash, responseStatus: result.status, responseBody: result.body as Prisma.InputJsonValue },
    });
    return result;
  }, { maxWait: 10_000, timeout: 15_000 });
}
