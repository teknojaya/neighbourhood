import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { loadConfig } from '../src/config.js';
import { createDb, isLoopbackDatabaseUrl } from '../src/lib/db.js';
import { createStorageBundle } from '../src/lib/storage-bundle.js';
import { normalizeImage } from '../src/modules/ask/ask.images.js';
import { catalogListingId, legacySeedIds, seedCatalog, seedId } from './seed-catalog.js';

// Inspection by default. Equal titles/photos alone never authorize deletion.
const args = process.argv.slice(2);
const option = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const config = loadConfig(), url = new URL(config.databaseUrl!);
if (!config.firebase.useEmulators || !config.firebase.projectId?.startsWith('demo-') || !isLoopbackDatabaseUrl(config.databaseUrl)) throw new Error('Seed repair requires a local database and demo Firebase emulators');
const db = createDb(config.databaseUrl!), app = initializeApp({ projectId: config.firebase.projectId, storageBucket: config.firebase.storageBucket });
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const report = (message: string) => process.stdout.write(message + '\n');
try {
  const storage = createStorageBundle(config, getStorage(app)).photos;
  const users = await db.user.findMany({ select: { id: true } });
  const legacy = legacySeedIds(users.map(user => user.id), option('--scenario') ? [option('--scenario')!] : []);
  const canonical = new Set(seedCatalog.map(product => catalogListingId(product.key)));
  const assetHashes = new Map<string, string>();
  for (const product of seedCatalog) assetHashes.set(digest(await normalizeImage(await readFile(new URL(`../seed-assets/products/${product.photo}.jpg`, import.meta.url)), 'image/jpeg')), catalogListingId(product.key));
  const knownPhotoHashes = new Set(assetHashes.keys());
  knownPhotoHashes.add(digest(await normalizeImage(await readFile(new URL('../seed-assets/products/cotton-clothing.jpg', import.meta.url)), 'image/jpeg')));
  const rows = await db.listing.findMany({ include: { photos: true, private: true, owner: { select: { firebaseUid: true } }, requests: { include: { conversation: { include: { messages: true } } } }, loans: { include: { conversation: { include: { messages: true } } } } } });
  const hashes = new Map<string, string[]>(), photos = new Map<string, Buffer>(), replacements = new Map<string, string>();
  let unreadable = 0;
  for (const row of rows) for (const photo of row.photos) {
    try {
      const bytes = await storage.get(photo.storagePath), hash = digest(bytes);
      photos.set(photo.storagePath, bytes);
      hashes.set(hash, [...(hashes.get(hash) ?? []), row.id]);
      if (assetHashes.has(hash)) replacements.set(row.id, assetHashes.get(hash)!);
    } catch (error) { if (!['NOT_FOUND', 404, 'ENOENT'].includes((error as { code: string | number }).code)) throw error; unreadable++; }
  }
  const fixtureMessages = new Set(['Hi, is an afternoon collection convenient?', 'Yes, please use this chat to agree on the time and handover.', 'Please confirm the dates and return all pieces after use.']);
  const recognized = rows.filter(row => !canonical.has(row.id) && (legacy.listings.has(row.id) || (row.owner.firebaseUid.startsWith('demo-') && row.private?.pickupInstructions === 'Demo fixture: arrange a pickup time in chat.')));
  const candidates = recognized.filter(row => row.photos.every(photo => !photos.has(photo.storagePath) || knownPhotoHashes.has(digest(photos.get(photo.storagePath)!))) && row.requests.every(request => legacy.requests.has(request.id) && (request.conversation?.messages.every(message => fixtureMessages.has(message.body)) ?? true)) && row.loans.every(loan => legacy.loans.has(loan.id) && (loan.conversation?.messages.every(message => fixtureMessages.has(message.body)) ?? true)));
  const duplicateGroups = [...hashes.values()].filter(ids => new Set(ids).size > 1);
  const sourceId = option('--merge-listing'), targetId = option('--into');
  const source = sourceId ? rows.find(row => row.id === sourceId) : undefined;
  const target = targetId ? rows.find(row => row.id === targetId) : undefined;
  const workflowRequests = new Set(users.flatMap(user => ['pending','approved','collected','rejected','cancelled','expired'].map(status => seedId('catalog-v2:' + user.id + ':request:' + status))));
  const samePhoto = source && target && source.photos.some(a => target.photos.some(b => photos.has(a.storagePath) && photos.has(b.storagePath) && digest(photos.get(a.storagePath)!) === digest(photos.get(b.storagePath)!)));
  const changingOwner = source && target && source.ownerId !== target.ownerId;
  if (sourceId || targetId) {
    if (!source || !target || source.id === target.id || !samePhoto || source.mode !== target.mode || source.category !== target.category) throw new Error('Merge requires two matching photographed products with the same category and offering');
    if (changingOwner && !(legacy.listings.has(source.id) && canonical.has(target.id) && target.loans.length === 0 && target.requests.every(request => workflowRequests.has(request.id) && (request.conversation?.messages.every(message => fixtureMessages.has(message.body)) ?? true)))) throw new Error('Cannot change ownership of a resident product or discard a real request');
    if (source.pointInventoryItemId || target.pointInventoryItemId) throw new Error('Inventory-backed products require a separate audited reconciliation');
    report(`Planned consolidation: ${source.title} -> ${target.title}. Requests, loans, messages and bookmarks move to the retained product.`);
  }
  report(`Audit: ${rows.length} listings; ${duplicateGroups.length} repeated-photo groups; ${unreadable} unreadable objects.`);
  report(`Recognized legacy seed listings: ${recognized.length}; repairable: ${candidates.length}; protected by custom photos or real requests/messages: ${recognized.length - candidates.length}.`);
  report(`Other listings preserved: ${rows.length - recognized.length - rows.filter(row => canonical.has(row.id)).length}.`);
  for (const row of rows.filter(row => !canonical.has(row.id) && !candidates.some(candidate => candidate.id === row.id))) report(`Preserved: ${row.title}; owner ${row.owner.firebaseUid.startsWith('demo-') ? row.owner.firebaseUid : 'resident'}; requests ${row.requests.length}; loans ${row.loans.length}.`);
  for (const ids of duplicateGroups) report(`Repeated photo: ${[...new Set(ids)].map(id => rows.find(row => row.id === id)!.title).join(' | ')}`);
  if (!args.includes('--apply') && !args.includes('--backup-only')) report('Inspection only. Use --apply --backup-dir ABSOLUTE_PATH after running the new catalog seed.');
  else {
    const directory = option('--backup-dir'), repository = fileURLToPath(new URL('../../../', import.meta.url));
    if (!directory || !path.isAbsolute(directory)) throw new Error('Provide an absolute --backup-dir outside the repository');
    const relative = path.relative(repository, path.resolve(directory));
    if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw new Error('Backups must be outside the repository');
    const backupDir = path.join(directory, 'seed-repair-' + new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(backupDir, { recursive: true });
    const dump = spawnSync(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--file', path.join(backupDir, 'database.dump'), '--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', decodeURIComponent(url.pathname.slice(1))], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: 'utf8', windowsHide: true });
    if (dump.error || dump.status !== 0) throw new Error('Database backup failed. Set PG_DUMP_PATH; nothing was changed.');
    await mkdir(path.join(backupDir, 'photos'));
    const manifest = [];
    for (const row of [...candidates, ...(source ? [source] : [])]) for (const photo of row.photos) {
      const bytes = photos.get(photo.storagePath);
      if (bytes) { const file = photo.id + '.webp'; await writeFile(path.join(backupDir, 'photos', file), bytes); manifest.push({ storagePath: photo.storagePath, file }); }
    }
    await writeFile(path.join(backupDir, 'photos.json'), JSON.stringify(manifest, null, 2));
    report('Backup saved: ' + backupDir);
    if (args.includes('--apply')) {
      if (await db.listing.count({ where: { id: { in: [...canonical] } } }) !== canonical.size) throw new Error('Run seed:playground with the new catalog before applying repair');
      let saved = 0;
      await db.$transaction(async tx => {
        if (source && target) {
          for (const row of [source, target]) {
            await tx.$queryRaw`SELECT id FROM listings WHERE id = ${row.id}::uuid FOR UPDATE`;
            const current = await tx.listing.findUniqueOrThrow({ where: { id: row.id }, include: { photos: true, requests: { include: { conversation: { include: { messages: true } } } }, loans: { include: { conversation: { include: { messages: true } } } } } });
            if (current.updatedAt.getTime() !== row.updatedAt.getTime() || current.photos.map(p => p.id).sort().join() !== row.photos.map(p => p.id).sort().join() || JSON.stringify(current.requests) !== JSON.stringify(row.requests) || JSON.stringify(current.loans) !== JSON.stringify(row.loans)) throw new Error('A merge product changed during backup; retry inspection');
          }
          if (changingOwner) {
            const conversations = target.requests.flatMap(request => request.conversation ? [request.conversation.id] : []);
            await tx.notification.deleteMany({ where: { link: { in: [...target.requests.map(request => '/activity?request=' + request.id), ...conversations.map(id => '/messages?conversation=' + id)] } } });
            await tx.donationRequest.deleteMany({ where: { listingId: target.id } });
            await tx.listing.update({ where: { id: target.id }, data: { ownerId: source.ownerId } });
            if (source.private) await tx.listingPrivate.upsert({ where: { listingId: target.id }, create: { listingId: target.id, pickupInstructions: source.private.pickupInstructions, contactNote: source.private.contactNote }, update: { pickupInstructions: source.private.pickupInstructions, contactNote: source.private.contactNote } });
          }
          for (const bookmark of await tx.savedListing.findMany({ where: { listingId: source.id } })) if (bookmark.userId !== source.ownerId) {
            await tx.savedListing.upsert({ where: { userId_listingId: { userId: bookmark.userId, listingId: target.id } }, create: { userId: bookmark.userId, listingId: target.id, title: target.title, createdAt: bookmark.createdAt }, update: { title: target.title } }); saved++;
          }
          await tx.donationRequest.updateMany({ where: { listingId: source.id }, data: { listingId: target.id } });
          await tx.loan.updateMany({ where: { listingId: source.id }, data: { listingId: target.id } });
          await tx.savedListing.deleteMany({ where: { listingId: target.id, userId: source.ownerId } });
          const counts = await tx.donationRequest.groupBy({ by: ['status'], where: { listingId: target.id }, _sum: { quantity: true } });
          const reserved = counts.find(group => group.status === 'approved')?._sum.quantity ?? 0, collected = counts.find(group => group.status === 'collected')?._sum.quantity ?? 0;
          await tx.listing.update({ where: { id: target.id }, data: { stockTotal: Math.max(source.stockTotal, target.stockTotal, reserved + collected), stockReserved: reserved, stockCollected: collected } });
          await tx.notification.updateMany({ where: { link: '/listings/' + source.id }, data: { link: '/listings/' + target.id } });
          await tx.listing.delete({ where: { id: source.id } });
        }
        for (const row of candidates.filter(row => row.id !== source?.id && row.id !== target?.id)) {
          await tx.$queryRaw`SELECT id FROM listings WHERE id = ${row.id}::uuid FOR UPDATE`;
          const current = await tx.listing.findUniqueOrThrow({ where: { id: row.id }, include: { photos: true, requests: { include: { conversation: { include: { messages: true } } } }, loans: { include: { conversation: { include: { messages: true } } } } } });
          if (current.updatedAt.getTime() !== row.updatedAt.getTime() || current.photos.map(p => p.id).sort().join() !== row.photos.map(p => p.id).sort().join() || JSON.stringify(current.requests) !== JSON.stringify(row.requests) || JSON.stringify(current.loans) !== JSON.stringify(row.loans)) throw new Error('Seed records changed during inspection; retry repair');
          const replacement = replacements.get(row.id), target = replacement ? await tx.listing.findUniqueOrThrow({ where: { id: replacement } }) : null;
          for (const bookmark of await tx.savedListing.findMany({ where: { listingId: row.id } })) {
            if (target && target.ownerId !== bookmark.userId) { await tx.savedListing.upsert({ where: { userId_listingId: { userId: bookmark.userId, listingId: target.id } }, create: { userId: bookmark.userId, listingId: target.id, title: target.title, createdAt: bookmark.createdAt }, update: { title: target.title } }); saved++; }
          }
          const conversations = [...row.requests, ...row.loans].flatMap(record => record.conversation ? [record.conversation.id] : []);
          const links = ['/listings/' + row.id, ...row.requests.map(r => '/activity?request=' + r.id), ...row.loans.map(l => '/activity?loan=' + l.id), ...conversations.map(id => '/messages?conversation=' + id)];
          await tx.notification.deleteMany({ where: { link: { in: links } } });
          if (row.pointInventoryItemId && row.stockReserved) await tx.pointInventoryItem.update({ where: { id: row.pointInventoryItemId }, data: { available: { increment: row.stockReserved }, reserved: { decrement: row.stockReserved } } });
          await tx.donationRequest.deleteMany({ where: { listingId: row.id } });
          await tx.loan.deleteMany({ where: { listingId: row.id } });
          await tx.listing.delete({ where: { id: row.id } });
        }
      }, { timeout: 60_000 });
      report(`Removed ${candidates.filter(row => row.id !== source?.id && row.id !== target?.id).length} obsolete seed listings and fixture workflows; merged ${saved} bookmarks into matching photographed products. Accounts, profiles, needs, real chats and other listings preserved.`);
      if (source && target) report('Consolidated the selected duplicate product; existing request/loan and conversation IDs preserved.');
    }
  }
} finally { await db.$disconnect(); await deleteApp(app); }
