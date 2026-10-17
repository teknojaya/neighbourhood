import { DomainError } from '@neighbourhood/shared';
import type { Db, Tx } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows } from '../../lib/pagination.js';

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
    return this.db.$transaction((tx) => this.sendInTransaction(tx, conversationId, senderId, body));
  }

  async sendInTransaction(tx: Tx, conversationId: string, senderId: string, body: string) {
    const text = body.trim();
    if (text.length === 0 || text.length > 2000) throw new DomainError('BAD_REQUEST', 'Message must be 1–2000 characters');
    const conv = await tx.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId: senderId } } }, select: { id: true },
    });
    if (!conv) throw new HttpError('NOT_FOUND', 'Conversation not found');
    return this.appendStatusNoteInTransaction(tx, conversationId, senderId, text);
  }

  /** Call only after request/loan authorization; allows a handover volunteer's note. */
  async appendStatusNoteInTransaction(tx: Tx, conversationId: string, senderId: string, text: string) {
    await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
    const conv = await tx.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { closed: true, lastMessageAt: true } });
    if (conv.closed) throw new DomainError('CONFLICT', 'This conversation is closed');
    // Strictly increasing per conversation, including sends that waited for a lock.
    const createdAt = new Date(Math.max(Date.now(), (conv.lastMessageAt?.getTime() ?? 0) + 1));
    const msg = await tx.message.create({ data: { conversationId, senderId, body: text, createdAt } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.createdAt } });
    return msg;
  }

  /** Newest first, keyset pagination on (created_at, id). */
  async listMessages(conversationId: string, userId: string, opts: { cursor?: string; limit: number }): Promise<MessagePage> {
    const member = await this.db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new HttpError('NOT_FOUND', 'Conversation not found');
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
    const rows = await this.db.message.findMany({
      where: {
        conversationId,
        ...beforeCursor(cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });
    const page = pageRows(rows, opts.limit);
    return {
      items: page.items.map((m) => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() })),
      nextCursor: page.nextCursor,
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
