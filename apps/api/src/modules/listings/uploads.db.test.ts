import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { CreateListingBodySchema } from '@neighbourhood/shared';
import { createDb } from '../../lib/db.js';
import type { ObjectStorage } from '../../lib/storage.js';
import { testDatabaseUrl } from '../../test/db-global-setup.js';
import { PrismaAskService } from '../ask/ask.service.js';
import type { AskImageStorage } from '../ask/ask.images.js';
import { ConversationPhotos } from '../conversations/conversation.photos.js';
import { PrismaRequestsService } from '../requests/requests.service.js';
import { PrismaNeedsService } from '../needs/needs.service.js';
import { PrismaConversationsService } from '../conversations/conversations.service.js';
import { PrismaNotificationsService } from '../notifications/notifications.service.js';
import { ListingsService } from './listings.service.js';

// Regression: bucket uploads ran inside 15 s DB transactions, so a slow bucket
// (e.g. a distant region) failed every upload with P2028 while holding row locks.
const db = createDb(testDatabaseUrl());
const users: string[] = [];
const listingBody = () => CreateListingBodySchema.parse({ mode: 'donate', category: 'books', title: 'Upload test books', description: 'Upload regression fixture', condition: 'good', quantity: 1, areaLabel: 'Test area', exactLocation: { lat: -6.2, lng: 106.816 }, pickupInstructions: 'x', collection: { method: 'owner_location', communityPointId: null } });
const png = () => sharp({ create: { width: 6, height: 6, channels: 3, background: 'teal' } }).png().toBuffer();
afterAll(async () => {
  await db.donationRequest.deleteMany({ where: { ownerId: { in: users } } });
  await db.listing.deleteMany({ where: { ownerId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

async function user() {
  const uid = 'upload-' + randomUUID();
  const row = await db.user.create({ data: { firebaseUid: uid, email: uid + '@example.test', emailVerified: true } });
  users.push(row.id);
  return row.id;
}

/** True when another connection can lock the row right now, i.e. the caller holds no transaction on it. */
async function unlocked(table: 'listings' | 'ask_sessions' | 'conversations', id: string) {
  try {
    await db.$transaction(async tx => { await tx.$queryRawUnsafe(`SELECT id FROM ${table} WHERE id = $1::uuid FOR UPDATE NOWAIT`, id); });
    return true;
  } catch { return false; }
}

class ProbingStorage implements ObjectStorage, AskImageStorage {
  files = new Map<string, Buffer>(); lockFree: boolean[] = [];
  constructor(private readonly probe: () => Promise<boolean>) {}
  async signedReadUrl(path: string) { return '/photo/' + path; }
  async put(path: string, bytes: Buffer) { this.lockFree.push(await this.probe()); this.files.set(path, bytes); }
  async write(path: string, bytes: Buffer) { await this.put(path, bytes); }
  async get(path: string) { return this.files.get(path)!; }
  async read(path: string) { return this.files.get(path)!; }
  async remove(path: string) { this.files.delete(path); }
  async delete(path: string) { this.files.delete(path); }
}

describe('photo uploads do not hold database locks during bucket I/O', () => {
  it('listing photos: uploads outside the transaction; replays leave no orphan object', async () => {
    const owner = await user();
    let listingId = '';
    const storage = new ProbingStorage(() => unlocked('listings', listingId));
    const listings = new ListingsService(db, storage);
    const listing = await listings.createListing(owner, listingBody());
    listingId = listing.id;
    const key = 'upload_' + randomUUID(), bytes = await png();
    const first = await listings.uploadPhoto(owner, listing.id, bytes, 'image/png', key);
    const replay = await listings.uploadPhoto(owner, listing.id, bytes, 'image/png', key);
    expect(storage.lockFree).toEqual([true, true]);
    expect(replay.storagePath).toBe(first.storagePath);
    expect([...storage.files.keys()]).toEqual([first.storagePath]);
    expect(await db.listingPhoto.count({ where: { listingId: listing.id } })).toBe(1);
  });

  it('listing photos: non-owners are rejected before anything is uploaded', async () => {
    const owner = await user(), other = await user();
    const storage = new ProbingStorage(async () => true);
    const listings = new ListingsService(db, storage);
    const listing = await listings.createListing(owner, listingBody());
    await expect(listings.uploadPhoto(other, listing.id, await png(), 'image/png', 'upload_' + randomUUID())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(storage.files.size).toBe(0);
  });

  it('Ask attachments: upload outside the session lock; replay reuses the stored attachment', async () => {
    const owner = await user();
    const session = await db.askSession.create({ data: { userId: owner, clientId: randomUUID() } });
    const images = new ProbingStorage(() => unlocked('ask_sessions', session.id));
    const ask = new PrismaAskService(db, null, images, { requests: new PrismaRequestsService(db), needs: new PrismaNeedsService(db), conversations: new PrismaConversationsService(db), notifications: new PrismaNotificationsService(db) });
    const key = 'ask_' + randomUUID(), bytes = await png();
    const first = await ask.upload(owner, session.id, bytes, 'image/png', key);
    const replay = await ask.upload(owner, session.id, bytes, 'image/png', key);
    expect(images.lockFree).toEqual([true, true]);
    expect(replay.id).toBe(first.id);
    expect(images.files.size).toBe(1);
  });

  it('chat photos: upload outside the conversation lock; replay reuses the stored attachment', async () => {
    const a = await user(), b = await user();
    const listing = await new ListingsService(db).createListing(a, listingBody());
    const requestRow = await db.donationRequest.create({ data: { listingId: listing.id, ownerId: a, requesterId: b, quantity: 1, message: 'Upload test' } });
    const conversation = await db.conversation.create({ data: { donationRequestId: requestRow.id, participants: { create: [{ userId: a }, { userId: b }] } } });
    const images = new ProbingStorage(() => unlocked('conversations', conversation.id));
    const photos = new ConversationPhotos(db, images);
    const key = 'chat_' + randomUUID(), bytes = await png();
    const first = await photos.upload(a, conversation.id, bytes, 'image/png', key);
    const replay = await photos.upload(a, conversation.id, bytes, 'image/png', key);
    expect(images.lockFree).toEqual([true, true]);
    expect(replay.id).toBe(first.id);
    expect(images.files.size).toBe(1);
  });
});
