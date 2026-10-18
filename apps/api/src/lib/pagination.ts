import { z } from 'zod';
import { HttpError } from './http.js';

export interface PageOptions { cursor?: string; limit: number }
const CursorSchema = z.object({ id: z.uuid(), createdAt: z.iso.datetime() });

export function decodeCursor(value?: string): { id: string; createdAt: Date } | null {
  if (!value) return null;
  try {
    const cursor = CursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return { id: cursor.id, createdAt: new Date(cursor.createdAt) };
  } catch {
    throw new HttpError('VALIDATION_FAILED', 'Invalid page cursor');
  }
}

export function beforeCursor(cursor: ReturnType<typeof decodeCursor>) {
  return cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {};
}

export function pageRows<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() })).toString('base64url')
      : null,
  };
}
