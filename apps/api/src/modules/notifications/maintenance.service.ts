import type { Db } from '../../lib/db.js';
import { DonationRequestsStore } from '../requests/requests.store.js';
import type { PushSender } from './push.adapter.js';
import { logger } from '../../lib/logger.js';

export class MaintenanceService {
  constructor(private readonly db: Db, private readonly push: PushSender | null) {}
  async expireRequests() {
    const candidates = await this.db.donationRequest.findMany({ where: { status: 'approved', pickupBy: { lte: new Date() } }, take: 100 });
    let expired = 0;
    for (const candidate of candidates) {
      await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM donation_requests WHERE id = ${candidate.id}::uuid FOR UPDATE`;
        const row = await tx.donationRequest.findUniqueOrThrow({ where: { id: candidate.id } });
        if (row.status !== 'approved' || !row.pickupBy || row.pickupBy > new Date()) return;
        await new DonationRequestsStore(this.db).transitionInTransaction(tx, row.id, 'system', 'expired');
        await tx.notification.createMany({ data: [row.ownerId, row.requesterId].map(userId => ({ userId, type: 'request_expired', title: 'Pickup window expired', body: 'An item request expired and its stock was released.', link: `/activity?request=${row.id}` })) });
        expired++;
      });
    }
    return expired;
  }
  async deliverPush() {
    if (!this.push) return 0;
    const claimed = await this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM notifications WHERE push_sent_at IS NULL AND push_attempts < 5 AND next_push_at <= now() AND (push_started_at IS NULL OR push_started_at < now() - interval '2 minutes') ORDER BY next_push_at LIMIT 20 FOR UPDATE SKIP LOCKED`;
      await tx.notification.updateMany({ where: { id: { in: rows.map(r => r.id) } }, data: { pushStartedAt: new Date(), pushAttempts: { increment: 1 } } });
      return tx.notification.findMany({ where: { id: { in: rows.map(r => r.id) } } });
    });
    let delivered = 0;
    for (const row of claimed) {
      try {
        const tokens = row.readAt ? [] : (await this.db.pushToken.findMany({ where: { userId: row.userId }, take: 20 })).map(t => t.token);
        const result = await this.push.send(tokens, { title: 'NeighbourHood update', body: 'You have an update. Open your inbox to view it.', link: row.link?.startsWith('/') && !row.link.startsWith('//') ? row.link : '/notifications' });
        await this.db.pushToken.deleteMany({ where: { userId: row.userId, token: { in: result.invalidTokens } } });
        if (result.successCount < tokens.length - result.invalidTokens.length) throw new Error('Partial push delivery');
        await this.db.notification.update({ where: { id: row.id }, data: { pushSentAt: new Date(), pushStartedAt: null } });
        delivered++;
      } catch {
        logger.warn('push_delivery_retry', { notificationId: row.id });
        await this.db.notification.update({ where: { id: row.id }, data: { pushStartedAt: null, nextPushAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** row.pushAttempts) * 1000) } });
      }
    }
    return delivered;
  }
  async run() { return { expired: await this.expireRequests(), pushed: await this.deliverPush() }; }
}
