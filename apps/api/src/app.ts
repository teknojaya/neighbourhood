import path from 'node:path';
import express, { type Express, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { API_PREFIX, ApiRoutes } from '@neighbourhood/shared';
import type { AppConfig } from './config.js';
import { errorHandler, HttpError, notFound } from './lib/http.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import type { AiService } from './modules/ai/ai.service.js';
import type { AccessRepository } from './modules/auth/access.js';
import { requireAuth, type TokenVerifier, type UserResolver } from './modules/auth/auth.js';
import { communitiesRouter } from './modules/communities/communities.routes.js';
import { authPublicRouter } from './modules/email-otp/otp.routes.js';
import type { EmailOtpService } from './modules/email-otp/otp.service.js';
import { conversationsRouter } from './modules/conversations/conversations.routes.js';
import { listingsRouter } from './modules/listings/listings.routes.js';
import { loansRouter } from './modules/loans/loans.routes.js';
import { medicineAssistanceRouter } from './modules/medicine-assistance/medicine-assistance.routes.js';
import { needsRouter } from './modules/needs/needs.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { profilesRouter } from './modules/profiles/profiles.routes.js';
import type { ProfilesService } from './modules/profiles/profiles.service.js';
import { requestsRouter } from './modules/requests/requests.routes.js';
import type { ListingsService } from './modules/listings/listings.service.js';
import { localStorageRouter } from './modules/storage/storage.routes.js';
import type { LocalFileObjectStorage } from './lib/storage.js';

export interface AppDeps {
  config: AppConfig;
  tokenVerifier: TokenVerifier;
  users: UserResolver;
  access: AccessRepository;
  otp: EmailOtpService;
  profiles: ProfilesService;
  ai: AiService;
  listings?: ListingsService;
  localStorage?: LocalFileObjectStorage;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.config.trustProxyHops);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // apis.google.com: Firebase Auth helper for Google sign-in (popup/redirect).
          scriptSrc: ["'self'", 'https://apis.google.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://firebasestorage.googleapis.com', 'https://storage.googleapis.com'],
          connectSrc: [
            "'self'",
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://firebaseinstallations.googleapis.com',
            'https://fcmregistrations.googleapis.com',
            'https://fcm.googleapis.com',
            'https://www.googleapis.com',
            'https://firebasestorage.googleapis.com',
            // V4 signed upload URLs for images.
            'https://storage.googleapis.com',
          ],
          // Firebase Auth handler iframe on the authDomain.
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://*.web.app', 'https://accounts.google.com'],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          // Only when deployed behind HTTPS; local http://localhost testing would break otherwise.
          upgradeInsecureRequests: deps.config.deployed ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Liveness/readiness for Cloud Run. No dependencies, no secrets.
  app.get(ApiRoutes.health, (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ------------------------------------------------------------------- API
  const api = Router();
  api.use((_req, res, next) => {
    // Authenticated data must never be cached by browsers, proxies or the SW.
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new HttpError('RATE_LIMITED', 'Too many requests')),
    }),
  );
  api.use(express.json({ limit: '32kb' }));
  // Public sign-in support (auth methods, email OTP → Firebase custom token).
  api.use(authPublicRouter(deps.otp));
  // Local storage routes (unauthenticated to mirror S3/GCS signed URL behavior)
  if (deps.localStorage) {
    api.use(localStorageRouter(deps.localStorage));
  }
  // Every other /api/v1 route requires a verified Firebase ID token mapped to a PostgreSQL user.
  api.use(requireAuth(deps.tokenVerifier, deps.users));

  api.use(profilesRouter(deps.profiles));
  api.use(aiRouter(deps.ai));
  api.use(listingsRouter(deps.listings));
  api.use(communitiesRouter());
  api.use(requestsRouter());
  api.use(loansRouter());
  api.use(needsRouter());
  api.use(conversationsRouter());
  api.use(notificationsRouter());
  api.use(medicineAssistanceRouter());
  api.use(notFound);

  app.use(API_PREFIX, api);

  // -------------------------------------------------------- Static frontend
  if (deps.config.webDistDir) {
    const dist = path.resolve(deps.config.webDistDir);
    app.use(
      express.static(dist, {
        index: false,
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (base === 'sw.js' || base === 'manifest.webmanifest' || base.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    // SPA fallback for client-side routes.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
