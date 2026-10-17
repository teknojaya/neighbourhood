import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { geohashFor, NeedsExtractionSchema, type ItemCategory, type LatLng } from '@neighbourhood/shared';
import { loadConfig } from '../src/config.js';
import { createDb, type Prisma } from '../src/lib/db.js';
import { PrismaAskService } from '../src/modules/ask/ask.service.js';
import { FirebaseAskImageStorage } from '../src/modules/ask/ask.images.js';
import { PrismaNeedsService } from '../src/modules/needs/needs.service.js';
import { PrismaRequestsService } from '../src/modules/requests/requests.service.js';
import { PrismaConversationsService } from '../src/modules/conversations/conversations.service.js';
import { PrismaNotificationsService } from '../src/modules/notifications/notifications.service.js';
import { FirebaseObjectStorage } from '../src/lib/storage.js';
import { ListingsService } from '../src/modules/listings/listings.service.js';
import { normalizeImage } from '../src/modules/ask/ask.images.js';

// Additive, deterministic records. Re-running preserves edits, transitions and read markers.
const args=process.argv.slice(2); const option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
if(args.includes('--help')){process.stdout.write('seed:playground [--target-uid UID] [--grant-staff] [--scenario NAME] [--photos-dir PATH] [--allow-production --accounts-file PATH]\n');process.exit(0);}
const config=loadConfig(); const local=['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl!).hostname);
if ((!local || !config.firebase.useEmulators) && !args.includes('--allow-production')) throw new Error('Use --allow-production explicitly with a production configuration.');
if (!config.firebase.projectId || !config.firebase.storageBucket) throw new Error('Configure Firebase Auth and Storage first.');
if (config.firebase.useEmulators && (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST)) throw new Error('Set Auth and Storage emulator hosts.');
const app=initializeApp({projectId:config.firebase.projectId,storageBucket:config.firebase.storageBucket});
const auth=getAuth(app); const db=createDb(config.databaseUrl!);
const id=(key:string)=>{const hex=createHash('sha256').update('neighbourhood-playground-v1:'+key).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;};
const date=(days:number)=>new Date(Date.now()+days*86400000); const day=(days:number)=>date(days).toISOString().slice(0,10);
const accounts=[['owner','Maya Santoso'],['neighbour','Raka Putra'],['volunteer','Ayu Lestari'],['moderator','Dimas Pratama'],['newcomer','Nina Sari']] as const;
const report=(text:string)=>process.stdout.write(text+'\n');
const customEmails=option('--accounts-file') ? JSON.parse(await readFile(option('--accounts-file')!,'utf8')) as Record<string,string> : {};
if (!config.firebase.useEmulators && accounts.some(([role])=>!customEmails[role]?.includes('@')||customEmails[role]!.endsWith('.test'))) throw new Error('Production seed requires --accounts-file with five real test-account email addresses for normal email OTP sign-in.');
try {
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
  const owner=people[0]!,neighbour=people[1]!,volunteer=people[2]!,moderator=people[3]!,newcomer=people[4]!;
  const audiences=[...people,...(target?[{...target,role:'your-account'}]:[])];
  if(target && (target.homeLat===null||target.homeLng===null))await db.user.update({where:{id:target.id},data:{homeLat:centre.lat,homeLng:centre.lng,areaLabel:target.areaLabel??'Jakarta Pusat'}});
  for(const who of [moderator,...(target&&args.includes('--grant-staff')?[target]:[])])for(const role of ['staff','product_category_editor'] as const)await db.userRole.upsert({where:{userId_role:{userId:who.id,role}},create:{userId:who.id,role},update:{}});
  const namespace=(target?.id??'default')+(option('--scenario')?':'+option('--scenario'):'');
  const bundledPhotos=fileURLToPath(new URL('../seed-assets/products/',import.meta.url));
  const photoStorage=new FirebaseObjectStorage(getStorage(app),config.firebase.storageBucket);
  const listingService=new ListingsService(db,photoStorage);
  const photoFor=(title:string)=> /books/i.test(title)?'picture-books':/pantry|rice and beans/i.test(title)?'pantry-staples':/jacket|scarf/i.test(title)?'cotton-clothing':/plates|bowls/i.test(title)?'tableware':/rice cooker/i.test(title)?'rice-cooker':/tool|drill/i.test(title)?'tool-kit':/walking aid/i.test(title)?'walking-aid':null;
  async function attachPhoto(item:{id:string;ownerId:string;title:string}){
    const existing=await db.listingPhoto.findFirst({where:{listingId:item.id},orderBy:{position:'asc'}});
    const asset=photoFor(item.title);const custom=option('--photos-dir');
    if(!asset&&!custom)return;
    const file=custom?path.join(custom,item.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.jpg'):path.join(bundledPhotos,asset+'.jpg');
    try{
      if(existing){if(!(await getStorage(app).bucket(config.firebase.storageBucket).file(existing.storagePath).exists())[0])await photoStorage.put(existing.storagePath,await normalizeImage(await readFile(file),'image/jpeg'),'image/webp');return;}
      await listingService.uploadPhoto(item.ownerId,item.id,await readFile(file),'image/jpeg','playground_photo_'+item.id+'_v1');
    }catch(error){if(!custom||(error as {code?:string}).code!=='ENOENT')throw error;}
  }
  const communityId=id(namespace+':community'); const approvalId=id(namespace+':approval-community'); const pointId=id(namespace+':point');
  for(const [community,name,joinPolicy] of [[communityId,'Kebon Kacang Sharing Circle','open'],[approvalId,'Jakarta Neighbours Collective','approval_required']] as const)await db.community.upsert({where:{id:community},create:{id:community,name,areaLabel:'Jakarta Pusat',description:'Neighbours sharing useful goods and helping at local collection points.',joinPolicy},update:{}});
  for(const who of audiences)await db.communityMembership.upsert({where:{communityId_userId:{communityId,userId:who.id}},create:{communityId,userId:who.id,role:who.role==='volunteer'?'volunteer':who.role==='moderator'||who.role==='your-account'?'moderator':'member',status:'active',grantedById:moderator.id},update:{}});
  await db.communityMembership.upsert({where:{communityId_userId:{communityId:approvalId,userId:newcomer.id}},create:{communityId:approvalId,userId:newcomer.id,role:'member',status:'pending'},update:{}});
  for(const who of [moderator,...(target?[target]:[])])await db.communityMembership.upsert({where:{communityId_userId:{communityId:approvalId,userId:who.id}},create:{communityId:approvalId,userId:who.id,role:'moderator',status:'active'},update:{}});
  const pantry=point(0.7,2); await db.communityPoint.upsert({where:{id:pointId},create:{id:pointId,communityId,name:'Kebon Kacang Sharing Pantry',kind:'pantry',partnerName:'Sharing Circle',exactAddress:'Sharing pantry reception, Jakarta Pusat',publicAddressConsent:true,consentedBy:'Dimas Pratama',consentedAt:new Date(),lat:pantry.lat,lng:pantry.lng,geohash:geohashFor(pantry),areaLabel:'Kebon Kacang, Jakarta Pusat',openingHours:'Daily, 09:00–18:00',qrId:id(namespace+':qr')},update:{}});
  async function listing(key:string,ownerId:string,title:string,category:ItemCategory,km:number,mode:'donate'|'lend'='donate',status:'active'|'paused'|'closed'='active'){
    const location=point(km,parseInt(createHash('sha256').update(key).digest('hex').slice(0,4),16));
    const listingId=id(namespace+':listing:'+key);
    const row=await db.listing.upsert({where:{id:listingId},update:{},create:{id:listingId,ownerId,title,category,mode,status,description:`${title}. Available for neighbourhood ${mode==='donate'?'sharing':'borrowing'}. Please agree on a collection time in chat.`,condition:'good',stockTotal:mode==='lend'?1:40,lat:location.lat,lng:location.lng,geohash:geohashFor(location),areaLabel:km>10?'Greater Jakarta':'Jakarta Pusat',collectionMethod:'owner_location',maxLoanDays:mode==='lend'?30:null,private:{create:{pickupInstructions:'Please message the owner to agree on the pickup meeting point.',contactNote:'Use the in-app conversation.'}}}});
    await attachPhoto(row);return row;
  }
  const catalog:[string,ItemCategory,number,'donate'|'lend'][]=[['Picture books','books',0.5,'donate'],['Rice and pantry staples','groceries',1.2,'donate'],['Cotton jackets','clothing',1.8,'donate'],['Dinner plates','household',2.2,'donate'],['Rice cooker','appliances',2.6,'donate'],['Walking aid','mobility_aids',2.8,'lend'],['Cordless drill','household',4.5,'lend'],['Folding table','household',6.5,'lend'],['Children books','books',9,'donate'],['Sewing machine','appliances',16,'lend'],['Camping tent','household',28,'lend'],['Bicycle helmet','household',44,'donate'],['Garden trolley','household',65,'lend']];
  const catalogRows=[];for(const [index,[title,category,km,mode]] of catalog.entries())catalogRows.push(await listing('catalog:'+index,index%2?owner.id:neighbour.id,title,category,km,mode));
  const needs=new PrismaNeedsService(db);const requests=new PrismaRequestsService(db);const conversations=new PrismaConversationsService(db);const notifications=new PrismaNotificationsService(db);
  const ask=new PrismaAskService(db,null,new FirebaseAskImageStorage(getStorage(app),config.firebase.storageBucket),{needs,requests,conversations,notifications});
  for(const who of audiences){
    const counterpart=who.id===owner.id?neighbour:owner;
    for(const item of catalogRows.filter(item=>item.ownerId!==who.id).slice(0,3))await db.savedListing.upsert({where:{userId_listingId:{userId:who.id,listingId:item.id}},create:{userId:who.id,listingId:item.id,title:item.title},update:{}});
    for(const [index,status] of (['pending','approved','collected','rejected','cancelled','expired'] as const).entries()){
      for(const incoming of [false,true]){
        const giver=incoming?who:counterpart,receiver=incoming?counterpart:who;
        const item=await listing(`${who.id}:request:${incoming}:${status}`,giver.id,['Story books','Kitchen bowls','Reading lamp','Cotton scarf','Storage basket','Pantry food parcel'][index]!,(index===5?'groceries':index===0?'books':'household'),7+index*0.15,'donate',status==='pending'||status==='approved'?'active':'paused');
        const requestId=id(`${namespace}:${who.id}:request:${incoming}:${status}`);const created=date(-index-1);
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
      const incoming=index%2===1; const lender=incoming?who:counterpart,borrower=incoming?counterpart:who;
      const item=await listing(`${who.id}:loan:${status}`,lender.id,['Tool kit','Projector','Folding ladder','Board games','Camping stove','Hand trolley'][index]!,'household',8+index*0.2,'lend',status==='returned'||status==='rejected'||status==='cancelled'?'paused':'active');
      const loanId=id(`${namespace}:${who.id}:loan:${status}`);const created=date(status==='returned'?-8:-2-index);
      await db.loan.upsert({where:{id:loanId},update:{},create:{id:loanId,listingId:item.id,ownerId:lender.id,borrowerId:borrower.id,startDate:new Date(day(status==='returned'?-7:0)),endDate:new Date(day(status==='returned'?-4:status==='checked_out'?2:4)),status,checkedOutAt:status==='checked_out'?date(-0.1):status==='returned'?date(-7):null,returnedAt:status==='returned'?date(-4):null,returnConditionNote:status==='returned'?'Returned clean with all pieces.':null,message:'I would like to borrow this for a small project.',createdAt:created,conversation:{create:{id:id(loanId+':conversation'),closed:['returned','rejected','cancelled'].includes(status),lastMessageAt:created,participants:{create:[{userId:lender.id},{userId:borrower.id}]},messages:{create:{senderId:lender.id,body:'Please confirm the dates and return all pieces after use.',createdAt:created}}}}}});
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
  const stockId=id(namespace+':pantry-stock');
  await db.pointInventoryItem.upsert({where:{id:stockId},update:{},create:{id:stockId,pointId,category:'groceries',title:'Sealed pantry parcels',available:20,bestBefore:new Date(day(60))}});
  await db.stockAdjustment.upsert({where:{id:id(stockId+':audit')},update:{},create:{id:id(stockId+':audit'),pointId,itemId:stockId,delta:20,reason:'correction',actorId:volunteer.id,note:'Opening inventory count.'}});
  const pantryListing=await db.listing.upsert({where:{id:id(stockId+':listing')},update:{},create:{id:id(stockId+':listing'),ownerId:volunteer.id,title:'Pantry parcels',description:'Sealed pantry staples available from the sharing pantry.',category:'groceries',condition:'new',mode:'donate',status:'active',stockTotal:20,lat:pantry.lat,lng:pantry.lng,geohash:geohashFor(pantry),areaLabel:'Kebon Kacang, Jakarta Pusat',collectionMethod:'community_point',communityPointId:pointId,pointInventoryItemId:stockId,bestBefore:new Date(day(60)),private:{create:{pickupInstructions:'Collect during opening hours after approval.'}}}});
  await attachPhoto(pantryListing);
  for(const item of await db.listing.findMany({where:{ownerId:{in:people.map(p=>p.id)},status:{not:'closed'}},select:{id:true,ownerId:true,title:true}}))await attachPhoto(item);
  report(`Seed complete. ${catalogRows.length} distance scenarios (0.5–65 km); search supports 1–50 km. Product pins use rounded public coordinates.`);
  report(config.firebase.useEmulators?'Local logins at /login: owner / neighbour / volunteer / moderator / newcomer. No password required with emulators.':'Sign in through normal email OTP using the addresses in --accounts-file.');
  report('Existing records were not deleted or reset. Re-running preserves scenario progress.');
} finally {await db.$disconnect();await deleteApp(app);}
