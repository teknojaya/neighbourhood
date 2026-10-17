import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { CreateListingBodySchema, modelSafe, type MarketplaceAction } from '@neighbourhood/shared';
import { createApp } from '../../app.js';
import { createDb } from '../../lib/db.js';
import type { ObjectStorage } from '../../lib/storage.js';
import { testDatabaseUrl } from '../../test/db-global-setup.js';
import { FakeVerifier, testConfig, bearer } from '../../test/fakes.js';
import { PrismaAccessRepository } from '../auth/access.js';
import { PrismaUsersRepository, UserProvisioningService } from '../auth/users.js';
import { PrismaProfilesRepository } from '../profiles/profiles.repository.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AiService } from '../ai/ai.service.js';
import { EmailOtpService } from '../email-otp/otp.service.js';
import { PrismaRequestsService } from '../requests/requests.service.js';
import { PrismaConversationsService } from '../conversations/conversations.service.js';
import { PrismaNotificationsService } from '../notifications/notifications.service.js';
import { PrismaNeedsService } from '../needs/needs.service.js';
import { LoansService } from '../loans/loans.service.js';
import { CommunitiesService } from '../communities/communities.service.js';
import { MaintenanceService } from '../notifications/maintenance.service.js';
import { MatchingService } from '../needs/matching.service.js';
import { PrismaAskService } from '../ask/ask.service.js';
import { ListingsService } from './listings.service.js';

