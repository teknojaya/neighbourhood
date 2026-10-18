import { NotificationSchema, type Notification } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';

export interface NotificationsService {
  unread(userId: string): Promise<{ messages: number; updates: number }>;
  list(userId: string, opts: PageOptions): Promise<{ items: Notification[]; nextCursor: string | null }>;
  markRead(userId: string, id: string): Promise<Notification>;
}

const dto = (row: { id: string; userId: string; type: string; title: string; body: string; link: string | null; readAt: Date | null; createdAt: Date }) =>
  NotificationSchema.parse({ ...row, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });

export class PrismaNotificationsService implements NotificationsService {
  constructor(private readonly db: Db) {}
  async unread(userId: string) {
    const [updates, rows] = await Promise.all([
      this.db.notification.count({ where: { userId, readAt: null } }),
      this.db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM messages m
        INNER JOIN conversation_participants p ON p.conversation_id = m.conversation_id
        WHERE p.user_id = ${userId}::uuid AND m.sender_id <> ${userId}::uuid
        AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)`,
    ]);
    return { messages: Number(rows[0]?.count ?? 0), updates };
  }
  async list(userId: string, opts: PageOptions) {
    const rows = await this.db.notification.findMany({
      where: { userId, ...beforeCursor(decodeCursor(opts.cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: opts.limit + 1,
    });
    const page = pageRows(rows, opts.limit);
    return { ...page, items: page.items.map(dto) };
  }
  async markRead(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.notification.findFirst({ where: { id, userId } });
      if (!row) throw new HttpError('NOT_FOUND', 'Notification not found');
      await tx.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
      return dto(await tx.notification.findUniqueOrThrow({ where: { id } }));
    });
  }
}
