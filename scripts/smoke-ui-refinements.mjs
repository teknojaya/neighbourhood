import assert from 'node:assert/strict';
/* global document, innerWidth */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { syntheticMapTile } from './map-test-tiles.mjs';

const web = process.env.SMOKE_WEB_URL ?? 'http://localhost:5173';
assert(['localhost','127.0.0.1'].includes(new URL(web).hostname));
const out = path.resolve(process.env.UI_SCREENSHOT_DIR ?? 'apps/web/.impeccable/review/refinements');
await fs.mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'});
const context = await browser.newContext({viewport:{width:440,height:956},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));const captures=[];let phase='sign in';let tilesRequested=0;
page.on('console', message => { if (message.type() === 'error' && /React Router caught/.test(message.text())) errors.push('Router error boundary'); });
// Automated runs never pan/zoom against OSM's public tile service. This locally authored test tile is visibly synthetic.
const syntheticTiles = async route=>{tilesRequested++;assert.equal(route.request().headers().referer,new URL(web).origin+'/','Tile requests must identify only the app origin');await route.fulfill({contentType:'image/svg+xml',body:syntheticMapTile});};
await page.route('https://tile.openstreetmap.org/**',syntheticTiles);
async function settled(){await page.waitForLoadState('networkidle');}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});captures.push({file,name,viewport:page.viewportSize()});}
try{
 await page.goto(web+'/login');const initialProfile=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/me' && response.ok());await page.getByRole('button',{name:'owner',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');await initialProfile;await settled();await page.getByRole('status',{name:'Loading',exact:true}).waitFor({state:'hidden'});
 phase='Home shortcuts and category filter';
 const nearbyHeading=await page.getByRole('heading',{name:'Nearby items',exact:true}).boundingBox();
 for(const name of ['Community points','Saved needs']){const shortcut=await page.getByRole('link',{name,exact:true}).boundingBox();assert(shortcut.y+shortcut.height<=nearbyHeading.y,'Shortcut must precede Nearby items');}
 for(const [size,width,height] of [['mobile',440,956],['small',320,740],['desktop',1440,900]]){await page.setViewportSize({width,height});await shot('home-filter-'+size);}
 await page.waitForFunction(()=>{const img=document.querySelector('main a[href^="/listings/"] img');return img?.complete&&img.naturalWidth>0;});
 await page.setViewportSize({width:440,height:956});
 const categoryRequest=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/listings' && url.searchParams.get('category')==='books' && response.ok();});
 await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('books');await categoryRequest;
 await page.getByRole('button',{name:'Borrow',exact:true}).click();await page.getByRole('link',{name:'View all',exact:true}).click();await settled();assert.equal(new URL(page.url()).searchParams.get('mode'),'lend');assert.equal(new URL(page.url()).searchParams.get('category'),'books');assert.equal(await page.getByRole('combobox',{name:'Category',exact:true}).inputValue(),'books');
 phase='Ask action pills and attachment choices';await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Ask',exact:true}).click();await settled();
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('dialog',{name:'Chat history'}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'New chat',exact:true}).click();assert(!new URL(page.url()).searchParams.has('chat'));
 await page.getByRole('link',{name:'Saved needs',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add attachments',exact:true}).click();
 await page.getByRole('button',{name:'Take photo',exact:true}).waitFor();await page.getByRole('button',{name:'Photo library',exact:true}).waitFor();
 await shot('ask-photo-options-mobile');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Add attachments',exact:true}).click();const cameraChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Take photo',exact:true}).click();await cameraChooser;
 assert.equal(await page.getByLabel('Take photo',{exact:true}).getAttribute('capture'),'environment');
 await page.getByRole('button',{name:'Add attachments',exact:true}).click();const libraryChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Photo library',exact:true}).click();await libraryChooser;
 for(const [size,width,height] of [['mobile',440,956],['small',320,740],['desktop',1440,900]]){await page.setViewportSize({width,height});await shot('ask-'+size);}
 await page.setViewportSize({width:440,height:520});await page.getByLabel('Message NeighbourHood',{exact:true}).focus();const input=await page.getByLabel('Message NeighbourHood',{exact:true}).boundingBox();const nav=await page.getByRole('navigation',{name:'Main'}).boundingBox();assert(input.y+input.height<=nav.y,'Composer overlaps navigation');await shot('ask-short');
 await page.setViewportSize({width:440,height:956});await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('dialog',{name:'Chat history'}).getByRole('button',{name:'Find books nearby',exact:true}).first().click();await page.getByRole('heading',{name:'Items within 3 km',exact:true}).waitFor();await page.getByRole('button',{name:'5 km',exact:true}).first().click();assert((await page.getByLabel('Message NeighbourHood',{exact:true}).inputValue()).startsWith('Search within 5 km'));await shot('ask-radius-replies-mobile');
 phase='Explore default map, order and radius';await page.setViewportSize({width:440,height:956});await page.goto(web+'/explore');await settled();
 await page.getByRole('region',{name:'Map of your saved location with a 3 kilometre search radius'}).waitFor();await page.getByRole('status',{name:/Loading map/}).waitFor({state:'hidden'});await settled();assert(tilesRequested>0);
 const mapBox=await page.locator('section[aria-label="Search area map"]').boundingBox();const titleBox=await page.getByRole('heading',{name:'Explore',exact:true}).boundingBox();const searchBox=await page.getByLabel('Find an item',{exact:true}).boundingBox();assert(mapBox.y>titleBox.y+titleBox.height && mapBox.y+mapBox.height<searchBox.y,'Map must be between Explore title and search');assert.equal(await page.getByRole('button',{name:'Show map',exact:true}).count(),0);
 const radiusBox=await page.getByText('Search distance · 3 km',{exact:true}).boundingBox();assert(radiusBox.y>=mapBox.y+mapBox.height && radiusBox.y+radiusBox.height<searchBox.y,'Radius must sit below map and above item search');
 assert.equal(await page.locator('.search-map .leaflet-overlay-pane path').count(),2,'Missing radius circle or location dot');await shot('explore-map-mobile-synthetic-tiles');
 assert(await page.locator('.product-map-pin').count()>0,'Seeded public product markers are missing');await page.locator('.product-map-pin').first().click();await page.getByText('Approximate area, not the pickup address.',{exact:true}).waitFor();assert(await page.locator('.leaflet-popup a[href^="/listings/"]').count()>0);await shot('explore-product-area-popup');await page.keyboard.press('Escape');
 await page.setViewportSize({width:320,height:740});await settled();await shot('explore-map-small-synthetic-tiles');await page.setViewportSize({width:440,height:956});
 await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('books');await settled();assert.equal(new URL(page.url()).searchParams.get('category'),'books');await page.reload();await settled();assert.equal(await page.getByRole('combobox',{name:'Category',exact:true}).inputValue(),'books');
 await page.getByText('Search distance · 3 km',{exact:true}).click();await page.getByLabel('Search radius (km)',{exact:true}).fill('7');await page.getByRole('button',{name:'Apply radius',exact:true}).click();await page.getByRole('region',{name:'Map of your saved location with a 7 kilometre search radius'}).waitFor();await page.getByRole('status',{name:/Loading map/}).waitFor({state:'hidden'});await settled();assert.equal(new URL(page.url()).searchParams.get('radius'),'7');
 await page.getByRole('button',{name:'Fit radius',exact:true}).click();await shot('explore-map-radius-7-synthetic-tiles');
 await page.setViewportSize({width:1440,height:900});await settled();await shot('explore-map-desktop-synthetic-tiles');
 await page.getByRole('button',{name:'Hide map',exact:true}).click();assert.equal(await page.locator('.search-map').count(),0);
 phase='map tile failure';await page.unroute('https://tile.openstreetmap.org/**');await page.route('https://tile.openstreetmap.org/**',route=>route.abort());await page.getByRole('button',{name:'Show map',exact:true}).click();await page.getByText('Map tiles couldn’t load.',{exact:false}).waitFor();await page.setViewportSize({width:440,height:956});await shot('explore-map-error');
 await page.unroute('https://tile.openstreetmap.org/**');await page.route('https://tile.openstreetmap.org/**',syntheticTiles);await page.getByRole('button',{name:'Retry map',exact:true}).click();await page.getByRole('status',{name:/Loading map/}).waitFor({state:'hidden'});await settled();assert.equal(await page.getByRole('button',{name:'Retry map',exact:true}).count(),0);
 phase='location missing';await page.route('**/api/v1/me',async route=>{const response=await route.fetch();const me=await response.json();me.profile.homeLocation=null;me.profile.areaLabel=null;await route.fulfill({response,json:me});});
 await page.goto(web+'/');await settled();await page.getByRole('heading',{name:'Choose your search area',exact:true}).waitFor();assert.equal(await page.getByRole('status',{name:'Loading',exact:true}).count(),0);await shot('home-no-location');
 await page.goto(web+'/explore');await settled();await page.getByRole('heading',{name:'Choose your search area',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Show map',exact:true}).count(),0);await shot('explore-no-location');
 await page.unroute('**/api/v1/me');
 phase='real pending profile skeleton';let releaseProfile;const profileGate=new Promise(resolve=>{releaseProfile=resolve;});await page.route('**/api/v1/me',async route=>{await profileGate;await route.continue();});await page.goto(web+'/');await page.getByRole('status',{name:'Loading',exact:true}).waitFor();await shot('home-profile-loading');releaseProfile();await settled();await page.unroute('**/api/v1/me');
 phase='real pending listings skeleton';let releaseItems;const itemGate=new Promise(resolve=>{releaseItems=resolve;});await page.route('**/api/v1/listings?**',async route=>{await itemGate;await route.continue();});await page.reload();await page.getByRole('status',{name:'Loading',exact:true}).waitFor();await shot('home-items-loading');releaseItems();await settled();await page.unroute('**/api/v1/listings?**');
 assert.equal(errors.length,0,'Runtime error');
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),mapTiles:'Locally authored synthetic test tiles; no automated traffic to OSM',captures,checks:['Home shortcuts above Nearby items','Category filter sends real listing query and carries selection/mode into Explore','History and new-chat pills','Saved-needs icon link','Single attachment + and both native file pickers','Short viewport composer','Map open below Explore title, center dot/radius circle, changing radius, fit/hide and failure','Explore category survives reload','No location is setup state, not perpetual loading','Pending Profile and listing skeletons','No overflow or runtime errors']},null,2));
 console.log(`PASS Ask icon controls, native camera/library choices, loading/no-location states, map radius and error handling; ${captures.length} captures`);
}catch(error){console.error(`FAIL ${phase}: ${String(error.message).split('\n').slice(0,5).join(' ')}`);console.error(errors);await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});await fs.writeFile(path.join(out,'failure.txt'),await page.locator('body').innerText());process.exitCode=1;}
finally{await browser.close();}
