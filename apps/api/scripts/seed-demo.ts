import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createStorageBundle } from '../src/lib/storage-bundle.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/lib/db.js';
import { ListingsService } from '../src/modules/listings/listings.service.js';
import { CommunitiesService } from '../src/modules/communities/communities.service.js';
import { CreateListingBodySchema } from '@neighbourhood/shared';

const config = loadConfig();
if (!config.firebase.useEmulators || !config.firebase.projectId?.startsWith('demo-') || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.databaseUrl!).hostname)) throw new Error('Demo seed requires local database and demo Firebase emulators');
const app = initializeApp({ projectId: config.firebase.projectId }); const auth = getAuth(app); const db = createDb(config.databaseUrl!);
try {
  const people = [];
  for (const [uid, name] of [['demo-owner', 'Demo Owner'], ['demo-neighbour', 'Demo Neighbour'], ['demo-volunteer', 'Demo Volunteer']] as const) {
    try { await auth.getUser(uid); } catch (err) { if ((err as { code?: string }).code !== 'auth/user-not-found') throw err; await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true, displayName: name }); }
    people.push(await db.user.upsert({ where: { firebaseUid: uid }, create: { firebaseUid: uid, email: `${uid}@example.test`, emailVerified: true, displayName: name, areaLabel: 'Demo neighbourhood', homeLat: -6.2, homeLng: 106.816, searchRadiusKm: 3 }, update: {} }));
  }
  const [owner, neighbour, volunteer] = people;
  await db.userRole.upsert({ where: { userId_role: { userId: volunteer!.id, role: 'staff' } }, create: { userId: volunteer!.id, role: 'staff' }, update: {} });
  const listings = new ListingsService(db, createStorageBundle(config, getStorage(app)).photos);
  const base = CreateListingBodySchema.parse({ mode: 'donate', category: 'books', title: 'Picture books for a new reader', description: 'A set of illustrated children books in good condition.', condition: 'good', quantity: 4, areaLabel: 'Demo neighbourhood', exactLocation: { lat: -6.2, lng: 106.816 }, pickupInstructions: 'Demo fixture: arrange a pickup time in chat.', collection: { method: 'owner_location', communityPointId: null } });
  const marker = await db.listing.findFirst({ where: { ownerId: owner!.id, title: base.title } });
  if (!marker) await listings.createListing(owner!.id, base, 'demo_books_'+randomUUID());
  if (!await db.listing.findFirst({ where: { ownerId: owner!.id, title: 'Borrow a household tool set' } })) await listings.createListing(owner!.id, { ...base, title: 'Borrow a household tool set', description: 'Basic household hand tools for small projects. Return clean and complete.', category: 'household', mode: 'lend', quantity: 1, lending: { maxLoanDays: 7, depositRequired: false, notes: 'Return all pieces.' } }, 'demo_tools_'+randomUUID());
  for (const item of await db.listing.findMany({ where: { ownerId: owner!.id, title: { in: [base.title, 'Borrow a household tool set'] } }, include: { photos: true } })) {
    if (!item.photos.length) await listings.uploadPhoto(owner!.id, item.id, await readFile(new URL(`../seed-assets/products/${item.category === 'books' ? 'picture-books' : 'tool-kit'}.jpg`, import.meta.url)), 'image/jpeg', `seed_photo_${item.id}_${randomUUID()}`);
    if (item.status === 'draft') await listings.transitionStatus(owner!.id, item.id, 'active', `seed_publish_${item.id}`);
  }
  const communities = new CommunitiesService(db);
  let community = await db.community.findFirst({ where: { name: 'Demo sharing circle' } });
  if (!community) { const created = await communities.create(volunteer!.id, 'demo_community_v1', { name: 'Demo sharing circle', areaLabel: 'Demo neighbourhood', description: 'Local demo community with a partner pantry.', joinPolicy: 'open' }); community = await db.community.findUniqueOrThrow({ where: { id: created.body.id } }); }
  await communities.join(neighbour!.id, 'demo_join_v1', community.id);
  if (!await db.communityPoint.findFirst({ where: { communityId: community.id } })) await communities.createPoint(volunteer!.id, 'demo_point_v1', community.id, { name: 'Demo community pantry', kind: 'pantry', partnerName: 'Demo partner', exactAddress: 'Demo fixture address', publicAddressConsent: true, consentedBy: 'Demo Volunteer', location: { lat: -6.2, lng: 106.816 }, areaLabel: 'Demo neighbourhood', openingHours: 'Demo: 09:00–17:00' });
  process.stdout.write('Demo owner, neighbour, staff volunteer, donation/lending items and community point are ready. No existing records were reset.\n');
} finally { await db.$disconnect(); await deleteApp(app); }
