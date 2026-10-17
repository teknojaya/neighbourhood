import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createDb } from '../../lib/db.js';
import { AiService } from '../ai/ai.service.js';
import { PrismaAccessRepository } from '../auth/access.js';
import { PrismaUsersRepository, UserProvisioningService } from '../auth/users.js';
import { PrismaConversationsService } from '../conversations/conversations.service.js';
import { EmailOtpService } from '../email-otp/otp.service.js';
import { PrismaNotificationsService } from '../notifications/notifications.service.js';
import { PrismaNeedsService } from '../needs/needs.service.js';
import { PrismaProfilesRepository } from '../profiles/profiles.repository.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { bearer, FakeVerifier, testConfig } from '../../test/fakes.js';
import { testDatabaseUrl } from '../../test/db-global-setup.js';
import { PrismaRequestsService } from './requests.service.js';
import { runIdempotent } from './idempotency.js';

const db = createDb(testDatabaseUrl());
const service = new PrismaRequestsService(db);
const conversations = new PrismaConversationsService(db);
const notifications = new PrismaNotificationsService(db);
const access = new PrismaAccessRepository(db);
const app = createApp({
  config: testConfig(), tokenVerifier: new FakeVerifier(), users: new UserProvisioningService(new PrismaUsersRepository(db)),
  access, otp: new EmailOtpService(null, false), profiles: new ProfilesService(new PrismaProfilesRepository(db), access), ai: new AiService(null),
  requests: service, conversations, notifications, needs: new PrismaNeedsService(db),
});

const users: string[] = [], listings: string[] = [], communities: string[] = [], points: string[] = [];
let owner: { id: string; firebaseUid: string };
let recipient: { id: string; firebaseUid: string };
let other: { id: string; firebaseUid: string };
let listingId: string;

async function user() {
  const firebaseUid = `e2-${randomUUID()}`;
  const row = await db.user.create({ data: { firebaseUid, email: `${firebaseUid}@example.test`, emailVerified: true } });
  users.push(row.id);
  return row;
}
async function listing(stockTotal = 1) {
  const row = await db.listing.create({ data: {
    ownerId: owner.id, title: 'Kitchen utensils', description: 'Test listing', status: 'active', mode: 'donate', category: 'household',
    condition: 'good', stockTotal, areaLabel: 'Test neighbourhood', lat: -6.26, lng: 106.81, geohash: 'qqgux', collectionMethod: 'owner_location',
    private: { create: { pickupInstructions: 'PRIVATE ADDRESS NEVER EXPOSED' } },
  } });
  listings.push(row.id);
  return row.id;
}
const create = (who = recipient, id = listingId, quantity = 1, key = randomUUID()) =>
  service.create(who.id, key, { listingId: id, quantity, message: '' });
const change = (id: string, to: 'approved' | 'rejected' | 'cancelled' | 'collected', who = owner, key = randomUUID()) =>
  service.transition(who.id, key, id, { to });

