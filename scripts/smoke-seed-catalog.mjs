import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createDb } from '../apps/api/src/lib/db.ts';
import { loadConfig } from '../apps/api/src/config.ts';
import { createStorageBundle } from '../apps/api/src/lib/storage-bundle.ts';
import { normalizeImage } from '../apps/api/src/modules/ask/ask.images.ts';
import { catalogListingId, seedCatalog, validateSeedCatalog } from '../apps/api/scripts/seed-catalog.ts';

const config=loadConfig();
assert(config.firebase.useEmulators&&config.firebase.projectId.startsWith('demo-')&&['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl).hostname),'Local seed database/emulators only');
const db=createDb(config.databaseUrl),app=initializeApp({projectId:config.firebase.projectId,storageBucket:config.firebase.storageBucket});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ids=seedCatalog.map(product=>catalogListingId(product.key));
async function snapshot(){return {listings:await db.listing.findMany({where:{id:{in:ids}},include:{photos:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}}),requests:await db.donationRequest.findMany({orderBy:{id:'asc'}}),loans:await db.loan.findMany({orderBy:{id:'asc'}}),notifications:await db.notification.findMany({orderBy:{id:'asc'}}),saved:await db.savedListing.findMany({orderBy:{id:'asc'}})};}
try{
 validateSeedCatalog();
 const storage=createStorageBundle(config,getStorage(app)).photos,rows=await db.listing.findMany({where:{id:{in:ids}},include:{photos:true,requests:true,loans:true}}),hashes=new Set();
 assert.equal(rows.length,seedCatalog.length);
 for(const product of seedCatalog){const row=rows.find(item=>item.id===catalogListingId(product.key));assert(row.photos.length,'Missing photo: '+product.title);const bytes=await storage.get(row.photos[0].storagePath),expected=await normalizeImage(await readFile(new URL('../apps/api/seed-assets/products/'+product.photo+'.jpg',import.meta.url)),'image/jpeg');assert.equal(hash(bytes),hash(expected),'Wrong photo: '+product.title);assert(!hashes.has(hash(bytes)),'A photo was reused across seed products');hashes.add(hash(bytes));assert.equal(row.mode,product.mode);assert.equal(row.category,product.category);assert(row.requests.every(request=>request.ownerId===row.ownerId&&request.requesterId!==row.ownerId));assert(row.loans.every(loan=>loan.ownerId===row.ownerId&&loan.borrowerId!==row.ownerId));assert.equal(row.stockReserved,row.requests.filter(r=>r.status==='approved').reduce((sum,r)=>sum+r.quantity,0));assert.equal(row.stockCollected,row.requests.filter(r=>r.status==='collected').reduce((sum,r)=>sum+r.quantity,0));}
 const before=await snapshot();
 const rerun=spawnSync(process.execPath,['--env-file-if-exists=.env','--import','tsx','scripts/seed-playground.ts'],{cwd:new URL('../apps/api/',import.meta.url),encoding:'utf8',windowsHide:true});assert.equal(rerun.status,0,rerun.stderr.slice(-2000));
 assert.deepEqual(await snapshot(),before,'Rerunning seed changed marketplace state, stock, photos, reads or saved items');
 const bookmarks=await db.savedListing.findMany({include:{listing:true}});assert(bookmarks.every(saved=>saved.title===saved.listing.title),'A bookmark has a stale title');
 console.log(`PASS ${rows.length} matching unique seed photos; ownership/stock integrity; repeat seed preserves listings, workflow states, photos, read markers and bookmarks.`);
}finally{await db.$disconnect();await deleteApp(app);}
