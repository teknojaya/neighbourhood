import path from 'node:path';
import type { Storage } from 'firebase-admin/storage';
import { ConfigError, type AppConfig } from '../config.js';
import { FirebaseAskImageStorage, LocalAskImageStorage } from '../modules/ask/ask.images.js';
import { FirebaseObjectStorage, LocalFileObjectStorage } from './storage.js';

/** Server, seeder and maintenance must agree on the same authoritative store. */
export function createStorageBundle(config: AppConfig, storage: Storage, env: NodeJS.ProcessEnv = process.env) {
  if (env.STORAGE_DRIVER && !['local', 'firebase'].includes(env.STORAGE_DRIVER)) throw new ConfigError('STORAGE_DRIVER must be local or firebase');
  const local = env.STORAGE_DRIVER === 'local' || !config.firebase.storageBucket;
  if ((config.deployed || config.env === 'production') && local) throw new ConfigError('Deployed environments require configured bucket storage');
  if (env.STORAGE_DRIVER === 'firebase' && !config.firebase.storageBucket) throw new ConfigError('Firebase storage requires FIREBASE_STORAGE_BUCKET');
  const root = path.resolve(env.STORAGE_LOCAL_DIR || 'uploads');
  const secret = env.STORAGE_SIGNING_SECRET ? Buffer.from(env.STORAGE_SIGNING_SECRET) : undefined;
  const bucket = config.firebase.storageBucket!;
  return {
    driver: local ? 'local' as const : 'firebase' as const,
    photos: local ? new LocalFileObjectStorage(root, secret) : new FirebaseObjectStorage(storage, bucket, secret),
    ask: local ? new LocalAskImageStorage(root) : new FirebaseAskImageStorage(storage, bucket),
    conversations: local ? new LocalAskImageStorage(root, 'conversation-attachments/') : new FirebaseAskImageStorage(storage, bucket, 'conversation-attachments/'),
  };
}
