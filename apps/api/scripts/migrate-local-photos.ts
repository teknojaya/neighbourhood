import path from 'node:path';
import fs from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/lib/db.js';
import { FirebaseObjectStorage, SAFE_PATH } from '../src/lib/storage.js';
import { normalizeImage } from '../src/modules/ask/ask.images.js';

const config = loadConfig();
if (!config.firebase.useEmulators || !config.firebase.storageBucket || !['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl!).hostname)) throw new Error('Legacy photo import requires local database and Storage emulator');
const app = initializeApp({ projectId: config.firebase.projectId, storageBucket: config.firebase.storageBucket });
const bucket = new FirebaseObjectStorage(getStorage(app), config.firebase.storageBucket); const db = createDb(config.databaseUrl!);
const root = path.resolve('uploads'); let migrated = 0, skipped = 0;
try {
  for (const photo of await db.listingPhoto.findMany({ take: 1000 })) {
    if (!SAFE_PATH.test(photo.storagePath)) { skipped++; continue; }
    const source = path.resolve(root, photo.storagePath); const relative = path.relative(root, source);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe legacy photo path');
    let bytes: Buffer;
    try { bytes = await fs.readFile(source); } catch (err) { if ((err as { code?: string }).code === 'ENOENT') { skipped++; continue; } throw err; }
    try { await bucket.get(photo.storagePath); skipped++; continue; } catch (err) { if ((err as { code?: number }).code !== 404) throw err; }
    const mime = /\.png$/i.test(source) ? 'image/png' : /\.webp$/i.test(source) ? 'image/webp' : 'image/jpeg';
    const normalized = await normalizeImage(bytes, mime);
    const storagePath = `listings/${photo.listingId}/${photo.id}.webp`;
    await bucket.put(storagePath, normalized, 'image/webp');
    await db.listingPhoto.updateMany({ where: { id: photo.id, storagePath: photo.storagePath }, data: { storagePath } });
    migrated++;
  }
  process.stdout.write(`Imported ${migrated} legacy photos into the local bucket; skipped ${skipped}. Original files were preserved.\n`);
} finally { await db.$disconnect(); await deleteApp(app); }