beforeEach(async () => {
  owner = await user(); recipient = await user(); other = await user();
  listingId = await listing();
});
afterAll(async () => {
  // Delete only this run's fixtures, never truncate a shared test database.
  await db.donationRequest.deleteMany({ where: { listingId: { in: listings } } });
  await db.listing.deleteMany({ where: { id: { in: listings } } });
  await db.communityPoint.deleteMany({ where: { id: { in: points } } });
  await db.community.deleteMany({ where: { id: { in: communities } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe('donation transactions against PostgreSQL', () => {
  it('creates a request, private conversation and notification atomically through HTTP', async () => {
    const response = await request(app).post('/api/v1/requests').set('Authorization', bearer(recipient.firebaseUid))
      .set('Idempotency-Key', randomUUID()).send({ listingId, quantity: 1, message: 'Can I collect tomorrow?' }).expect(201);
    const req = response.body;
    expect(req.requesterId).toBe(recipient.id);
    expect(req.allowedActions).toEqual(['cancelled']);
    expect(req.listingTitle).toBe('Kitchen utensils');
    expect(JSON.stringify(req)).not.toContain('PRIVATE ADDRESS');
    expect(await db.conversation.count({ where: { donationRequestId: req.id } })).toBe(1);
    expect(await db.message.count({ where: { conversationId: req.conversationId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id, type: 'request_received' } })).toBe(1);
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(0);
  });

  it('serializes simultaneous retries and replays the exact original response', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => create(recipient, listingId, 1, key)));
    // PostgreSQL JSONB may reorder object keys; the status and JSON values must match.
    for (const result of results) expect(result).toEqual(results[0]);
    expect(await db.donationRequest.count({ where: { listingId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id } })).toBe(1);
  });

  it('rejects key reuse with a changed payload or endpoint', async () => {
    const key = randomUUID();
    const req = (await create(recipient, listingId, 1, key)).body;
    await expect(create(recipient, listingId, 2, key)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(change(req.id, 'cancelled', recipient, key)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await service.get(recipient.id, req.id)).status).toBe('pending');
  });

  it('ignores JSON key order and permits expired keys to start a new operation', async () => {
    const key = randomUUID();
    const a = await service.create(recipient.id, key, { listingId, quantity: 1, message: 'Hello' });
    const b = await service.create(recipient.id, key, { message: 'Hello', quantity: 1, listingId });
    expect(a).toEqual(b);
    await db.idempotencyKey.update({ where: { userId_key: { userId: recipient.id, key } }, data: { createdAt: new Date(0) } });
    const c = await create(recipient, await listing(), 1, key);
    expect(c.body.id).not.toBe(a.body.id);
  });

  it('rolls back business writes and the key if a dependent write fails', async () => {
    const key = randomUUID();
    await expect(runIdempotent(db, recipient.id, key, 'rollback-check', {}, async (tx) => {
      await tx.listing.update({ where: { id: listingId }, data: { stockReserved: 1 } });
      throw new Error('Simulated dependent write failure');
    })).rejects.toThrow('Simulated dependent write failure');
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(0);
    expect(await db.idempotencyKey.count({ where: { userId: recipient.id, key } })).toBe(0);
  });

  it('scopes keys by user and prevents duplicate active requests with different keys', async () => {
    const key = randomUUID();
    await create(recipient, listingId, 1, key);
    await create(other, listingId, 1, key);
    await expect(create()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await db.donationRequest.count({ where: { listingId } })).toBe(2);
  });

  it('rejects self-requests and unavailable/lending listings', async () => {
    await expect(create(owner)).rejects.toMatchObject({ code: 'SELF_REQUEST' });
    await db.listing.update({ where: { id: listingId }, data: { status: 'paused' } });
    await expect(create()).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.listing.update({ where: { id: listingId }, data: { status: 'active', mode: 'lend', maxLoanDays: 7 } });
    await expect(create()).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not oversell when different requests are approved concurrently', async () => {
    const a = (await create()).body;
    const b = (await create(other)).body;
    const results = await Promise.allSettled([change(a.id, 'approved'), change(b.id, 'approved')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure).toMatchObject({ reason: { code: 'INSUFFICIENT_STOCK' } });
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(1);
    expect(await db.notification.count({ where: { userId: { in: [recipient.id, other.id] }, type: 'request_approved' } })).toBe(1);
  });

  it('does not reserve stock or notify twice when approval is retried', async () => {
    const req = (await create()).body;
    const key = randomUUID();
    const [a, b] = await Promise.all([change(req.id, 'approved', owner, key), change(req.id, 'approved', owner, key)]);
    expect(a).toEqual(b);
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(1);
    expect(await db.notification.count({ where: { userId: recipient.id, type: 'request_approved' } })).toBe(1);
  });

  it('releases approved stock on cancellation and permits a new request', async () => {
    const req = (await create()).body;
    await change(req.id, 'approved');
    await change(req.id, 'cancelled', recipient);
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(0);
    expect((await create()).body.status).toBe('pending');
  });

  it('transfers reserved stock to collected exactly once', async () => {
    const req = (await create()).body;
    await change(req.id, 'approved');
    await expect(change(req.id, 'collected', recipient)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await change(req.id, 'collected');
    await expect(change(req.id, 'collected')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const item = await db.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect([item.stockReserved, item.stockCollected]).toEqual([0, 1]);
  });

  it('keeps failed operations retryable and enforces actor permissions', async () => {
    const req = (await create()).body;
    const key = randomUUID();
    await expect(change(req.id, 'approved', recipient, key)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.idempotencyKey.count({ where: { userId: recipient.id, key } })).toBe(0);
    await expect(change(req.id, 'collected')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await change(req.id, 'rejected');
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(0);
  });

  it('hides unrelated requests and limits incoming/outgoing results to the caller', async () => {
    const req = (await create()).body;
    await request(app).get(`/api/v1/requests/${req.id}`).set('Authorization', bearer(other.firebaseUid)).expect(404);
    await request(app).post(`/api/v1/requests/${req.id}/transition`).set('Authorization', bearer(other.firebaseUid))
      .set('Idempotency-Key', randomUUID()).send({ to: 'approved' }).expect(404);
    expect((await service.list(other.id, 'incoming', { limit: 20 })).items).toHaveLength(0);
    expect((await service.list(owner.id, 'incoming', { limit: 20 })).items[0]?.id).toBe(req.id);
    expect((await service.list(recipient.id, 'outgoing', { limit: 20 })).items[0]?.id).toBe(req.id);
  });

  it('authorizes only active volunteers of the collection point community', async () => {
    const community = await db.community.create({ data: { name: 'Test community', areaLabel: 'Test area' } });
    communities.push(community.id);
    const point = await db.communityPoint.create({ data: { communityId: community.id, name: 'Box', kind: 'box', partnerName: 'Test', exactAddress: 'Private', lat: 0, lng: 0, geohash: 's000', areaLabel: 'Test', qrId: randomUUID() } });
    points.push(point.id);
    await db.listing.update({ where: { id: listingId }, data: { communityPointId: point.id, collectionMethod: 'community_point' } });
    await db.communityMembership.create({ data: { communityId: community.id, userId: other.id, role: 'volunteer' } });
    const req = (await create()).body;
    expect((await service.get(other.id, req.id)).allowedActions).toContain('approved');
    expect((await service.get(other.id, req.id)).conversationId).toBeNull();
    expect((await service.list(other.id, 'incoming', { limit: 20 })).items).toHaveLength(1);
    await change(req.id, 'approved', other);
    await db.communityMembership.update({ where: { communityId_userId: { communityId: community.id, userId: other.id } }, data: { status: 'removed' } });
    await expect(change(req.id, 'collected', other)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('paginates tied timestamps without duplicates and rejects malformed cursors', async () => {
    await create(); await create(recipient, await listing()); await create(recipient, await listing());
    await db.donationRequest.updateMany({ where: { requesterId: recipient.id }, data: { createdAt: new Date('2026-10-17T00:00:00Z') } });
    const a = await service.list(recipient.id, 'outgoing', { limit: 2 });
    const b = await service.list(recipient.id, 'outgoing', { limit: 2, cursor: a.nextCursor! });
    expect(new Set([...a.items, ...b.items].map((r) => r.id)).size).toBe(3);
    expect(b.nextCursor).toBeNull();
    await expect(service.list(recipient.id, 'outgoing', { limit: 20, cursor: 'bad' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects past pickup deadlines without reserving stock', async () => {
    const req = (await create()).body;
    await expect(service.transition(owner.id, randomUUID(), req.id, { to: 'approved', pickupBy: '2000-01-01T00:00:00Z' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).stockReserved).toBe(0);
  });
});

describe('private chat and inbox against PostgreSQL', () => {
  it('blocks nonparticipants and makes retries create only one message and notification', async () => {
    const req = (await create()).body;
    const id = req.conversationId!;
    await request(app).get(`/api/v1/conversations/${id}/messages`).set('Authorization', bearer(other.firebaseUid)).expect(404);
    await request(app).get(`/api/v1/conversations/${id}`).set('Authorization', bearer(other.firebaseUid)).expect(404);
    const detail = await request(app).get(`/api/v1/conversations/${id}`).set('Authorization', bearer(owner.firebaseUid)).expect(200);
    expect(detail.body.listingTitle).toBe('Kitchen utensils');
    await expect(conversations.send(other.id, randomUUID(), id, 'intrusion')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const key = randomUUID();
    const [a, b] = await Promise.all([conversations.send(recipient.id, key, id, 'Hello!'), conversations.send(recipient.id, key, id, 'Hello!')]);
    expect(a).toEqual(b);
    expect(await db.message.count({ where: { conversationId: id } })).toBe(1);
    const inbox = await notifications.list(owner.id, { limit: 20 });
    expect(inbox.items.filter((n) => n.type === 'message_received')).toHaveLength(1);
    expect(JSON.stringify(inbox)).not.toContain('Hello!');
    await request(app).post(`/api/v1/conversations/${id}/read`).set('Authorization', bearer(owner.firebaseUid))
      .send({ throughMessageId: a.body.id }).expect(204);
    expect((await conversations.list(owner.id, { limit: 20 })).items[0]?.unreadCount).toBe(0);
  });

  it('marks only loaded messages read, preserves newer unread messages and never moves backward', async () => {
    const id = (await create()).body.conversationId!;
    const a = (await conversations.send(recipient.id, randomUUID(), id, 'First')).body;
    const b = (await conversations.send(recipient.id, randomUUID(), id, 'Second')).body;
    expect((await conversations.list(owner.id, { limit: 20 })).items[0]?.unreadCount).toBe(2);
    await conversations.markRead(owner.id, id, a.id);
    expect((await conversations.list(owner.id, { limit: 20 })).items[0]?.unreadCount).toBe(1);
    await conversations.markRead(owner.id, id, b.id);
    await conversations.markRead(owner.id, id, a.id);
    expect((await conversations.list(owner.id, { limit: 20 })).items[0]?.unreadCount).toBe(0);
    await expect(conversations.markRead(other.id, id, b.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('supports message pagination and refuses writes to closed conversations', async () => {
    const id = (await create()).body.conversationId!;
    for (const text of ['one', 'two', 'three']) await conversations.send(recipient.id, randomUUID(), id, text);
    const a = await conversations.messages(owner.id, id, { limit: 2 });
    const b = await conversations.messages(owner.id, id, { limit: 2, cursor: a.nextCursor! });
    expect([...a.items, ...b.items].map((m) => m.body)).toEqual(['three', 'two', 'one']);
    await db.conversation.update({ where: { id }, data: { closed: true } });
    await expect(conversations.send(owner.id, randomUUID(), id, 'four')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await db.message.count({ where: { conversationId: id } })).toBe(3);
  });

  it('isolates notification inboxes and marks reads idempotently', async () => {
    await create();
    const inbox = await notifications.list(owner.id, { limit: 20 });
    const id = inbox.items[0]!.id;
    expect((await notifications.list(other.id, { limit: 20 })).items).toHaveLength(0);
    await expect(notifications.markRead(other.id, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const a = await notifications.markRead(owner.id, id);
    const b = await notifications.markRead(owner.id, id);
    expect(a.readAt).not.toBeNull(); expect(a.readAt).toBe(b.readAt);
  });
});
