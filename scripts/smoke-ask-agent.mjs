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
/* global document, window, MutationObserver, innerWidth */

const base = process.env.SMOKE_API_URL ?? 'http://localhost:8080';
const web = process.env.SMOKE_WEB_URL ?? 'http://localhost:5173';
assert([base, web, process.env.DATABASE_URL].every(value => ['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname)) && process.env.USE_FIREBASE_EMULATORS === 'true');
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET }, 'ask-agent-' + randomUUID());
const auth = getAuth(app), db = createDb(process.env.DATABASE_URL), bucket = getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET);
const uid = 'ask-agent-' + randomUUID(); let browser, token; let phase = 'setup'; let streams = 0;
const out = path.resolve('apps/web/.impeccable/review/ask-agent'); await fs.mkdir(out, { recursive: true });
async function api(route, method = 'GET', body) { const response = await fetch(base + '/api/v1' + route, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); assert(response.ok, `HTTP ${response.status}`); return response.status === 204 ? null : response.json(); }
try {
  await auth.createUser({ uid, email: uid + '@example.test', emailVerified: true }); const custom = await auth.createCustomToken(uid);
  const signed = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }); token = (await signed.json()).idToken;
  await api('/me'); await api('/me/profile', 'PUT', { displayName: 'Agent flow check', areaLabel: 'Jakarta Pusat', homeLocation: { lat: -6.1905, lng: 106.8173 }, searchRadiusKm: 3, preferredLanguage: 'en' });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' }); const context = await browser.newContext({ viewport: { width: 440, height: 956 } }); await stubMapTiles(context); const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (new URL(response.url()).pathname.endsWith('/messages') && response.headers()['content-type']?.includes('application/x-ndjson')) streams++; });
  await page.goto(web + '/login'); await page.evaluate(async customToken => { const { getFirebaseAuth } = await import('/src/lib/firebase.ts'); const { signInWithCustomToken } = await import('/node_modules/.vite/deps/firebase_auth.js'); await signInWithCustomToken(getFirebaseAuth(), customToken); }, custom); await page.waitForURL(url => url.pathname === '/'); await page.goto(web + '/needs');
  async function observeStreaming() { await page.evaluate(() => { window.askPartialSeen = false; new MutationObserver(() => { const reply = document.querySelector('[aria-label="Assistant response"]'); if (reply?.querySelectorAll('p').length > 1) window.askPartialSeen = true; }).observe(document.body, { childList: true, subtree: true, characterData: true }); }); }
  await observeStreaming();
  async function send(text) { await page.getByLabel('Message NeighbourHood', { exact: true }).fill(text); const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/messages') && response.request().method() === 'POST', { timeout: 65000 }); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ timeout: 65000 }); const streamed = await response; assert(streamed.ok(), `Message HTTP ${streamed.status()}`); await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 65000 }); assert.equal(await page.getByRole('button', { name: 'Try again', exact: true }).count(), 0, 'Assistant turn failed'); }
  async function shot(name) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow'); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); }
  phase = 'first photo preview'; await page.getByRole('button', { name: 'Add attachments', exact: true }).waitFor(); await page.getByLabel('Add photo', { exact: true }).setInputFiles('apps/api/seed-assets/products/cotton-clothing.jpg');
  await page.waitForURL(url => url.searchParams.has('chat')); await page.locator('.composer img[alt="Photo attached to your AI chat"]').waitFor(); await page.waitForFunction(() => { const image = document.querySelector('.composer img'); return image?.complete && image.naturalWidth > 0; }); await shot('first-upload-preview');
  phase = 'interactive clarification'; await send('I want to donate these clothes. Please ask me the missing details using answer choices before drafting.'); await page.getByRole('button', { name: 'Use these answers', exact: true }).last().waitFor();
  const questions = page.locator('fieldset'); assert(await questions.count() >= 1 && await questions.count() <= 4); for (const question of await questions.all()) { const choice = question.getByRole('button').first(); if (await choice.count()) await choice.click(); else await question.getByRole('textbox').fill('Use my saved Profile location.'); }
  await page.getByRole('button', { name: 'Use these answers', exact: true }).last().click(); assert((await page.getByLabel('Message NeighbourHood', { exact: true }).inputValue()).length > 0); assert.equal((await db.listing.count({ where: { owner: { firebaseUid: uid } } })), 0); await shot('question-options-mobile');
  const title = 'Cotton jackets ' + uid.slice(-8);
  phase = 'draft with first-message image'; await send(`Give away 2 jackets, good condition, clothing category. Use my saved Profile location for pickup. Title: ${title}. Description: Two cotton jackets for sharing. Please prepare the private draft with my uploaded photo. Do not publish yet.`); await page.getByRole('heading', { name: 'Private listing draft', exact: true }).last().waitFor(); await page.locator('[aria-label="Draft photos"] img').last().waitFor(); assert.equal(await db.listing.count({ where: { owner: { firebaseUid: uid } } }), 0); await shot('photo-draft-mobile');
  phase = 'publication approval'; await send('Publish this for me using my saved Profile location. Prepare the approval card now.'); await page.getByRole('heading', { name: 'Publish this item', exact: true }).last().waitFor(); await page.locator('[aria-label="Photos to publish"] img').last().waitFor(); assert.equal(await db.listing.count({ where: { owner: { firebaseUid: uid } } }), 0); await shot('publish-approval-mobile');
  await page.getByRole('button', { name: 'Confirm', exact: true }).last().click(); await page.getByText('Listing published', { exact: false }).last().waitFor(); const listings = await db.listing.findMany({ where: { owner: { firebaseUid: uid } }, include: { photos: true } }); assert.equal(listings.length, 1); assert.equal(listings[0].photos.length, 1); assert((await bucket.file(listings[0].photos[0].storagePath).exists())[0]);
  phase = 'history reload and listing photo'; await page.reload(); await page.locator('[aria-label="Draft photos"] img').last().waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Draft photos"] img')].every(image => image.complete && image.naturalWidth > 0));
  await page.setViewportSize({ width: 320, height: 740 }); await shot('published-small'); await page.setViewportSize({ width: 1440, height: 900 }); await shot('published-desktop');
  phase = 'streamed product answer'; await observeStreaming(); await send('Explain in six short sentences how donation pickup, privacy and approval work in NeighbourHood. This is product help, not a new task.'); assert(await page.evaluate(() => window.askPartialSeen), 'No partial text was rendered'); assert(streams >= 4, 'UI did not use response streams');
  await page.goto(web + '/listings/' + listings[0].id); await page.waitForFunction(() => { const image = document.querySelector('main img'); return image?.complete && image.naturalWidth > 0; }); assert.equal(errors.length, 0, errors.join('\n'));
  process.stdout.write('PASS real Gemini/browser/bucket: first upload preview, question choices, draft photo, approval-only publication, reload and live partial text\n');
} catch (error) { const page = browser?.contexts()[0]?.pages()[0]; if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); await fs.writeFile(path.join(out, 'failure.txt'), await page.locator('body').innerText()); } console.error(`FAIL ${phase}: ${String(error.message).slice(0,500)}`); process.exitCode = 1; }
finally {
  await browser?.close();
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (user) { for (const photo of await db.listingPhoto.findMany({ where: { listing: { ownerId: user.id } } })) await bucket.file(photo.storagePath).delete({ ignoreNotFound: true }); for (const attachment of await db.askAttachment.findMany({ where: { session: { userId: user.id } } })) await bucket.file(attachment.storagePath).delete({ ignoreNotFound: true }); await db.askSession.deleteMany({ where: { userId: user.id } }); await db.listing.deleteMany({ where: { ownerId: user.id } }); await db.user.delete({ where: { id: user.id } }); }
  await auth.deleteUser(uid).catch(() => undefined); await db.$disconnect(); await deleteApp(app);
}
