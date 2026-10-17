import { OTP_POLICY } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { otpHashesEqual } from './otp.crypto.js';

export type IssueResult = { ok: true; challengeId: string } | { ok: false; reason: 'cooldown' | 'hourly_limit' };
export type ConsumeResult = 'ok' | 'invalid' | 'expired' | 'locked' | 'none';

export interface OtpChallengeRepository {
  /** Enforces cooldown + hourly cap, invalidates older codes, stores the new hash. */
  issue(email: string, codeHash: string, now: Date): Promise<IssueResult>;
  /** Expires a challenge whose email could not be delivered. */
  expire(challengeId: string): Promise<void>;
  /** Atomically checks the latest active challenge and consumes it on match. */
  consume(email: string, codeHash: string, now: Date): Promise<ConsumeResult>;
}

export class PrismaOtpChallengeRepository implements OtpChallengeRepository {
  constructor(private readonly db: Db) {}

  async issue(email: string, codeHash: string, now: Date): Promise<IssueResult> {
    return this.db.$transaction(async (tx) => {
      // Serialize issuance per email so limits cannot be raced.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${email}`}, 0))`;
      const hourAgo = new Date(now.getTime() - 3_600_000);
      const recent = await tx.emailOtpChallenge.findMany({
        where: { email, createdAt: { gt: hourAgo } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const latest = recent[0];
      if (latest && now.getTime() - latest.createdAt.getTime() < OTP_POLICY.resendCooldownSeconds * 1000) {
        return { ok: false, reason: 'cooldown' } as const;
      }
      if (recent.length >= OTP_POLICY.maxRequestsPerEmailPerHour) return { ok: false, reason: 'hourly_limit' } as const;
      await tx.emailOtpChallenge.updateMany({
        where: { email, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      const created = await tx.emailOtpChallenge.create({
        data: { email, codeHash, createdAt: now, expiresAt: new Date(now.getTime() + OTP_POLICY.ttlSeconds * 1000) },
        select: { id: true },
      });
      return { ok: true, challengeId: created.id } as const;
    });
  }

  async expire(challengeId: string): Promise<void> {
    await this.db.emailOtpChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(0) } });
  }

  async consume(email: string, codeHash: string, now: Date): Promise<ConsumeResult> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; code_hash: string; attempts: number; expires_at: Date }>>`
        SELECT id, code_hash, attempts, expires_at FROM email_otp_challenges
        WHERE email = ${email} AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1
        FOR UPDATE`;
      const c = rows[0];
      if (!c) return 'none';
      if (c.expires_at.getTime() <= now.getTime()) return 'expired';
      if (c.attempts >= OTP_POLICY.maxAttempts) return 'locked';
      if (!otpHashesEqual(c.code_hash, codeHash)) {
        await tx.emailOtpChallenge.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } });
        return c.attempts + 1 >= OTP_POLICY.maxAttempts ? 'locked' : 'invalid';
      }
      await tx.emailOtpChallenge.update({ where: { id: c.id }, data: { consumedAt: now } });
      return 'ok';
    });
  }
}
