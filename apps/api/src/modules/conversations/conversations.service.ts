import { ConversationSchema, MessageSchema, type Conversation, type Message } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';
import { runIdempotent, type MutationResult } from '../requests/idempotency.js';
import { ConversationsStore, type MessagePage } from './conversations.store.js';

export interface ConversationsService {
  get(userId: string, conversationId: string): Promise<Conversation>;
  list(userId: string, opts: PageOptions): Promise<{ items: Conversation[]; nextCursor: string | null }>;
  messages(userId: string, conversationId: string, opts: PageOptions): Promise<MessagePage>;
  send(userId: string, key: string, conversationId: string, body: string): Promise<MutationResult<Message>>;
  markRead(userId: string, conversationId: string, throughMessageId: string): Promise<void>;
}

export class PrismaConversationsService implements ConversationsService {
  private readonly store: ConversationsStore;
  constructor(private readonly db: Db) { this.store = new ConversationsStore(db); }

  async get(userId: string, id: string) {
    const row = await this.db.conversation.findFirst({
      where: { id, participants: { some: { userId } } },
      include: { participants: true, donationRequest: { select: { listing: { select: { title: true } } } }, loan: { select: { listing: { select: { title: true } } } } },
    });
    if (!row) throw new HttpError('NOT_FOUND', 'Conversation not found');
    return ConversationSchema.parse({
      id: row.id, subject: row.donationRequestId ? { kind: 'donation_request', requestId: row.donationRequestId } : { kind: 'loan', loanId: row.loanId },
      participantIds: row.participants.map((p) => p.userId),
      listingTitle: (row.donationRequest ?? row.loan)?.listing.title,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), closed: row.closed,
    });
  }

  async list(userId: string, opts: PageOptions) {
    const rows = await this.db.conversation.findMany({
      where: { participants: { some: { userId } }, ...beforeCursor(decodeCursor(opts.cursor)) },
      include: { participants: true, donationRequest: { select: { listing: { select: { title: true } } } }, loan: { select: { listing: { select: { title: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: opts.limit + 1,
    });
    const page = pageRows(rows, opts.limit);
    const items = await Promise.all(page.items.map(async (row) => {
      const member = row.participants.find((p) => p.userId === userId)!;
      const unreadCount = await this.db.message.count({ where: {
        conversationId: row.id, senderId: { not: userId },
        ...(member.lastReadAt ? { createdAt: { gt: member.lastReadAt } } : {}),
      } });
      return ConversationSchema.parse({
        id: row.id, subject: row.donationRequestId ? { kind: 'donation_request', requestId: row.donationRequestId } : { kind: 'loan', loanId: row.loanId },
        participantIds: row.participants.map((p) => p.userId), unreadCount,
        listingTitle: (row.donationRequest ?? row.loan)?.listing.title,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), closed: row.closed,
      });
    }));
    return { items, nextCursor: page.nextCursor };
  }

  messages(userId: string, id: string, opts: PageOptions) { return this.store.listMessages(id, userId, opts); }

  send(userId: string, key: string, id: string, text: string) {
    return runIdempotent(this.db, userId, key, `POST /conversations/${id}/messages`, { body: text }, async (tx) => {
      const msg = await this.store.sendInTransaction(tx, id, userId, text);
      const others = await tx.conversationParticipant.findMany({ where: { conversationId: id, userId: { not: userId } }, select: { userId: true } });
      await tx.notification.createMany({ data: others.map((p) => ({
        userId: p.userId, type: 'message_received', title: 'New message',
        body: 'A neighbour sent you a message about an item.', link: `/messages?conversation=${id}`,
      })) });
      return { status: 201, body: MessageSchema.parse({ ...msg, createdAt: msg.createdAt.toISOString() }) };
    });
  }

  async markRead(userId: string, id: string, throughMessageId: string) {
    await this.db.$transaction(async (tx) => {
      const member = await tx.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: id, userId } } });
      if (!member) throw new HttpError('NOT_FOUND', 'Conversation not found');
      const message = await tx.message.findFirst({ where: { id: throughMessageId, conversationId: id } });
      if (!message) throw new HttpError('NOT_FOUND', 'Message not found');
      // Mark only messages actually loaded by the client, never unseen concurrent sends.
      await tx.conversationParticipant.updateMany({
        where: { conversationId: id, userId, OR: [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }] },
        data: { lastReadAt: message.createdAt },
      });
    });
  }
}
