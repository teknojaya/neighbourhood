import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';
import { createDb } from '../apps/api/src/lib/db.ts';
import { removePhotoFixtures } from './photo-fixtures.mjs';
/* global document, innerWidth, innerHeight */
const base = process.env.SMOKE_API_URL ?? 'http://localhost:8080', web = process.env.SMOKE_WEB_URL ?? 'http://localhost:5173';
assert([base, web, process.env.DATABASE_URL, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST].every(value => ['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname)) && process.env.USE_FIREBASE_EMULATORS === 'true');
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }), auth = getAuth(app), db = createDb(process.env.DATABASE_URL);
const out = path.resolve('apps/web/.impeccable/review/brand-activity'); await fs.mkdir(out,{recursive:true});
let browser, fixtureId, phase = 'setup'; const uid = 'photo-policy-' + randomUUID();
async function signIn(uid) {
  const custom = await auth.createCustomToken(uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local-check`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true})}); assert(response.ok);
  return { custom, token:(await response.json()).idToken };
}
async function api(who, route, method='GET', body) {
  const response=await fetch(base+'/api/v1'+route,{method,headers:{Authorization:'Bearer '+who.token,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)}); assert(response.ok, `${route}: HTTP ${response.status}`);return response.status===204?null:response.json();
}
async function login(who, viewport) {
  const context=await browser.newContext({viewport}); const page=await context.newPage(); page.setDefaultTimeout(20000);
  await page.goto(web+'/login'); await page.evaluate(async token=>{const {getFirebaseAuth}=await import('/src/lib/firebase.ts');const {signInWithCustomToken}=await import('/node_modules/.vite/deps/firebase_auth.js');await signInWithCustomToken(getFirebaseAuth(),token);},who.custom);await page.waitForURL(url=>url.pathname==='/');return page;
}
async function shot(page,name) {
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+name);
  await page.waitForFunction(()=>[...document.querySelectorAll('main img, header img')].filter(image=>image.getBoundingClientRect().top<innerHeight).every(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:path.join(out,name+'.png')});
}
try {
  const owner=await signIn('demo-owner'); browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'msedge'});
  const page=await login(owner,{width:440,height:956});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  phase='brand assets';assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#166534');
  for(const asset of ['/icons/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/favicon-32.png','/icons/apple-touch-icon-180.png','/brand/neighbourhood-horizontal-colour.svg'])assert((await page.request.get(web+asset)).ok(),asset);
  for(const [name,width,height] of [['phone',440,956],['small',320,740],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});
    for(const [view,heading] of [['requests','Items you requested'],['loans','Items you’re borrowing'],['shared','My shared items'],['profile','Your search area']]) {
      phase=name+' '+view;
      if(view==='profile')await page.getByRole('link',{name:'Profile',exact:true}).click();
      else {if(!new URL(page.url()).pathname.startsWith('/activity'))await page.getByRole('link',{name:'Activity',exact:true}).click();await page.getByRole('button',{name:({requests:'Requests',loans:'Loans',shared:'Shared items'})[view],exact:true}).click();}
      await page.getByRole('heading',{name:heading,exact:true}).waitFor();
      if(view!=='profile')await page.locator('main a[href^="/listings/"] img').first().waitFor();
      await shot(page,view+'-'+name);
    }
  }
  phase='profile controls';await page.getByText('Edit profile & preferences',{exact:true}).click();await page.getByLabel('Display name',{exact:true}).waitFor();await page.getByRole('button',{name:'Choose location',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Set Profile location'});await dialog.waitFor();assert.notEqual(await dialog.getByLabel('Latitude',{exact:true}).inputValue(),'');await page.getByRole('button',{name:'Close location form',exact:true}).click();
  phase='request and loan directions';await page.goto(web+'/activity');await page.getByRole('button',{name:'Requests for my items',exact:true}).click();await page.getByRole('heading',{name:'Requests for your items',exact:true}).waitFor();await page.goto(web+'/activity?tab=loans');await page.getByRole('button',{name:'Lending out',exact:true}).click();await page.getByRole('heading',{name:'Items you’re lending',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'cancelled',exact:true}).count(),0);
  phase='photo-required direct form';await auth.createUser({uid,email:uid+'@example.test',emailVerified:true});const fixture=await signIn(uid);fixtureId=(await api(fixture,'/me')).userId;await api(fixture,'/me/profile','PUT',{displayName:'Photo policy check',areaLabel:'Jakarta Pusat',homeLocation:{lat:-6.1905,lng:106.8173},searchRadiusKm:3,preferredLanguage:'en'});
  const form=await login(fixture,{width:440,height:956});await form.goto(web+'/share');await form.getByLabel('Item Title *',{exact:true}).fill('Picture books photo check');await form.getByLabel('Category *',{exact:true}).selectOption('books');await form.getByLabel('Private Pickup Instructions *',{exact:true}).fill('Agree collection in chat.');await form.getByRole('button',{name:'Publish Listing',exact:true}).click();await form.getByText('Add a clear photo of the item before publishing.',{exact:true}).waitFor();assert.equal(await db.listing.count({where:{ownerId:fixtureId}}),0);
  await form.getByLabel('Item photo (required)',{exact:true}).setInputFiles('apps/api/seed-assets/products/picture-books.jpg');await form.getByRole('button',{name:'Publish Listing',exact:true}).click();await form.waitForURL(url=>url.searchParams.get('tab')==='giving');await form.getByText('Picture books photo check',{exact:true}).waitFor();const items=await db.listing.findMany({where:{ownerId:fixtureId},include:{photos:true}});assert.equal(items.length,1);assert.equal(items[0].status,'active');assert.equal(items[0].photos.length,1);assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS new brand/favicon assets, requests/loans/shared product photos and status labels, profile controls, 320/440/1440px layouts, photo-required form and publication after upload.');
} catch(error) { console.error(`FAIL ${phase}: ${String(error.message).slice(0,500)}`);process.exitCode=1; }
finally {await browser?.close();if(fixtureId){await removePhotoFixtures(app,db,[fixtureId]);await db.listing.deleteMany({where:{ownerId:fixtureId}});await db.user.delete({where:{id:fixtureId}});}await auth.deleteUser(uid).catch(()=>undefined);await db.$disconnect();await deleteApp(app);}
