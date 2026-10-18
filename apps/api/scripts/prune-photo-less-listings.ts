import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/lib/db.js';
import { createStorageBundle } from '../src/lib/storage-bundle.js';

// Deliberately local-only. Inspection is the default; --apply requires a full
// PostgreSQL backup to succeed before any related marketplace data is removed.
const config = loadConfig();
const url = new URL(config.databaseUrl!);
if (!config.firebase.useEmulators || !config.firebase.projectId?.startsWith('demo-') || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Cleanup requires a local database and Firebase emulators');
const args = process.argv.slice(2);
const report = (value: string) => process.stdout.write(value + '\n');
const option = (name: string) => args[args.indexOf(name) + 1];
const db = createDb(config.databaseUrl!);
const app = initializeApp({ projectId: config.firebase.projectId, storageBucket: config.firebase.storageBucket });
try {
  const storage = createStorageBundle(config, getStorage(app)).photos;
  const candidates = [];
  for (const listing of await db.listing.findMany({ include: { photos: true, requests: true, loans: true } })) {
    let readable = false;
    for (const photo of listing.photos) {
      try { await storage.get(photo.storagePath); readable = true; break; }
      catch (error) { if (!['NOT_FOUND', 404, 'ENOENT'].includes((error as { code: string | number }).code)) throw error; }
    }
    if (!readable) candidates.push(listing);
  }
  report(`Found ${candidates.length} listings without a readable photo.`);
  if (!args.includes('--apply') || !candidates.length) { report('No records removed. Use --apply --backup-dir ABSOLUTE_PATH to clean up.'); }
  else {
    const directory = args.includes('--backup-dir') ? option('--backup-dir') : '';
    if (!directory || !path.isAbsolute(directory)) throw new Error('Provide an absolute --backup-dir outside the repository');
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    const relative = path.relative(repository, path.resolve(directory));
    if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw new Error('The backup folder must be outside the repository');
    await mkdir(directory, { recursive: true });
    const backup = path.join(directory, `before-photo-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
    const dump = spawnSync(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--file', backup, '--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', decodeURIComponent(url.pathname.slice(1))], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: 'utf8', windowsHide: true });
    if (dump.error || dump.status !== 0) throw new Error('Database backup failed. Set PG_DUMP_PATH to your pg_dump executable; nothing was removed.');
    report(`Full database backup saved: ${backup}`);
    let removed = 0;
    for (const listing of candidates) {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listing.id}::uuid FOR UPDATE`;
        const current = await tx.listing.findUnique({ where: { id: listing.id }, include: { photos: true } });
        if (!current || current.updatedAt.getTime() !== listing.updatedAt.getTime() || current.photos.map(p => p.id).sort().join() !== listing.photos.map(p => p.id).sort().join()) throw new Error('A listing changed during cleanup; run inspection again');
        const requests = await tx.donationRequest.findMany({ where: { listingId: listing.id }, select: { id: true } });
        const loans = await tx.loan.findMany({ where: { listingId: listing.id }, select: { id: true } });
        const conversations = await tx.conversation.findMany({ where: { OR: [{ donationRequestId: { in: requests.map(r => r.id) } }, { loanId: { in: loans.map(l => l.id) } }] }, select: { id: true } });
        const links = [`/listings/${listing.id}`, ...requests.map(r => `/activity?request=${r.id}`), ...loans.map(l => `/activity?loan=${l.id}`), ...conversations.map(c => `/messages?conversation=${c.id}`)];
        await tx.notification.deleteMany({ where: { link: { in: links } } });
        if (listing.pointInventoryItemId && listing.stockReserved) await tx.pointInventoryItem.update({ where: { id: listing.pointInventoryItemId }, data: { available: { increment: listing.stockReserved }, reserved: { decrement: listing.stockReserved } } });
        // Conversations, messages, attachments, saved items and private details
        // cascade from these records. Accounts, needs and Ask history remain.
        await tx.donationRequest.deleteMany({ where: { listingId: listing.id } });
        await tx.loan.deleteMany({ where: { listingId: listing.id } });
        await tx.listing.delete({ where: { id: listing.id } });
        removed++;
      });
    }
    report(`Removed ${removed} photo-less listings and their related requests/loans/messages. User accounts and profiles preserved.`);
  }
} finally { await db.$disconnect(); await deleteApp(app); }
