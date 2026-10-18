import { SavedNeedSchema, type SaveNeedBody, type SavedNeed } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';
import { runIdempotent, type MutationResult } from '../requests/idempotency.js';

export interface NeedsService {
  list(userId: string, opts: PageOptions): Promise<{ items: SavedNeed[]; nextCursor: string | null }>;
  save(userId: string, key: string, body: SaveNeedBody): Promise<MutationResult<SavedNeed>>;
  delete(userId: string, id: string): Promise<void>;
}

function dto(row: { id: string; extraction: unknown; createdAt: Date }) {
  return SavedNeedSchema.parse({
    id: row.id,
    extraction: row.extraction,
    createdAt: row.createdAt.toISOString(),
  });
}

export class PrismaNeedsService implements NeedsService {
  constructor(private readonly db: Db) {}

  async list(userId: string, opts: PageOptions) {
    const rows = await this.db.need.findMany({
      where: { userId, ...beforeCursor(decodeCursor(opts.cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });
    const page = pageRows(rows, opts.limit);
    return { ...page, items: page.items.map(dto) };
  }

  save(userId: string, key: string, body: SaveNeedBody) {
    if (body.extraction.items.length === 0) throw new HttpError('VALIDATION_FAILED', 'Add an item before saving');
    return runIdempotent(this.db, userId, key, 'POST /needs', body, async (tx) => {
      const row = await tx.need.create({ data: { userId, extraction: body.extraction } });
      return { status: 201, body: dto(row) };
    });
  }

  async delete(userId: string, id: string) {
    const result = await this.db.need.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new HttpError('NOT_FOUND', 'Need not found');
  }
}