const db = createDb(testDatabaseUrl());
const users: string[] = [], communities: string[] = [];
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const body = () => CreateListingBodySchema.parse({ mode: 'donate', category: 'books', title: 'Children books', description: 'Picture books for sharing', condition: 'good', quantity: 3, areaLabel: 'Test neighbourhood', exactLocation: { lat: -6.2, lng: 106.816 }, pickupInstructions: 'PRIVATE pickup 3A', collection: { method: 'owner_location', communityPointId: null } });
class MemoryStorage implements ObjectStorage {
  files = new Map<string, Buffer>();
  async signedReadUrl(path: string) { return '/photo/' + path; }
  async put(path: string, bytes: Buffer) { this.files.set(path, bytes); }
  async get(path: string) { return this.files.get(path)!; }
  async remove(path: string) { this.files.delete(path); }
}
async function fixture() {
  const createUser = async () => { const uid = `market-${randomUUID()}`; const row = await db.user.create({ data: { firebaseUid: uid, email: `${uid}@example.test`, emailVerified: true, homeLat: -6.2, homeLng: 106.816, areaLabel: 'Test neighbourhood' } }); users.push(row.id); return row; };
  const owner = await createUser(), neighbour = await createUser(), outsider = await createUser();
  const storage = new MemoryStorage(); const listings = new ListingsService(db, storage);
  const services = { requests: new PrismaRequestsService(db), conversations: new PrismaConversationsService(db), notifications: new PrismaNotificationsService(db), needs: new PrismaNeedsService(db), loans: new LoansService(db), communities: new CommunitiesService(db) };
  const access = new PrismaAccessRepository(db);
  const ask = new PrismaAskService(db, null, null, { ...services, marketplace: { listings, loans: services.loans, communities: services.communities }, listings: { get: async (uid, id) => (await listings.getListingDetail(uid, id)).listing } });
  const app = createApp({ config: testConfig(), db, tokenVerifier: new FakeVerifier(), users: new UserProvisioningService(new PrismaUsersRepository(db)), access,
    profiles: new ProfilesService(new PrismaProfilesRepository(db), access), otp: new EmailOtpService(null, false), ai: new AiService(null), ...services, listings, ask, matching: new MatchingService(db, listings, null) });
  return { owner, neighbour, outsider, storage, listings, ask, app, ...services };
}
afterAll(async () => {
  await db.askSession.deleteMany({ where: { userId: { in: users } } });
  await db.loan.deleteMany({ where: { ownerId: { in: users } } });
  await db.donationRequest.deleteMany({ where: { ownerId: { in: users } } });
  await db.listing.deleteMany({ where: { ownerId: { in: users } } });
  await db.community.deleteMany({ where: { id: { in: communities } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe('integrated marketplace against PostgreSQL', () => {
  it('publishes exactly once, searches nearby, protects pickup, and completes the donation journey', async () => {
    const f = await fixture(); const key = randomUUID();
    const listing = await f.listings.createListing(f.owner.id, body(), key);
    expect((await f.listings.createListing(f.owner.id, body(), key)).id).toBe(listing.id);
    const feed = await f.listings.searchListings({ searcherId: f.neighbour.id, center: body().exactLocation, radiusKm: 1, query: 'books', limit: 30 });
    expect(feed.some(item => item.id === listing.id)).toBe(true);
    expect(JSON.stringify(feed)).not.toContain('PRIVATE pickup');
    await request(f.app).get(`/api/v1/listings/${listing.id}/pickup`).set('Authorization', bearer(f.neighbour.firebaseUid)).expect(404);
    const created = await request(f.app).post('/api/v1/requests').set('Authorization', bearer(f.neighbour.firebaseUid)).set('Idempotency-Key', randomUUID()).send({ listingId: listing.id, quantity: 1 }).expect(201);
    await f.requests.transition(f.owner.id, randomUUID(), created.body.id, { to: 'approved' });
    const pickup = await request(f.app).get(`/api/v1/listings/${listing.id}/pickup`).set('Authorization', bearer(f.neighbour.firebaseUid)).expect(200);
    expect(pickup.body.pickupInstructions).toContain('PRIVATE');
    await request(f.app).patch(`/api/v1/listings/${listing.id}`).set('Authorization', bearer(f.outsider.firebaseUid)).set('Idempotency-Key', randomUUID()).send({ title: 'Not mine' }).expect(403);
    await expect(f.listings.updateListing(f.owner.id, listing.id, { quantity: 0 })).rejects.toMatchObject({ code: 'CONFLICT' });
    await f.conversations.send(f.neighbour.id, randomUUID(), created.body.conversationId, 'I can collect today');
    await f.requests.transition(f.owner.id, randomUUID(), created.body.id, { to: 'collected' });
    expect((await f.listings.getListingDetail(f.owner.id, listing.id)).listing.stock).toEqual({ total: 3, reserved: 0, collected: 1 });
  });
  it('serializes close versus approval and never leaves closed reserved stock', async () => {
    const f = await fixture(); const listing = await f.listings.createListing(f.owner.id, body());
    const req = await f.requests.create(f.neighbour.id, randomUUID(), { listingId: listing.id, quantity: 1, message: '' });
    const outcomes = await Promise.allSettled([f.requests.transition(f.owner.id, randomUUID(), req.body.id, { to: 'approved' }), f.listings.transitionStatus(f.owner.id, listing.id, 'closed')]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    const row = await db.listing.findUniqueOrThrow({ where: { id: listing.id } }); expect(row.status === 'closed' && row.stockReserved > 0).toBe(false);
  });
  it('normalizes bucket photos, retries once and rejects uploads by another owner', async () => {
    const f = await fixture(); const listing = await f.listings.createListing(f.owner.id, body());
    const bytes = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: 'red' } }).png().toBuffer(); const key = randomUUID();
    const upload = () => request(f.app).post(`/api/v1/listings/${listing.id}/photos`).set('Authorization', bearer(f.owner.firebaseUid)).set('Idempotency-Key', key).set('Content-Type', 'image/png').send(bytes);
    const a = await upload().expect(201), b = await upload().expect(201); expect(b.body.photoId).toBe(a.body.photoId); expect(f.storage.files.size).toBe(1);
    const meta = await sharp(f.storage.files.get(a.body.storagePath)).metadata(); expect(meta.width).toBe(1600); expect(meta.format).toBe('webp'); expect(meta.exif).toBeUndefined();
    await request(f.app).post(`/api/v1/listings/${listing.id}/photos`).set('Authorization', bearer(f.outsider.firebaseUid)).set('Idempotency-Key', randomUUID()).set('Content-Type', 'image/png').send(bytes).expect(403);
    await request(f.app).put('/api/v1/storage/upload?path=' + a.body.storagePath).set('Content-Type', 'image/png').send(bytes).expect(401);
    const deleteKey = randomUUID(); await f.listings.removePhoto(f.owner.id, listing.id, a.body.photoId, deleteKey); await f.listings.removePhoto(f.owner.id, listing.id, a.body.photoId, deleteKey); expect(f.storage.files.size).toBe(0);
  });
  it('guards loan participants, concurrent overlap, checkout and return', async () => {
    const f = await fixture(); const listing = await f.listings.createListing(f.owner.id, { ...body(), mode: 'lend', quantity: 1, lending: { maxLoanDays: 7, notes: null, depositRequired: false } });
    const a = await f.loans.create(f.neighbour.id, randomUUID(), { listingId: listing.id, startDate: day(0), endDate: day(2), message: '' });
    const b = await f.loans.create(f.outsider.id, randomUUID(), { listingId: listing.id, startDate: day(1), endDate: day(3), message: '' });
    const outcomes = await Promise.allSettled([f.loans.transition(f.owner.id, randomUUID(), a.body.id, { to: 'approved' }), f.loans.transition(f.owner.id, randomUUID(), b.body.id, { to: 'approved' })]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    if (outcomes[0]!.status === 'fulfilled') { await f.loans.transition(f.owner.id, randomUUID(), a.body.id, { to: 'checked_out' }); await f.loans.transition(f.owner.id, randomUUID(), a.body.id, { to: 'returned', returnConditionNote: 'Working and clean' }); expect((await f.loans.get(f.neighbour.id, a.body.id)).status).toBe('returned'); }
    await request(f.app).get(`/api/v1/loans/${a.body.id}`).set('Authorization', bearer(f.outsider.firebaseUid)).expect(404);
  });
  it('requires moderator/volunteer roles, consent and explicit accepted counts; audits stock exactly once', async () => {
    const f = await fixture(); await db.userRole.create({ data: { userId: f.owner.id, role: 'staff' } });
    const community = await f.communities.create(f.owner.id, randomUUID(), { name: 'Test community', areaLabel: 'Test neighbourhood', description: '', joinPolicy: 'approval_required' }); communities.push(community.body.id);
    const membership = await f.communities.join(f.neighbour.id, randomUUID(), community.body.id); expect(membership.body.status).toBe('pending');
    await expect(f.communities.setMember(f.neighbour.id, randomUUID(), community.body.id, f.neighbour.id, { role: 'moderator' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await f.communities.setMember(f.owner.id, randomUUID(), community.body.id, f.neighbour.id, { role: 'volunteer', status: 'active' });
    const point = await f.communities.createPoint(f.owner.id, randomUUID(), community.body.id, { name: 'Partner pantry', kind: 'pantry', partnerName: 'Test partner', exactAddress: 'PRIVATE partner address', publicAddressConsent: false, consentedBy: 'Fixture owner', location: body().exactLocation, areaLabel: 'Test neighbourhood', openingHours: null });
    expect(point.body.publicAddress).toBeNull(); expect((await f.communities.qr(point.body.qrId)).id).toBe(point.body.id);
    const linkedPoint = await request(f.app).get(`/api/v1/points/${point.body.id}`).set('Authorization', bearer(f.outsider.firebaseUid)).expect(200); expect(linkedPoint.body.publicAddress).toBeNull(); expect(linkedPoint.body.communityId).toBe(community.body.id);
    const deposit = await f.communities.propose(f.outsider.id, randomUUID(), { pointId: point.body.id, items: [{ category: 'books', title: 'Picture books', quantity: 3, bestBefore: null }] });
    await expect(f.communities.review(f.outsider.id, randomUUID(), deposit.body.id, { to: 'accepted', acceptedQuantities: [3] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.communities.review(f.neighbour.id, randomUUID(), deposit.body.id, { to: 'accepted', acceptedQuantities: [4] })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const key = randomUUID(); await f.communities.review(f.neighbour.id, key, deposit.body.id, { to: 'accepted', acceptedQuantities: [2] }); await f.communities.review(f.neighbour.id, key, deposit.body.id, { to: 'accepted', acceptedQuantities: [2] });
    const stock = (await f.communities.inventory(point.body.id)).items[0]!; expect(stock.available).toBe(2);
    await f.communities.adjust(f.neighbour.id, randomUUID(), point.body.id, { itemId: stock.id, delta: -1, reason: 'collected', note: 'Collected in person' });
    await expect(f.communities.adjust(f.neighbour.id, randomUUID(), point.body.id, { itemId: stock.id, delta: -2, reason: 'damaged', note: 'Checked in person' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await f.communities.audit(f.neighbour.id, point.body.id)).items).toHaveLength(2);
    await db.pointInventoryItem.update({ where: { id: stock.id }, data: { bestBefore: new Date(day(-1)) } });
    await expect(f.listings.createListing(f.neighbour.id, { ...body(), quantity: 1, pointInventoryItemId: stock.id, collection: { method: 'community_point', communityPointId: point.body.id } })).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.pointInventoryItem.update({ where: { id: stock.id }, data: { bestBefore: new Date(day(2)) } });
    const pointListing = await f.listings.createListing(f.neighbour.id, { ...body(), quantity: 1, pointInventoryItemId: stock.id, collection: { method: 'community_point', communityPointId: point.body.id } });
    expect(pointListing.bestBefore).toBe(day(2));
    await expect(f.listings.updateListing(f.neighbour.id, pointListing.id, { bestBefore: null })).rejects.toMatchObject({ code: 'CONFLICT' });
    const pointRequest = await f.requests.create(f.outsider.id, randomUUID(), { listingId: pointListing.id, quantity: 1, message: '' });
    await f.requests.transition(f.neighbour.id, randomUUID(), pointRequest.body.id, { to: 'approved' });
    expect((await f.communities.inventory(point.body.id)).items[0]).toMatchObject({ available: 0, reserved: 1 });
    await f.requests.transition(f.owner.id, randomUUID(), pointRequest.body.id, { to: 'collected' });
    expect((await f.communities.inventory(point.body.id)).items[0]).toMatchObject({ available: 0, reserved: 0 });
    expect((await f.listings.getListingDetail(f.neighbour.id, pointListing.id)).listing.stock).toEqual({ total: 1, reserved: 0, collected: 1 });
    expect((await f.communities.audit(f.owner.id, point.body.id)).items[0]).toMatchObject({ reason: 'collected', requestId: pointRequest.body.id });
    await request(f.app).get('/api/v1/points/qr-image/' + point.body.qrId).expect('Content-Type', /image\/png/).expect(200);
  });
  it('confirms Ask publication once, redacts private fields from model context and recovers history', async () => {
    const f = await fixture(); const session = await f.ask.create(f.owner.id, randomUUID());
    const action: MarketplaceAction = { operation: 'listing_publish', body: body(), attachmentIds: [] }; const clientId = randomUUID();
    const a = await f.ask.prepareFromUi(f.owner.id, session.id, clientId, action); const b = await f.ask.prepareFromUi(f.owner.id, session.id, clientId, action); expect(b.id).toBe(a.id);
    expect(await db.listing.count({ where: { ownerId: f.owner.id } })).toBe(0);
    const receipt = await f.ask.confirm(f.owner.id, a.id, a.revision); expect(receipt.status).toBe('completed'); await f.ask.confirm(f.owner.id, a.id, a.revision);
    expect(await db.listing.count({ where: { ownerId: f.owner.id } })).toBe(1);
    expect(JSON.stringify(modelSafe((await f.ask.detail(f.owner.id, session.id)).messages.items))).not.toContain('PRIVATE pickup');
    await expect(f.ask.confirm(f.outsider.id, a.id, a.revision)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('rejects unauthorized proposals and stale edits, and keeps the original recovery deadline', async () => {
    const f = await fixture(); const listing = await f.listings.createListing(f.owner.id, body()); const session = await f.ask.create(f.owner.id, randomUUID()); const otherSession = await f.ask.create(f.outsider.id, randomUUID());
    await expect(f.ask.prepareFromUi(f.outsider.id, otherSession.id, randomUUID(), { operation: 'listing_transition', listingId: listing.id, body: { to: 'closed' } })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const proposal = await f.ask.prepareFromUi(f.owner.id, session.id, randomUUID(), { operation: 'listing_edit', listingId: listing.id, body: { title: 'Old preview title' } });
    await f.listings.updateListing(f.owner.id, listing.id, { title: 'New owner edit' });
    await expect(f.ask.confirm(f.owner.id, proposal.id, proposal.revision)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await f.listings.getListingDetail(f.owner.id, listing.id)).listing.title).toBe('New owner edit');
    const expired = await f.ask.prepareFromUi(f.owner.id, session.id, randomUUID(), { operation: 'profile_preferences', searchRadiusKm: 5 });
    await db.askAction.update({ where: { id: expired.id }, data: { status: 'executing', startedAt: new Date(Date.now() - 60_000), firstStartedAt: new Date(Date.now() - 21 * 3600_000) } });
    await expect(f.ask.confirm(f.owner.id, expired.id, expired.revision)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await db.user.findUniqueOrThrow({ where: { id: f.owner.id } })).searchRadiusKm).toBe(3);
  });
  it('expires approved requests once, releases stock and delivers generic push through a recoverable queue', async () => {
    const f = await fixture(); const listing = await f.listings.createListing(f.owner.id, body()); const req = await f.requests.create(f.neighbour.id, randomUUID(), { listingId: listing.id, quantity: 1, message: '' });
    await f.requests.transition(f.owner.id, randomUUID(), req.body.id, { to: 'approved' }); await db.donationRequest.update({ where: { id: req.body.id }, data: { pickupBy: new Date(Date.now() - 1000) } });
    const sent: string[] = []; const jobs = new MaintenanceService(db, { send: async (tokens, message) => { sent.push(JSON.stringify(message)); return { successCount: tokens.length, invalidTokens: [] }; } });
    expect(await jobs.expireRequests()).toBe(1); expect(await jobs.expireRequests()).toBe(0); expect((await f.listings.getListingDetail(f.owner.id, listing.id)).listing.stock.reserved).toBe(0);
    await jobs.deliverPush(); expect(sent.every(message => !message.includes('PRIVATE') && !message.includes('Children books'))).toBe(true);
  });
});
