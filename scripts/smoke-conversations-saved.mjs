import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { chromium } from 'playwright';
import { createDb } from '../apps/api/src/lib/db.ts';
import { stubMapTiles } from './map-test-tiles.mjs';
/* global document, innerWidth */

const base = process.env.SMOKE_API_URL ?? 'http://localhost:8080', web = process.env.SMOKE_WEB_URL ?? 'http://localhost:5173';
const local = value => ['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname);
assert([base, web, process.env.DATABASE_URL, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, 'http://' + process.env.FIREBASE_STORAGE_EMULATOR_HOST].every(local) && process.env.USE_FIREBASE_EMULATORS === 'true');
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET }, 'conversation-check-' + randomUUID());
const auth = getAuth(app), db = createDb(process.env.DATABASE_URL), bucket = getStorage(app).bucket();
const users = []; let browser, phase = 'setup'; const errors = [];
const out = path.resolve('apps/web/.impeccable/review/conversations-saved'); await fs.mkdir(out, { recursive: true });
async function api(who, route, method = 'GET', body, status) {
  const response = await fetch(base + '/api/v1' + route, { method, headers: { Authorization: 'Bearer ' + who.token, 'Idempotency-Key': randomUUID(), 'Content-Type': Buffer.isBuffer(body) ? 'image/jpeg' : 'application/json' }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  assert(status ? response.status === status : response.ok, `${phase}: HTTP ${response.status}`);
  return response.status === 204 || status && status >= 400 ? null : response.json();
}
async function user(name) {
  const who = { uid: 'conversation-check-' + randomUUID() }; users.push(who);
  await auth.createUser({ uid: who.uid, email: who.uid + '@example.test', emailVerified: true }); who.custom = await auth.createCustomToken(who.uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: who.custom, returnSecureToken: true }) }); assert(response.ok); who.token = (await response.json()).idToken;
  who.id = (await api(who, '/me')).userId; await api(who, '/me/profile', 'PUT', { displayName: name, preferredLanguage: 'en', areaLabel: 'Jakarta Pusat', homeLocation: { lat: -6.1905, lng: 106.8173 }, searchRadiusKm: 3 }); return who;
}
async function login(who) {
  const context = await browser.newContext({ viewport: { width: 440, height: 956 }, reducedMotion: 'reduce' }); await stubMapTiles(context); const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  // Keep browser and fixture requests on the same explicitly selected local API.
  await page.route('**/api/v1/**', async route => {
    const source = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(source.pathname + source.search, base).href });
    await route.fulfill({ response });
  });
  await page.goto(web + '/login'); await page.evaluate(async custom => { const { getFirebaseAuth } = await import('/src/lib/firebase.ts'); const { signInWithCustomToken } = await import('/node_modules/.vite/deps/firebase_auth.js'); await signInWithCustomToken(getFirebaseAuth(), custom); }, who.custom); await page.waitForURL(url => url.pathname === '/'); return page;
}
async function shot(page, name) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow'); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); }
async function loaded(page, selector) { await page.waitForFunction(selector => { const image = document.querySelector(selector); return image?.complete && image.naturalWidth > 0; }, selector); }
try {
  const owner = await user('Photo owner'), neighbour = await user('Photo neighbour'), outsider = await user('Other neighbour');
  const listing = await api(owner, '/listings', 'POST', { mode: 'donate', category: 'books', title: 'Picture books ' + randomUUID().slice(0,6), description: 'Books to share with a neighbour.', condition: 'good', quantity: 5, areaLabel: 'Jakarta Pusat', exactLocation: { lat: -6.1905, lng: 106.8173 }, pickupInstructions: 'Agree a time in the private chat.', collection: { method: 'owner_location', communityPointId: null } });
  const item = listing.listing ?? listing; const bytes = await fs.readFile('apps/api/seed-assets/products/picture-books.jpg'); await api(owner, `/listings/${item.id}/photos`, 'POST', bytes); await api(owner, `/listings/${item.id}/transition`, 'POST', {to:'active'});
  const request = await api(neighbour, '/requests', 'POST', { listingId: item.id, quantity: 1, message: 'Could I collect these books?' }); assert(request.conversationId); const conversationId = request.conversationId;
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' }); const recipient = await login(neighbour), donor = await login(owner);
  phase = 'bookmark details and persistence'; await recipient.goto(web + '/listings/' + item.id); await recipient.getByRole('button', { name: 'Save item: ' + item.title, exact: true }).click(); await recipient.getByRole('button', { name: 'Remove from saved items: ' + item.title, exact: true }).waitFor(); assert.equal((await api(outsider, '/saved-items/ids')).ids.length, 0);
  await recipient.goto(web + '/saved-items'); await recipient.getByRole('link', { name: new RegExp(item.title) }).waitFor(); await loaded(recipient, 'main a[href^="/listings/"] img'); await shot(recipient, 'saved-items-mobile'); await recipient.reload(); await recipient.getByRole('button', { name: 'Remove from saved items: ' + item.title, exact: true }).click(); await recipient.getByRole('heading', { name: 'Nothing saved yet', exact: true }).waitFor(); await shot(recipient, 'saved-items-empty-mobile');
  phase = 'product thumbnail and back affordance'; await recipient.goto(web + '/messages?conversation=' + conversationId); await recipient.getByRole('link', { name: 'All conversations', exact: true }).waitFor(); assert(await recipient.getByRole('link', { name: 'All conversations', exact: true }).locator('svg').count()); await loaded(recipient, 'main a[href^="/listings/"] img');
  phase = 'private photo upload'; const upload = recipient.waitForResponse(response => new URL(response.url()).pathname.endsWith('/attachments') && response.request().method() === 'POST'); await recipient.getByLabel('Add photo', { exact: true }).setInputFiles('apps/api/seed-assets/products/cotton-clothing.jpg'); const uploaded = await upload; assert(uploaded.ok()); await loaded(recipient, 'img[alt="Pending message photo"]'); const photo = (await api(neighbour, '/conversations/' + conversationId)).pendingAttachments[0]; assert(photo); await api(owner, `/conversations/${conversationId}/attachments/${photo.id}`, 'GET', undefined, 404); await api(outsider, `/conversations/${conversationId}/attachments/${photo.id}`, 'GET', undefined, 404); await shot(recipient, 'message-pending-photo-mobile');
  phase = 'photo-only send and cross-browser view'; await recipient.getByRole('button', { name: 'Send message', exact: true }).click(); await loaded(recipient, 'img[alt="Photo in this conversation"]'); await donor.goto(web + '/messages?conversation=' + conversationId); await loaded(donor, 'img[alt="Photo in this conversation"]'); assert.equal((await api(owner, `/conversations/${conversationId}/messages`)).items.filter(message => message.attachments.some(value => value.id === photo.id)).length, 1);
  const savedPhoto = await db.conversationAttachment.findUniqueOrThrow({ where: { id: photo.id } }); assert(savedPhoto.messageId); assert((await bucket.file(savedPhoto.storagePath).exists())[0]);
  for (const [name,width,height] of [['mobile',440,956],['small',320,740],['desktop',1440,900]]) { await donor.setViewportSize({ width,height }); await shot(donor, 'message-received-photo-' + name); }
  await recipient.getByRole('link', { name: 'All conversations', exact: true }).click(); await loaded(recipient, 'main a[href*="conversation="] img'); await shot(recipient, 'conversation-list-product-photo');
  assert.equal(errors.length, 0, errors.join('\n')); console.log('PASS two independent browsers: bookmark persistence/removal/privacy, product thumbnails/back chevron, private pending upload and photo-only send with real bucket bytes');
} catch (error) { console.error(`FAIL ${phase}: ${String(error.message).slice(0,500)}`); const page = browser?.contexts()[0]?.pages()[0]; if (page) { await shot(page, 'failure'); await fs.writeFile(path.join(out, 'failure.txt'), await page.locator('body').innerText()); } process.exitCode = 1; }
finally {
  await browser?.close(); const ids = users.map(user => user.id).filter(Boolean);
  for (const photo of await db.conversationAttachment.findMany({ where: { uploaderId: { in: ids } } })) await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
  for (const photo of await db.listingPhoto.findMany({ where: { listing: { ownerId: { in: ids } } } })) await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
  await db.donationRequest.deleteMany({ where: { ownerId: { in: ids } } }); await db.listing.deleteMany({ where: { ownerId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  for (const user of users) await auth.deleteUser(user.uid).catch(() => undefined); await db.$disconnect(); await deleteApp(app);
}
