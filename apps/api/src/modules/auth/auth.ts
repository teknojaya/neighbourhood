import type { Request, RequestHandler } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';

/** Claims from a verified Firebase ID token (never from the request body). */
export interface VerifiedIdentity {
  firebaseUid: string;
  email: string | null;
  emailVerified: boolean;
  /** firebase.sign_in_provider: 'google.com' | 'custom' | ... */
  signInProvider: string;
  name: string | null;
}

export type SignInMethod = 'google' | 'email_otp';

/** The authenticated application user (PostgreSQL row + session facts). */
export interface AuthUser {
  /** Internal PostgreSQL user id. Use this everywhere in services. */
  userId: string;
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  signInMethod: SignInMethod;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export interface TokenVerifier {
  /** Resolves verified claims, or throws HttpError (UNAUTHENTICATED / AUTH_NOT_CONFIGURED). */
  verify(idToken: string): Promise<VerifiedIdentity>;
}

/** Maps a verified identity to exactly one PostgreSQL user (see users.service.ts). */
export interface UserResolver {
  resolve(identity: VerifiedIdentity): Promise<{ userId: string; email: string }>;
}

/** Only Google and server-issued custom tokens (email OTP) are accepted. */
const ACCEPTED_PROVIDERS: Record<string, SignInMethod> = { 'google.com': 'google', custom: 'email_otp' };

/** Firebase Admin errors meaning "this server lacks credentials", not "bad token". */
export function isAdminCredentialError(err: unknown): boolean {
  const code = (err as { code?: string }).code ?? '';
  const message = err instanceof Error ? err.message : '';
  return (
    code === 'app/invalid-credential' ||
    code === 'auth/insufficient-permission' ||
    /could not load the default credentials|credential implementation provided|failed to determine service account/i.test(message)
  );
}

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly auth: Auth) {}

  async verify(idToken: string): Promise<VerifiedIdentity> {
    try {
      // checkRevoked=true: disabled users and revoked sessions are rejected.
      const decoded = await this.auth.verifyIdToken(idToken, true);
      let email = decoded.email ?? null;
      let emailVerified = decoded.email_verified ?? false;
      if (!email) {
        // Custom-token sessions may omit email claims; read the user record.
        const record = await this.auth.getUser(decoded.uid);
        email = record.email ?? null;
        emailVerified = record.emailVerified;
      }
      return {
        firebaseUid: decoded.uid,
        email,
        emailVerified,
        signInProvider: decoded.firebase.sign_in_provider,
        name: typeof decoded.name === 'string' ? decoded.name : null,
      };
    } catch (err) {
      if (isAdminCredentialError(err)) {
        logger.error('auth_backend_not_configured', { code: (err as { code?: string }).code ?? 'unknown' });
        throw new HttpError('AUTH_NOT_CONFIGURED', 'Sign-in is not configured on this server');
      }
      logger.info('auth_rejected', { reason: (err as { code?: string }).code ?? 'unknown' });
      throw new HttpError('UNAUTHENTICATED', 'Session is invalid or expired');
    }
  }
}

const BEARER = /^Bearer ([A-Za-z0-9._-]{20,4096})$/;

export function requireAuth(verifier: TokenVerifier, users: UserResolver): RequestHandler {
  return async (req, _res, next) => {
    const match = BEARER.exec(req.get('authorization') ?? '');
    if (!match?.[1]) return next(new HttpError('UNAUTHENTICATED', 'Sign in required'));
    try {
      const identity = await verifier.verify(match[1]);
      const signInMethod = ACCEPTED_PROVIDERS[identity.signInProvider];
      if (!signInMethod) {
        throw new HttpError('UNSUPPORTED_SIGN_IN_METHOD', 'Sign in with Google or an email code');
      }
      const user = await users.resolve(identity);
      req.auth = {
        userId: user.userId,
        firebaseUid: identity.firebaseUid,
        email: user.email,
        emailVerified: identity.emailVerified,
        signInMethod,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Returns the authenticated user; use only behind `requireAuth`. */
export function authUser(req: Request): AuthUser {
  if (!req.auth) throw new HttpError('UNAUTHENTICATED', 'Sign in required');
  return req.auth;
}
