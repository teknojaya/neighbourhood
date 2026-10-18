import { createHash, randomUUID } from 'node:crypto';
import { MessageAttachmentSchema } from '@neighbourhood/shared';
import type { Db, Tx } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { normalizeImage, validateImage, type AskImageStorage } from '../ask/ask.images.js';
export const messagePhotoDto = (photo: { id: string; mimeType: string; size: number }) => MessageAttachmentSchema.parse({ ...photo, name: 'Photo.webp' });
export class ConversationPhotos {
  constructor(private readonly db: Db, private readonly images: AskImageStorage | null = null) {}
  available() { return Boolean(this.images); }
  async access(userId: string, id: string, db: Db | Tx = this.db) { const row = await db.conversation.findFirst({ where: { id, participants: { some: { userId } } }, select: { closed: true } }); if (!row) throw new HttpError('NOT_FOUND', 'Conversation not found'); return row; }
  async upload(userId: string, conversationId: string, source: Buffer, mimeType: string, uploadKey: string) {
    await this.access(userId, conversationId); if (!this.images) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage is unavailable');
    const sourceHash = createHash('sha256').update(mimeType).update(source).digest('hex'), bytes = await normalizeImage(source, mimeType), id = randomUUID(), storagePath = `conversation-attachments/${conversationId}/${id}.webp`;
    try { return await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
      const conversation = await this.access(userId, conversationId, tx); if (conversation.closed) throw new HttpError('CONFLICT', 'This conversation is closed');
      const existing = await tx.conversationAttachment.findUnique({ where: { conversationId_uploaderId_uploadKey: { conversationId, uploaderId: userId, uploadKey } } });
      if (existing) { if (existing.sourceHash !== sourceHash) throw new HttpError('CONFLICT', 'Upload key used for a different photo'); return messagePhotoDto(existing); }
      if (await tx.conversationAttachment.count({ where: { conversationId, uploaderId: userId, messageId: null } }) >= 2) throw new HttpError('CONFLICT', 'Send or remove your pending photos first');
      await this.images!.write(storagePath, bytes, 'image/webp');
      return messagePhotoDto(await tx.conversationAttachment.create({ data: { id, conversationId, uploaderId: userId, storagePath, mimeType: 'image/webp', size: bytes.length, sourceHash, uploadKey } }));
    }, { maxWait: 10000, timeout: 15000 }); } catch (error) { try { if (!await this.db.conversationAttachment.count({ where: { storagePath } })) await this.images.delete(storagePath); } catch { /* maintenance retries orphan cleanup */ } if (error instanceof HttpError) throw error; throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage is temporarily unavailable'); }
  }
  async image(userId: string, conversationId: string, id: string) {
    await this.access(userId, conversationId);
    const row = await this.db.conversationAttachment.findFirst({ where: { id, conversationId, OR: [{ messageId: { not: null } }, { uploaderId: userId }] } });
    if (!row) throw new HttpError('NOT_FOUND', 'Photo not found'); if (!this.images) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage is unavailable');
    let bytes: Buffer; try { bytes = await this.images.read(row.storagePath); } catch { throw new HttpError('NOT_FOUND', 'Photo is unavailable'); } validateImage(bytes, row.mimeType); if (bytes.length !== row.size) throw new HttpError('NOT_FOUND', 'Photo is unavailable'); return { bytes, mimeType: row.mimeType };
  }
  async remove(userId: string, conversationId: string, id: string) {
    await this.db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${conversationId}::uuid FOR UPDATE`; await this.access(userId, conversationId, tx); const row = await tx.conversationAttachment.findFirst({ where: { id, conversationId, uploaderId: userId, messageId: null } }); if (!row) throw new HttpError('NOT_FOUND', 'Pending photo not found'); if (!this.images) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage is unavailable'); await this.images.delete(row.storagePath); await tx.conversationAttachment.delete({ where: { id } }); });
  }
  async cleanup() {
    if (!this.images) return;
    for (const row of await this.db.conversationAttachment.findMany({ where: { messageId: null, createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 100 })) await this.db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${row.conversationId}::uuid FOR UPDATE`; const current = await tx.conversationAttachment.findFirst({ where: { id: row.id, messageId: null } }); if (current) { await this.images!.delete(current.storagePath); await tx.conversationAttachment.delete({ where: { id: row.id } }); } });
    if (this.images.candidates) for await (const file of this.images.candidates()) if (file.path.startsWith('conversation-attachments/') && Date.now() - file.createdAt.getTime() > 86400000 && !await this.db.conversationAttachment.count({ where: { storagePath: file.path } })) await this.images.delete(file.path);
  }
}
