import type { Db } from '../../lib/db.js';
import { pgErrorCode } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import type { UserResolver, VerifiedIdentity } from './auth.js';

export interface UserRecord {
  id: string;
  firebaseUid: string;
  email: string;
  disabled: boolean;
}

export class DuplicateUserError extends Error {
  override name = 'DuplicateUserError';
}

export interface UsersRepository {
  findByFirebaseUid(firebaseUid: string): Promise<UserRecord | null>;
  /** Throws DuplicateUserError when firebase_uid or email already exists. */
  insert(data: { firebaseUid: string; email: string; displayName: string | null }): Promise<UserRecord>;
}

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly db: Db) {}

  async findByFirebaseUid(firebaseUid: string): Promise<UserRecord | null> {
    const u = await this.db.user.findUnique({
      where: { firebaseUid },
      select: { id: true, firebaseUid: true, email: true, disabledAt: true },
    });
    return u ? { id: u.id, firebaseUid: u.firebaseUid, email: u.email, disabled: u.disabledAt !== null } : null;
  }

  async insert(data: { firebaseUid: string; email: string; displayName: string | null }): Promise<UserRecord> {
    try {
      const u = await this.db.user.create({
        data: { firebaseUid: data.firebaseUid, email: data.email, emailVerified: true, displayName: data.displayName },
        select: { id: true, firebaseUid: true, email: true },
      });
      return { ...u, disabled: false };
    } catch (err) {
      if (pgErrorCode(err) === '23505') throw new DuplicateUserError('duplicate user');
      throw err;
    }
  }
}

/**
 * Maps a Firebase identity to exactly one PostgreSQL user.
 *
 * - Known firebase_uid → that user.
 * - Unknown uid → create, but only with a verified email. Email is unique
 *   (lower-cased) in PostgreSQL, so the same address can never yield two users.
 * - Unknown uid whose email already belongs to another user → 409
 *   ACCOUNT_LINK_REQUIRED. We never auto-merge: the person must sign in with
 *   the original method and link Google explicitly (see docs/architecture.md §3).
 */
export class UserProvisioningService implements UserResolver {
  constructor(private readonly users: UsersRepository) {}

  async resolve(identity: VerifiedIdentity): Promise<{ userId: string; email: string }> {
    const existing = await this.users.findByFirebaseUid(identity.firebaseUid);
    if (existing) return this.active(existing);

    if (!identity.email || !identity.emailVerified) {
      throw new HttpError('EMAIL_NOT_VERIFIED', 'A verified email address is required');
    }
    const email = identity.email.trim().toLowerCase();
    const displayName = identity.name && identity.name.trim().length >= 2 ? identity.name.trim().slice(0, 60) : null;
    try {
      const created = await this.users.insert({ firebaseUid: identity.firebaseUid, email, displayName });
      logger.info('user_provisioned', { userId: created.id });
      return this.active(created);
    } catch (err) {
      if (!(err instanceof DuplicateUserError)) throw err;
      // Either a concurrent first request created this uid (fine), or the
      // email belongs to a different Firebase user (link required).
      const raced = await this.users.findByFirebaseUid(identity.firebaseUid);
      if (raced) return this.active(raced);
      logger.warn('account_link_required', { signInProvider: identity.signInProvider });
      throw new HttpError(
        'ACCOUNT_LINK_REQUIRED',
        'An account with this email already exists. Sign in with your email code, then link Google from your profile.',
      );
    }
  }

  private active(u: UserRecord) {
    if (u.disabled) throw new HttpError('ACCOUNT_DISABLED', 'This account is disabled');
    return { userId: u.id, email: u.email };
  }
}
