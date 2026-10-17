import type { Auth } from 'firebase-admin/auth';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { isAdminCredentialError } from '../auth/auth.js';

export interface IdentityProvider {
  /** The single Firebase user for this email (existing, e.g. Google, or new). */
  uidForVerifiedEmail(email: string): Promise<string>;
  createCustomToken(uid: string): Promise<string>;
}

/**
 * Firebase Auth enforces one account per email address (project default:
 * "Link accounts that use the same email"). Resolving by email means a
 * person who first used Google and later uses an email code lands in the
 * SAME Firebase user — no duplicate accounts.
 */
export class FirebaseIdentityProvider implements IdentityProvider {
  constructor(private readonly auth: Auth) {}

  async uidForVerifiedEmail(email: string): Promise<string> {
    try {
      try {
        const existing = await this.auth.getUserByEmail(email);
        if (existing.disabled) throw new HttpError('ACCOUNT_DISABLED', 'This account is disabled');
        // The code proved control of the address.
        if (!existing.emailVerified) await this.auth.updateUser(existing.uid, { emailVerified: true });
        return existing.uid;
      } catch (err) {
        if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
      }
      try {
        const created = await this.auth.createUser({ email, emailVerified: true });
        return created.uid;
      } catch (err) {
        // Concurrent verification created it first.
        if ((err as { code?: string }).code === 'auth/email-already-exists') {
          return (await this.auth.getUserByEmail(email)).uid;
        }
        throw err;
      }
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async createCustomToken(uid: string): Promise<string> {
    try {
      // No custom claims: roles stay in PostgreSQL, never in tokens.
      return await this.auth.createCustomToken(uid);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): Error {
    if (err instanceof HttpError) return err;
    if (isAdminCredentialError(err) || (err as { code?: string }).code === 'auth/insufficient-permission') {
      logger.error('auth_backend_not_configured', { code: (err as { code?: string }).code ?? 'unknown' });
      return new HttpError('AUTH_NOT_CONFIGURED', 'Email sign-in is not configured on this server');
    }
    return err as Error;
  }
}
