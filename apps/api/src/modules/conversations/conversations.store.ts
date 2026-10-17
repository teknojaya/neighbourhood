import { DomainError } from '@neighbourhood/shared';
import type { Db, Tx } from '../../lib/db.js';

export interface MessagePage {
  items: Array<{ id: string; conversationId: string; senderId: string; body: string; createdAt: string }>;
  nextCursor: string | null;
}

/**
 * Private request/loan-linked chat in PostgreSQL. Participants are copied
 * from the request/loan record at creation; clients never choose them.
 * Non-participants get NOT_FOUND-equivalent errors (no existence leaks).
 */
export class ConversationsStore {
  constructor(private readonly db: Db) {}

  /** Idempotent: one conversation per donation request. Call inside the creating transaction. */
  async ensureForDonationRequest(tx: Tx, requestId: string) {
    const req = await tx.donationRequest.findUniqueOrThrow({ where: { id: requestId }, select: { ownerId: true, requesterId: true } });
    return tx.conversation.upsert({
      where: { donationRequestId: requestId },
      update: {},
      create: {
        donationRequestId: requestId,
        participants: { create: [{ userId: req.ownerId }, { userId: req.requesterId }] },
      },
    });
  }

  async ensureForLoan(tx: Tx, loanId: string) {
    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, select: { ownerId: true, borrowerId: true } });
    return tx.conversation.upsert({
      where: { loanId },
      update: {},
      create: { loanId, participants: { create: [{ userId: loan.ownerId }, { userId: loan.borrowerId }] } },
    });
  }

  async send(conversationId: string, senderId: string, body: string) {
    const text = body.trim();
    if (text.length === 0 || text.length > 2000) throw new DomainError('BAD_REQUEST', 'Message must be 1–2000 characters');
    return this.db.$transaction(async (tx) => {
      const conv = await tx.conversation.findFirst({
        where: { id: conversationId, participants: { some: { userId: senderId } } },
        select: { id: true, closed: true },
      });
      if (!conv) throw new DomainError('FORBIDDEN', 'Conversation not found');
      if (conv.closed) throw new DomainError('CONFLICT', 'This conversation is closed');
      const msg = await tx.message.create({ data: { conversationId, senderId, body: text } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.createdAt } });
      return msg;
    });
  }

  /** Newest first, keyset pagination on (created_at, id). */
  async listMessages(conversationId: string, userId: string, opts: { cursor?: string; limit: number }): Promise<MessagePage> {
    const member = await this.db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new DomainError('FORBIDDEN', 'Conversation not found');
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
    const rows = await this.db.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });
    const page = rows.slice(0, opts.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((m) => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() })),
      nextCursor: rows.length > opts.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  listForUser(userId: string, limit = 20) {
    return this.db.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
    });
  }
}

const encodeCursor = (createdAt: Date, id: string) => Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
function decodeCursor(c: string): { createdAt: Date; id: string } {
  const [ts, id] = Buffer.from(c, 'base64url').toString().split('|');
  const createdAt = new Date(ts ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw new DomainError('BAD_REQUEST', 'Invalid cursor');
  return { createdAt, id };
}
