import { NotificationSchema, type Notification } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';

export interface NotificationsService {
  list(userId: string, opts: PageOptions): Promise<{ items: Notification[]; nextCursor: string | null }>;
  markRead(userId: string, id: string): Promise<Notification>;
}

const dto = (row: { id: string; userId: string; type: string; title: string; body: string; link: string | null; readAt: Date | null; createdAt: Date }) =>
  NotificationSchema.parse({ ...row, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });

export class PrismaNotificationsService implements NotificationsService {
  constructor(private readonly db: Db) {}
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
