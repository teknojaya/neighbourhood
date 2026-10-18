import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { loadConfig } from './config.js';
import { createDb } from './lib/db.js';
import { MaintenanceService } from './modules/notifications/maintenance.service.js';
import { FcmPushSender } from './modules/notifications/push.adapter.js';
import { PrismaAskService } from './modules/ask/ask.service.js';
import { createStorageBundle } from './lib/storage-bundle.js';
import { PrismaRequestsService } from './modules/requests/requests.service.js';
import { PrismaNeedsService } from './modules/needs/needs.service.js';
import { PrismaConversationsService } from './modules/conversations/conversations.service.js';
import { PrismaNotificationsService } from './modules/notifications/notifications.service.js';
import { logger } from './lib/logger.js';

const config = loadConfig();
const db = createDb(config.databaseUrl!);
const app = initializeApp({ projectId: config.firebase.projectId, storageBucket: config.firebase.storageBucket });
try {
  const storage = createStorageBundle(config, getStorage(app));
  const result = await new MaintenanceService(db, process.env.PUSH_ENABLED === 'true' && !config.firebase.useEmulators ? new FcmPushSender(getMessaging(app)) : null).run();
  const ask = new PrismaAskService(db, null, storage.ask, { requests: new PrismaRequestsService(db), needs: new PrismaNeedsService(db), conversations: new PrismaConversationsService(db), notifications: new PrismaNotificationsService(db) });
  const sessions = await ask.purgeDeletedSessions(), orphaned = await ask.purgeOrphanedImages();
  await new PrismaConversationsService(db, storage.conversations).cleanupAttachments();
  {
    const bucket = storage.photos;
    for await (const photo of bucket.candidates()) if (Number.isFinite(photo.createdAt.getTime()) && Date.now() - photo.createdAt.getTime() > 86_400_000 && await db.listingPhoto.count({ where: { storagePath: photo.path } }) === 0) await bucket.remove(photo.path);
  }
  logger.info('maintenance_completed', { ...result, sessions, orphaned });
} catch { logger.error('maintenance_failed'); process.exitCode = 1; }
finally { await db.$disconnect(); await deleteApp(app); }
