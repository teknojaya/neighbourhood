import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { AiService } from './modules/ai/ai.service.js';
import { GeminiAdapter } from './modules/ai/gemini.adapter.js';
import { PrismaAccessRepository } from './modules/auth/access.js';
import { FirebaseTokenVerifier } from './modules/auth/auth.js';
import { PrismaUsersRepository, UserProvisioningService } from './modules/auth/users.js';
import { SmtpEmailSender } from './modules/email-otp/email.sender.js';
import { FirebaseIdentityProvider } from './modules/email-otp/firebase-identity.js';
import { PrismaOtpChallengeRepository } from './modules/email-otp/otp.repository.js';
import { EmailOtpService } from './modules/email-otp/otp.service.js';
import { PrismaProfilesRepository } from './modules/profiles/profiles.repository.js';
import { ProfilesService } from './modules/profiles/profiles.service.js';
import { PrismaRequestsService } from './modules/requests/requests.service.js';
import { PrismaConversationsService } from './modules/conversations/conversations.service.js';
import { PrismaNotificationsService } from './modules/notifications/notifications.service.js';
import { PrismaNeedsService } from './modules/needs/needs.service.js';
import { PrismaAskService } from './modules/ask/ask.service.js';
import { GeminiAskModel } from './modules/ask/ask.model.js';
import { FirebaseAskImageStorage } from './modules/ask/ask.images.js';

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[config] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  // Firebase is used for Authentication, Cloud Messaging and Cloud Storage only.
  // On Cloud Run, credentials come from the service account (ADC).
  const firebaseApp = initializeApp({
    ...(config.firebase.projectId ? { projectId: config.firebase.projectId } : {}),
    ...(config.firebase.storageBucket ? { storageBucket: config.firebase.storageBucket } : {}),
  });
  const firebaseAuth = getAuth(firebaseApp);
  const db = createDb(config.databaseUrl!);
  const access = new PrismaAccessRepository(db);

  const generator = config.gemini ? new GeminiAdapter(config.gemini.model, config.gemini.apiKey) : null;
  const otp = new EmailOtpService(
    config.emailOtp
      ? {
          secret: config.emailOtp.secret,
          challenges: new PrismaOtpChallengeRepository(db),
          sender: new SmtpEmailSender(config.emailOtp.smtp),
          identity: new FirebaseIdentityProvider(firebaseAuth),
        }
      : null,
    Boolean(config.firebase.projectId),
  );

  const services = { needs: new PrismaNeedsService(db), requests: new PrismaRequestsService(db), conversations: new PrismaConversationsService(db), notifications: new PrismaNotificationsService(db) };
  const ask = new PrismaAskService(db, config.gemini ? new GeminiAskModel(config.gemini.model, config.gemini.apiKey) : null,
    config.firebase.storageBucket ? new FirebaseAskImageStorage(getStorage(firebaseApp), config.firebase.storageBucket) : null, services);
  // Storage cleanup is retryable; soft-deleted chats are never readable meanwhile.
  void ask.purgeDeletedSessions().catch(() => logger.warn('ask_cleanup_unavailable'));
  const cleanup = setInterval(() => { void ask.purgeDeletedSessions().catch(() => logger.warn('ask_cleanup_unavailable')); }, 15 * 60_000);
  cleanup.unref();
  const app = createApp({
    config,
    tokenVerifier: new FirebaseTokenVerifier(firebaseAuth),
    users: new UserProvisioningService(new PrismaUsersRepository(db)),
    access,
    otp,
    profiles: new ProfilesService(new PrismaProfilesRepository(db), access),
    ai: new AiService(generator),
    ...services,
    ask,
  });

  const server = app.listen(config.port, () => {
    logger.info('server_started', {
      port: config.port,
      env: config.env,
      authEmulator: config.firebase.useEmulators,
      aiAvailable: generator !== null,
      aiModel: config.gemini?.model ?? null,
      emailOtpAvailable: config.emailOtp !== null,
      // Names only, never values.
      emailOtpMissing: config.emailOtpMissing.join(',') || null,
      servingWeb: Boolean(config.webDistDir),
    });
  });

  const shutdown = (signal: string) => {
    logger.info('server_stopping', { signal });
    clearInterval(cleanup);
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
