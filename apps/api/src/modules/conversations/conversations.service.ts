import { ConversationSchema, MessageSchema, type Conversation, type Message, type MessageAttachment } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { beforeCursor, decodeCursor, pageRows, type PageOptions } from '../../lib/pagination.js';
import { runIdempotent, type MutationResult } from '../requests/idempotency.js';
import { ConversationsStore, type MessagePage } from './conversations.store.js';
import { ConversationPhotos, messagePhotoDto } from './conversation.photos.js';
import type { AskImageStorage } from '../ask/ask.images.js';
import type { ObjectStorage } from '../../lib/storage.js';
const listingSelect = { id: true, title: true, photos: { orderBy: { position: 'asc' as const }, take: 1, select: { storagePath: true } } };

export interface ConversationsService {
  get(userId: string, conversationId: string): Promise<Conversation>;
  list(userId: string, opts: PageOptions): Promise<{ items: Conversation[]; nextCursor: string | null }>;
  messages(userId: string, conversationId: string, opts: PageOptions): Promise<MessagePage>;
  send(userId: string, key: string, conversationId: string, body: string, attachmentIds?: string[]): Promise<MutationResult<Message>>;
  upload?(userId: string, conversationId: string, bytes: Buffer, mimeType: string, key: string): Promise<MessageAttachment>;
  image?(userId: string, conversationId: string, id: string): Promise<{ bytes: Buffer; mimeType: string }>;
  removeAttachment?(userId: string, conversationId: string, id: string): Promise<void>;
  markRead(userId: string, conversationId: string, throughMessageId: string): Promise<void>;
}

export class PrismaConversationsService implements ConversationsService {
  private readonly store: ConversationsStore;
  private readonly photos: ConversationPhotos;
  constructor(private readonly db: Db, images: AskImageStorage | null = null, private readonly listingPhotos?: ObjectStorage) { this.store = new ConversationsStore(db); this.photos = new ConversationPhotos(db, images); }
  upload(userId: string, conversationId: string, bytes: Buffer, mimeType: string, key: string) { return this.photos.upload(userId, conversationId, bytes, mimeType, key); }
  image(userId: string, conversationId: string, id: string) { return this.photos.image(userId, conversationId, id); }
  removeAttachment(userId: string, conversationId: string, id: string) { return this.photos.remove(userId, conversationId, id); }
  cleanupAttachments() { return this.photos.cleanup(); }

  async get(userId: string, id: string) {
    const row = await this.db.conversation.findFirst({
      where: { id, participants: { some: { userId } } },
      include: { participants: true, donationRequest: { select: { listing: { select: listingSelect } } }, loan: { select: { listing: { select: listingSelect } } } },
    });
    if (!row) throw new HttpError('NOT_FOUND', 'Conversation not found');
    return ConversationSchema.parse({
      id: row.id, subject: row.donationRequestId ? { kind: 'donation_request', requestId: row.donationRequestId } : { kind: 'loan', loanId: row.loanId },
      participantIds: row.participants.map((p) => p.userId),
      listingTitle: (row.donationRequest ?? row.loan)?.listing.title,
      listingId: (row.donationRequest ?? row.loan)?.listing.id,
      listingPhotoUrl: this.listingPhotos && (row.donationRequest ?? row.loan)?.listing.photos[0] ? await this.listingPhotos.signedReadUrl((row.donationRequest ?? row.loan)!.listing.photos[0]!.storagePath) : undefined,
      imagesAvailable: this.photos.available(),
      pendingAttachments: (await this.db.conversationAttachment.findMany({ where: { conversationId: id, uploaderId: userId, messageId: null }, orderBy: { createdAt: 'asc' } })).map(messagePhotoDto),
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), closed: row.closed,
    });
  }

  async list(userId: string, opts: PageOptions) {
    const rows = await this.db.conversation.findMany({
      where: { participants: { some: { userId } }, ...beforeCursor(decodeCursor(opts.cursor)) },
      include: { participants: true, donationRequest: { select: { listing: { select: listingSelect } } }, loan: { select: { listing: { select: listingSelect } } } },
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
        listingId: (row.donationRequest ?? row.loan)?.listing.id,
        listingPhotoUrl: this.listingPhotos && (row.donationRequest ?? row.loan)?.listing.photos[0] ? await this.listingPhotos.signedReadUrl((row.donationRequest ?? row.loan)!.listing.photos[0]!.storagePath) : undefined,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), closed: row.closed,
      });
    }));
    return { items, nextCursor: page.nextCursor };
  }

  messages(userId: string, id: string, opts: PageOptions) { return this.store.listMessages(id, userId, opts); }

  send(userId: string, key: string, id: string, text: string, attachmentIds: string[] = []) {
    if (attachmentIds.length > 2 || new Set(attachmentIds).size !== attachmentIds.length) throw new HttpError('VALIDATION_FAILED', 'Choose up to two photos');
    return runIdempotent(this.db, userId, key, `POST /conversations/${id}/messages`, { body: text, ...(attachmentIds.length ? { attachmentIds } : {}) }, async (tx) => {
      await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${id}::uuid FOR UPDATE`;
      const photos = await tx.conversationAttachment.findMany({ where: { id: { in: attachmentIds }, conversationId: id, uploaderId: userId, messageId: null } });
      if (photos.length !== attachmentIds.length) throw new HttpError('NOT_FOUND', 'Pending photo not found');
      const msg = await this.store.sendInTransaction(tx, id, userId, text.trim() || (photos.length ? 'Photo' : ''));
      if (photos.length) await tx.conversationAttachment.updateMany({ where: { id: { in: attachmentIds }, conversationId: id, uploaderId: userId, messageId: null }, data: { messageId: msg.id } });
      const others = await tx.conversationParticipant.findMany({ where: { conversationId: id, userId: { not: userId } }, select: { userId: true } });
      await tx.notification.createMany({ data: others.map((p) => ({
        userId: p.userId, type: 'message_received', title: 'New message',
        body: 'A neighbour sent you a message about an item.', link: `/messages?conversation=${id}`,
      })) });
      return { status: 201, body: MessageSchema.parse({ ...msg, attachments: photos.map(messagePhotoDto), createdAt: msg.createdAt.toISOString() }) };
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
