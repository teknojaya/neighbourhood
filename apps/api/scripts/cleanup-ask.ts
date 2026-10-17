import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/lib/db.js';
import { logger } from '../src/lib/logger.js';
import { PrismaAskService } from '../src/modules/ask/ask.service.js';
import { FirebaseAskImageStorage } from '../src/modules/ask/ask.images.js';
import { PrismaNeedsService } from '../src/modules/needs/needs.service.js';
import { PrismaRequestsService } from '../src/modules/requests/requests.service.js';
import { PrismaConversationsService } from '../src/modules/conversations/conversations.service.js';
import { PrismaNotificationsService } from '../src/modules/notifications/notifications.service.js';

async function main() {
  const config = loadConfig();
  const db = createDb(config.databaseUrl!);
  try {
    const app = initializeApp({ ...(config.firebase.projectId ? { projectId: config.firebase.projectId } : {}) });
    const storage = config.firebase.storageBucket ? new FirebaseAskImageStorage(getStorage(app), config.firebase.storageBucket) : null;
    const service = new PrismaAskService(db, null, storage, {
      needs: new PrismaNeedsService(db), requests: new PrismaRequestsService(db),
      conversations: new PrismaConversationsService(db), notifications: new PrismaNotificationsService(db),
    });
    let sessions = 0, batch: number;
    do { batch = await service.purgeDeletedSessions(); sessions += batch; } while (batch > 0);
    const orphanedImages = await service.purgeOrphanedImages();
    const remaining = await db.askSession.count({ where: { deletedAt: { not: null } } });
    logger.info('ask_cleanup_completed', { sessions, orphanedImages, remaining });
    if (remaining) process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
void main().catch(() => { logger.error('ask_cleanup_failed'); process.exitCode = 1; });
