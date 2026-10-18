import { publishPhotoFixture, removePhotoFixtures } from './photo-fixtures.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';
import { createDb } from '../apps/api/src/lib/db.ts';

const base = new URL(process.env.SMOKE_API_URL ?? 'http://localhost:8080');
const web = new URL(process.env.SMOKE_WEB_URL ?? 'http://localhost:5173');
const local = value => ['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname);
assert(local(base) && local(web) && local(process.env.DATABASE_URL));
assert(process.env.USE_FIREBASE_EMULATORS === 'true' && process.env.FIREBASE_PROJECT_ID.startsWith('demo-') && local('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST));
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }, 'ui-unread-' + randomUUID());
const auth = getAuth(app), db = createDb(process.env.DATABASE_URL), users = [];
let browser; let phase = 'setup';
const out = path.resolve(process.env.UI_SCREENSHOT_DIR ?? 'apps/web/.impeccable/review');
async function api(who, route, method = 'GET', body) {
  const response = await fetch(new URL('/api/v1' + route, base), { method, headers: { Authorization: 'Bearer ' + who.token, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${route}: HTTP ${response.status}`); return response.status === 204 ? null : response.json();
}
async function user(name) {
  const fixture = { uid: 'ui-unread-' + randomUUID() }; users.push(fixture);
  await auth.createUser({ uid: fixture.uid, displayName: name, email: fixture.uid + '@example.test', emailVerified: true });
  fixture.custom = await auth.createCustomToken(fixture.uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: fixture.custom, returnSecureToken: true }) });
  fixture.token = (await response.json()).idToken; fixture.id = (await api(fixture, '/me')).userId;
  await api(fixture, '/me/profile', 'PUT', { displayName: name, areaLabel: 'Synthetic UI test area', homeLocation: {lat:-6.2,lng:106.816}, searchRadiusKm:3, preferredLanguage:'en' }); return fixture;
}
try {
  const owner = await user('Synthetic UI Owner'), neighbour = await user('Synthetic UI Neighbour');
  const listing = await api(owner, '/listings', 'POST', {mode:'donate',category:'books',title:'Synthetic unread test books',description:'Disposable test fixture',condition:'good',quantity:1,areaLabel:'Synthetic UI test area',exactLocation:{lat:-6.2,lng:106.816},pickupInstructions:'Synthetic private test note',collection:{method:'owner_location',communityPointId:null}});
  await publishPhotoFixture(base,owner,listing);
  const request = await api(neighbour, '/requests', 'POST', {listingId:listing.id,quantity:1,message:'Synthetic initial unread request'});
  await db.notification.createMany({data:Array.from({length:25},()=>({userId:owner.id,type:'message_received',title:'Synthetic test update',body:'Disposable unread update'}))});
  assert.deepEqual(await api(owner,'/notifications/unread'),{messages:1,updates:26});
  phase = 'browser sign-in'; browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'});
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}); const page=await context.newPage(); page.setDefaultTimeout(15000); const errors=[];page.on('pageerror',e=>errors.push(e.name));
  await page.route('**/api/v1/**',async route=>{try{const url=new URL(route.request().url());const response=await route.fetch({url:new URL(url.pathname+url.search,base).href});await route.fulfill({response});}catch{await route.abort().catch(()=>undefined);}});
  await page.goto(new URL('/login',web).href);
  await page.evaluate(async token=>{const {getFirebaseAuth}=await import('/src/lib/firebase.ts');const {signInWithCustomToken}=await import('/node_modules/.vite/deps/firebase_auth.js');await signInWithCustomToken(getFirebaseAuth(),token);},owner.custom);
  await page.waitForURL(url=>url.pathname==='/');
  phase = 'global unread badges';
  await page.getByRole('link',{name:'Messages, 1 unread',exact:true}).waitFor(); await page.getByRole('link',{name:'Updates, 26 unread',exact:true}).waitFor();
  await page.waitForLoadState('networkidle'); await fs.mkdir(out,{recursive:true});
  await page.screenshot({path:path.join(out,'unread-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:900}); await page.screenshot({path:path.join(out,'unread-desktop.png'),fullPage:true}); await page.setViewportSize({width:390,height:844});
  phase='mark message read'; await page.getByRole('link',{name:'Messages, 1 unread',exact:true}).click();
  await page.getByRole('link',{name:/Synthetic unread test books/}).click();
  await page.getByRole('link',{name:'Messages',exact:true}).waitFor();
  assert.equal((await api(owner,'/notifications/unread')).messages,0);
  phase='mark update read'; await page.getByRole('link',{name:'Updates, 26 unread',exact:true}).click();
  await page.getByRole('button',{name:'Mark as read',exact:true}).first().click();
  await page.getByRole('link',{name:'Updates, 25 unread',exact:true}).waitFor();
  assert.equal((await api(owner,'/notifications/unread')).updates,25);
  await page.screenshot({path:path.join(out,'unread-after-read-mobile.png'),fullPage:true});
  phase='new message after watermark'; await api(neighbour,`/conversations/${request.conversationId}/messages`,'POST',{body:'A new synthetic reply'});
  await page.getByRole('link',{name:'Messages, 1 unread',exact:true}).waitFor({timeout:22000});
  assert.equal(errors.length,0);
  await fs.writeFile(path.join(out,'unread-checks.json'),JSON.stringify({capturedAt:new Date().toISOString(),checks:['Global count independent of first page','Accessible badges','Message-read clears count','Update-read decrements global count','Newer message raises unread count again'],captures:['unread-mobile.png','unread-desktop.png','unread-after-read-mobile.png']},null,2));
  console.log('PASS real global unread badges, accessible names, message watermark, update read and new incoming message');
} catch(error) { console.error(`FAIL ${phase}: ${error instanceof assert.AssertionError ? error.message : error.name}`); process.exitCode=1; }
finally {
 await browser?.close();const ids=users.map(u=>u.id).filter(Boolean);
 try {await removePhotoFixtures(app,db,ids); await db.donationRequest.deleteMany({where:{ownerId:{in:ids}}});await db.listing.deleteMany({where:{ownerId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});for(const u of users)await auth.deleteUser(u.uid);console.log('Removed disposable unread fixtures');}catch{console.error('Unread fixture cleanup needs attention');process.exitCode=1;}
 await db.$disconnect();await deleteApp(app);
}
