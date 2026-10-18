import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { geohashFor, NeedsExtractionSchema, type LatLng } from '@neighbourhood/shared';
import { loadConfig } from '../src/config.js';
import { createDb, type Prisma } from '../src/lib/db.js';
import { PrismaAskService } from '../src/modules/ask/ask.service.js';
import { PrismaNeedsService } from '../src/modules/needs/needs.service.js';
import { PrismaRequestsService } from '../src/modules/requests/requests.service.js';
import { PrismaConversationsService } from '../src/modules/conversations/conversations.service.js';
import { PrismaNotificationsService } from '../src/modules/notifications/notifications.service.js';
import { createStorageBundle } from '../src/lib/storage-bundle.js';
import { ListingsService } from '../src/modules/listings/listings.service.js';
import { seedId, seedCatalog, validateSeedCatalog, catalogListingId, type SeedProduct } from './seed-catalog.js';
import { normalizeImage } from '../src/modules/ask/ask.images.js';

// Additive, deterministic records. Re-running preserves edits, transitions and read markers.
const args=process.argv.slice(2); const option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
if(args.includes('--help')){process.stdout.write('seed:playground [--target-uid UID] [--grant-staff] [--scenario NAME] [--photos-dir PATH] [--refresh-photos] [--allow-production --accounts-file PATH]\n');process.exit(0);}
const config=loadConfig(); const local=['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl!).hostname);
if ((!local || !config.firebase.useEmulators) && !args.includes('--allow-production')) throw new Error('Use --allow-production explicitly with a production configuration.');
if (!config.firebase.projectId || !config.firebase.storageBucket) throw new Error('Configure Firebase Auth and Storage first.');
if (config.firebase.useEmulators && (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST)) throw new Error('Set Auth and Storage emulator hosts.');
const app=initializeApp({projectId:config.firebase.projectId,storageBucket:config.firebase.storageBucket});
const auth=getAuth(app); const db=createDb(config.databaseUrl!);
const id=seedId;
const date=(days:number)=>new Date(Date.now()+days*86400000); const day=(days:number)=>date(days).toISOString().slice(0,10);
const accounts=[['owner','Maya Santoso'],['neighbour','Raka Putra'],['volunteer','Ayu Lestari'],['moderator','Dimas Pratama'],['newcomer','Nina Sari']] as const;
const report=(text:string)=>process.stdout.write(text+'\n');
const customEmails=option('--accounts-file') ? JSON.parse(await readFile(option('--accounts-file')!,'utf8')) as Record<string,string> : {};
if (!config.firebase.useEmulators && accounts.some(([role])=>!customEmails[role]?.includes('@')||customEmails[role]!.endsWith('.test'))) throw new Error('Production seed requires --accounts-file with five real test-account email addresses for normal email OTP sign-in.');
try {
  validateSeedCatalog();
  const sourcePhotos = new Map<string, Buffer>();
  const photoHashes = new Set<string>();
  for (const product of seedCatalog) {
    const custom = option('--photos-dir');
    const file = custom ? path.join(custom, product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.jpg') : fileURLToPath(new URL('../seed-assets/products/' + product.photo + '.jpg', import.meta.url));
    const bytes = await readFile(file);
    const normalized = await normalizeImage(bytes, 'image/jpeg');
    const hash = createHash('sha256').update(normalized).digest('hex');
    if (photoHashes.has(hash)) throw new Error('Different seed products must have different photo contents: ' + product.title);
    photoHashes.add(hash);
    sourcePhotos.set(product.key, bytes);
  }
  const targetUid=option('--target-uid');
  const target=targetUid ? await db.user.findUniqueOrThrow({where:{firebaseUid:targetUid}}) : null;
  const centre:LatLng={lat:target?.homeLat??-6.1905,lng:target?.homeLng??106.8173};
  const point=(km:number,bearing=0):LatLng=>({lat:centre.lat+km*Math.cos(bearing)/111.195,lng:centre.lng+km*Math.sin(bearing)/(111.195*Math.cos(centre.lat*Math.PI/180))});
  const people=[];
  for(const [role,name] of accounts){
    const uid='demo-'+role; const email=customEmails[role]??`${role}@neighbourhood.example.test`;
    try{await auth.getUser(uid);}catch(error){if((error as {code?:string}).code!=='auth/user-not-found')throw error;await auth.createUser({uid,email,displayName:name,emailVerified:true});}
    const existingAuth=await auth.getUser(uid);
    const location=point(role==='neighbour'?0.4:0.2,accounts.findIndex(a=>a[0]===role));
    const current=await db.user.findUnique({where:{firebaseUid:uid}});
    const user=await db.user.upsert({where:{firebaseUid:uid},create:{firebaseUid:uid,email:existingAuth.email??email,emailVerified:true,displayName:name,homeLat:location.lat,homeLng:location.lng,areaLabel:'Kebon Kacang, Jakarta Pusat',searchRadiusKm:3},update:{displayName:current?.displayName?.startsWith('Demo ')?name:current?.displayName??name,homeLat:current?.homeLat??location.lat,homeLng:current?.homeLng??location.lng,areaLabel:current?.areaLabel==='Demo neighbourhood'?'Kebon Kacang, Jakarta Pusat':current?.areaLabel??'Kebon Kacang, Jakarta Pusat'}});
    people.push({...user,role});
  }
  const volunteer=people[2]!,moderator=people[3]!,newcomer=people[4]!;
  const audiences=[...people,...(target&&!people.some(person=>person.id===target.id)?[{...target,role:'your-account'}]:[])];
  if(target && (target.homeLat===null||target.homeLng===null))await db.user.update({where:{id:target.id},data:{homeLat:centre.lat,homeLng:centre.lng,areaLabel:target.areaLabel??'Jakarta Pusat'}});
  for(const who of [moderator,...(target&&args.includes('--grant-staff')?[target]:[])])for(const role of ['staff','product_category_editor'] as const)await db.userRole.upsert({where:{userId_role:{userId:who.id,role}},create:{userId:who.id,role},update:{}});
  const namespace=(target?.id??'default')+(option('--scenario')?':'+option('--scenario'):'');
  const storage=createStorageBundle(config,getStorage(app)); const photoStorage=storage.photos;
  const listingService=new ListingsService(db,photoStorage);
  async function attachPhoto(item:{id:string;ownerId:string}, product: SeedProduct) {
    const existing = await db.listingPhoto.findFirst({where:{listingId:item.id},orderBy:{position:'asc'}});
    const bytes = sourcePhotos.get(product.key)!;
    if (existing) {
      if (args.includes('--refresh-photos')) {
        const normalized = await normalizeImage(bytes, 'image/jpeg');
        let current: Buffer | null = null;
        try { current = await photoStorage.get(existing.storagePath); }
        catch(error) { if (!['NOT_FOUND',404,'ENOENT'].includes((error as {code:string|number}).code)) throw error; }
        if (current?.equals(normalized)) return;
        await listingService.uploadPhoto(item.ownerId,item.id,bytes,'image/jpeg','catalog_refresh_'+item.id+'_'+randomUUID());
        await listingService.removePhoto(item.ownerId,item.id,existing.id,randomUUID());
        return;
      }
      try { await photoStorage.get(existing.storagePath); }
      catch(error) { if (!['NOT_FOUND',404,'ENOENT'].includes((error as {code:string|number}).code)) throw error; await photoStorage.put(existing.storagePath,await normalizeImage(bytes,'image/jpeg'),'image/webp'); }
      return;
    }
    // The existing service normalizes uploads and enforces ownership/limits.
    await listingService.uploadPhoto(item.ownerId,item.id,bytes,'image/jpeg','catalog_v2_'+item.id+'_'+randomUUID());
  }
  const communityId=id(namespace+':community'); const approvalId=id(namespace+':approval-community'); const pointId=id(namespace+':point');
  for(const [community,name,joinPolicy] of [[communityId,'Kebon Kacang Sharing Circle','open'],[approvalId,'Jakarta Neighbours Collective','approval_required']] as const)await db.community.upsert({where:{id:community},create:{id:community,name,areaLabel:'Jakarta Pusat',description:'Neighbours sharing useful goods and helping at local collection points.',joinPolicy},update:{}});
  for(const who of audiences)await db.communityMembership.upsert({where:{communityId_userId:{communityId,userId:who.id}},create:{communityId,userId:who.id,role:who.role==='volunteer'?'volunteer':who.role==='moderator'||who.role==='your-account'?'moderator':'member',status:'active',grantedById:moderator.id},update:{}});
  await db.communityMembership.upsert({where:{communityId_userId:{communityId:approvalId,userId:newcomer.id}},create:{communityId:approvalId,userId:newcomer.id,role:'member',status:'pending'},update:{}});
  for(const who of [moderator,...(target?[target]:[])])await db.communityMembership.upsert({where:{communityId_userId:{communityId:approvalId,userId:who.id}},create:{communityId:approvalId,userId:who.id,role:'moderator',status:'active'},update:{}});
  const pantry=point(0.7,2); await db.communityPoint.upsert({where:{id:pointId},create:{id:pointId,communityId,name:'Kebon Kacang Sharing Pantry',kind:'pantry',partnerName:'Sharing Circle',exactAddress:'Sharing pantry reception, Jakarta Pusat',publicAddressConsent:true,consentedBy:'Dimas Pratama',consentedAt:new Date(),lat:pantry.lat,lng:pantry.lng,geohash:geohashFor(pantry),areaLabel:'Kebon Kacang, Jakarta Pusat',openingHours:'Daily, 09:00–18:00',qrId:id(namespace+':qr')},update:{}});
  const catalogRows=[];
  for(const product of seedCatalog) {
    const giver=people.find(person=>person.role===product.owner)!;
    const location=point(product.km,parseInt(createHash('sha256').update(product.key).digest('hex').slice(0,4),16));
    const pantryProduct=product.owner==='volunteer',stockId=id(product.key==='pantry'?'catalog-v2:pantry-stock':'catalog-v2:'+product.key+':stock');
    const bestBefore=product.bestBeforeDays===undefined?null:new Date(day(product.bestBeforeDays));
    if(pantryProduct) {
      await db.pointInventoryItem.upsert({where:{id:stockId},update:{},create:{id:stockId,pointId,category:product.category,title:product.title,available:product.quantity,bestBefore}});
      await db.stockAdjustment.upsert({where:{id:id(stockId+':audit')},update:{},create:{id:id(stockId+':audit'),pointId,itemId:stockId,delta:product.quantity,reason:'correction',actorId:volunteer.id,note:'Opening inventory count.'}});
    }
    const row=await db.listing.upsert({where:{id:catalogListingId(product.key)},update:{},create:{id:catalogListingId(product.key),ownerId:giver.id,title:product.title,category:product.category,mode:product.mode,status:'draft',description:product.description,condition:'good',stockTotal:product.quantity,lat:pantryProduct?pantry.lat:location.lat,lng:pantryProduct?pantry.lng:location.lng,geohash:geohashFor(pantryProduct?pantry:location),areaLabel:pantryProduct?'Kebon Kacang, Jakarta Pusat':'Jakarta Pusat',collectionMethod:pantryProduct?'community_point':'owner_location',communityPointId:pantryProduct?pointId:null,pointInventoryItemId:pantryProduct?stockId:null,maxLoanDays:product.mode==='lend'?30:null,bestBefore,private:{create:{pickupInstructions:pantryProduct?'Collect during opening hours after approval.':'Please message the owner to agree on the pickup meeting point.',contactNote:'Use the in-app conversation.'}}}});
    await attachPhoto(row,product);
    if(row.status==='draft')await listingService.transitionStatus(row.ownerId,row.id,'active',randomUUID());
    catalogRows.push(await db.listing.findUniqueOrThrow({where:{id:row.id}}));
  }
  const needs=new PrismaNeedsService(db);const requests=new PrismaRequestsService(db);const conversations=new PrismaConversationsService(db);const notifications=new PrismaNotificationsService(db);
  const ask=new PrismaAskService(db,null,storage.ask,{needs,requests,conversations,notifications});
  for(const [userIndex, who] of audiences.entries()){

    for(const item of catalogRows.filter(item=>item.ownerId!==who.id).slice(0,3))await db.savedListing.upsert({where:{userId_listingId:{userId:who.id,listingId:item.id}},create:{userId:who.id,listingId:item.id,title:item.title},update:{}});
    for(const [index,status] of (['pending','approved','collected','rejected','cancelled','expired'] as const).entries()){
      {
        const eligible=catalogRows.filter(item=>item.mode==='donate'&&item.ownerId!==who.id&&item.collectionMethod==='owner_location');
        const item=eligible[index%eligible.length]!,giver=people.find(person=>person.id===item.ownerId)!,receiver=who;
        const requestId=id('catalog-v2:'+who.id+':request:'+status);const created=date(-index-1);
        await db.$transaction(async tx=>{
          if(await tx.donationRequest.findUnique({where:{id:requestId}}))return;
          await tx.donationRequest.create({data:{id:requestId,listingId:item.id,ownerId:giver.id,requesterId:receiver.id,quantity:1,message:'Could we arrange a collection time?',status,pickupBy:status==='approved'?date(3):status==='expired'?date(-2):null,createdAt:created}});
          if(status==='approved'||status==='collected')await tx.listing.update({where:{id:item.id},data:status==='approved'?{stockReserved:{increment:1}}:{stockCollected:{increment:1}}});
          const conversationId=id(requestId+':conversation');await tx.conversation.create({data:{id:conversationId,donationRequestId:requestId,closed:['rejected','cancelled','expired','collected'].includes(status),lastMessageAt:created,participants:{create:[{userId:giver.id,lastReadAt:date(-15)},{userId:receiver.id}]},messages:{create:[{id:id(requestId+':message:1'),senderId:receiver.id,body:'Hi, is an afternoon collection convenient?',createdAt:created},{id:id(requestId+':message:2'),senderId:giver.id,body:'Yes, please use this chat to agree on the time and handover.',createdAt:new Date(created.getTime()+60000)}]}}});
          for(const userId of [giver.id,receiver.id])await tx.notification.create({data:{id:id(requestId+':notification:'+userId),userId,pushSentAt:new Date(),type:status==='pending'?'request_received':'request_'+status,title:status==='pending'?(userId===giver.id?'New item request':'Request sent'):`Request ${status}`,body:`${item.title}: open Activity to see the request and available actions.`,link:'/activity?request='+requestId,createdAt:created,readAt:index%3===0?date(-0.5):null}});
        });
      }
    }
    for(const [index,status] of (['pending','approved','checked_out','returned','rejected','cancelled'] as const).entries()){
      // One representative loan per resident; owners see incoming loans too.
      if(index!==userIndex%6)continue;
      const eligible=catalogRows.filter(item=>item.mode==='lend'&&item.ownerId!==who.id);
      const item=eligible[userIndex%eligible.length]!,lender=people.find(person=>person.id===item.ownerId)!,borrower=who;
      const loanId=id('catalog-v2:'+who.id+':loan');const created=date(status==='returned'?-8:-2-index);
      await db.loan.upsert({where:{id:loanId},update:{},create:{id:loanId,listingId:item.id,ownerId:lender.id,borrowerId:borrower.id,startDate:new Date(day(status==='returned'?-7:status==='checked_out'?-1:3+userIndex*7)),endDate:new Date(day(status==='returned'?-4:status==='checked_out'?2:6+userIndex*7)),status,checkedOutAt:status==='checked_out'?date(-0.1):status==='returned'?date(-7):null,returnedAt:status==='returned'?date(-4):null,returnConditionNote:status==='returned'?'Returned clean with all pieces.':null,message:'I would like to borrow this for a small project.',createdAt:created,conversation:{create:{id:id(loanId+':conversation'),closed:['returned','rejected','cancelled'].includes(status),lastMessageAt:created,participants:{create:[{userId:lender.id},{userId:borrower.id}]},messages:{create:{senderId:lender.id,body:'Please confirm the dates and return all pieces after use.',createdAt:created}}}}}});
      for(const userId of [lender.id,borrower.id])await db.notification.upsert({where:{id:id(loanId+':notification:'+userId)},update:{},create:{id:id(loanId+':notification:'+userId),userId,pushSentAt:new Date(),type:'loan_update',title:`Loan ${status}`,body:item.title+' has an update.',link:'/activity?loan='+loanId,createdAt:created,readAt:index%2?date(-0.2):null}});
    }
    for(const name of ['Picture books','Rice cooker','Camping tent'])await db.need.upsert({where:{id:id(namespace+':'+who.id+':need:'+name)},update:{},create:{id:id(namespace+':'+who.id+':need:'+name),userId:who.id,extraction:NeedsExtractionSchema.parse({language:'en',items:[{name,category:name==='Picture books'?'books':name==='Rice cooker'?'appliances':'household',quantity:1,preference:name==='Camping tent'?'borrow':'donation',attributes:[]}],timing:{neededBy:null,loanDurationDays:name==='Camping tent'?3:null,originalText:null},clarificationQuestions:[],outOfScope:[]})}});
    const sessionId=id(namespace+':'+who.id+':ask');const existing=await db.askSession.findUnique({where:{id:sessionId}});
    if(!existing){
      await db.askSession.create({data:{id:sessionId,userId:who.id,clientId:id(sessionId+':client'),title:'Find books nearby',nextSequence:2,messages:{create:[{role:'user',sequence:0,text:'Can you find picture books within 3 km?'},{role:'assistant',sequence:1,text:'Open an item to review its details, or tell me how far you would like to search.',parts:[{kind:'listings',items:[],search:{radiusKm:3,broaderRadiusKm:null,query:'Picture books',fartherItems:[]}}]}]}}});
      // Replace the result card with live eligible public listings, not invented card IDs.
      const items=await new ListingsService(db).searchListings({searcherId:who.id,center:centre,radiusKm:3,query:'Picture books',limit:10});
      await db.askMessage.update({where:{sessionId_sequence:{sessionId,sequence:1}},data:{parts:[{kind:'listings',items,search:{radiusKm:3,broaderRadiusKm:null,query:'Picture books',fartherItems:[]}}] as unknown as Prisma.InputJsonValue}});
      const bytes=await sharp({create:{width:320,height:240,channels:3,background:'#0f766e'}}).png().toBuffer();
      await ask.upload(who.id,sessionId,bytes,'image/png','playground_colour_v1');
    }
    else {
      const generated = await db.askMessage.findUnique({where:{sessionId_sequence:{sessionId,sequence:1}}});
      if(generated?.text==='Open an item to review its details, or tell me how far you would like to search.') {
        const items=await listingService.searchListings({searcherId:who.id,center:centre,radiusKm:3,query:'Picture books',limit:10});
        await db.askMessage.update({where:{id:generated.id},data:{parts:[{kind:'listings',items,search:{radiusKm:3,broaderRadiusKm:null,query:'Picture books',fartherItems:[]}}] as unknown as Prisma.InputJsonValue}});
      }
    }
    for(const [index,status] of (['proposed','accepted','rejected'] as const).entries()){
      const depositId=id(namespace+':'+who.id+':deposit:'+status); const stockId=id(depositId+':stock');
      await db.deposit.upsert({where:{id:depositId},update:{},create:{id:depositId,pointId,donorId:who.id,items:[{category:'groceries',title:'Rice and beans',quantity:8,bestBefore:day(90)}],status,createdAt:date(-4-index),reviewedById:status==='proposed'?null:volunteer.id,reviewedAt:status==='proposed'?null:date(-index),reviewNote:status==='rejected'?'Packaging was open; please bring sealed items.':status==='accepted'?'Received and checked in person.':null}});
      if(status==='accepted'){
        await db.pointInventoryItem.upsert({where:{id:stockId},update:{},create:{id:stockId,pointId,category:'groceries',title:'Rice and beans',available:8,bestBefore:new Date(day(90))}});
        await db.stockAdjustment.upsert({where:{id:id(stockId+':audit')},update:{},create:{id:id(stockId+':audit'),pointId,itemId:stockId,delta:8,reason:'deposit_accepted',actorId:volunteer.id,depositId,note:'Received and checked in person.'}});
      }
      await db.notification.upsert({where:{id:id(depositId+':notification')},update:{},create:{id:id(depositId+':notification'),userId:who.id,pushSentAt:new Date(),type:'deposit_update',title:status==='proposed'?'Deposit offered':`Deposit ${status}`,body:'Open the collection point to review the deposit.',link:'/communities?point='+pointId,readAt:index===2?date(-1):null}});
    }
    report(`Ready: ${who.displayName??who.role} — requests, loans, messages, updates, saved needs, chat history and deposits`);
  }
  report('Seed complete. One catalog of '+catalogRows.length+' distinct photographed neighbourhood products; workflows reference those products.');
  report(config.firebase.useEmulators?'Local logins at /login: owner / neighbour / volunteer / moderator / newcomer. No password required with emulators.':'Sign in through normal email OTP using the addresses in --accounts-file.');
  report('Existing records were not deleted or reset. Re-running preserves scenario progress.');
} finally {await db.$disconnect();await deleteApp(app);}
