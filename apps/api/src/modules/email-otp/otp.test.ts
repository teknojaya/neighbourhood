import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../test/fakes.js';
import { hashOtpCode, otpHashesEqual } from './otp.crypto.js';
import type { ConsumeResult, IssueResult, OtpChallengeRepository } from './otp.repository.js';
import type { OtpDeps } from './otp.service.js';

class FakeChallenges implements OtpChallengeRepository {
  stored: { email: string; hash: string; attempts: number } | null = null;
  issueResult: IssueResult | null = null;
  async issue(email: string, codeHash: string): Promise<IssueResult> {
    if (this.issueResult) return this.issueResult;
    this.stored = { email, hash: codeHash, attempts: 0 };
    return { ok: true, challengeId: 'c1' };
  }
  async expire() {
    this.stored = null;
  }
  async consume(email: string, codeHash: string): Promise<ConsumeResult> {
    const s = this.stored;
    if (!s || s.email !== email) return 'none';
    if (s.attempts >= 5) return 'locked';
    if (!otpHashesEqual(s.hash, codeHash)) {
      s.attempts++;
      return s.attempts >= 5 ? 'locked' : 'invalid';
    }
    this.stored = null;
    return 'ok';
  }
}

function deps(overrides: Partial<OtpDeps> = {}) {
  const sent: Array<{ to: string; code: string }> = [];
  const challenges = new FakeChallenges();
  const d: OtpDeps = {
    secret: 's'.repeat(40),
    challenges,
    sender: { sendOtp: async (to, code) => void sent.push({ to, code }) },
    identity: { uidForVerifiedEmail: async () => 'firebase-uid-1', createCustomToken: async (uid) => `custom-token-for-${uid}-xxxxxxxx` },
    ...overrides,
  };
  return { d, sent, challenges };
}

describe('email OTP', () => {
  it('reports an honest unavailable state when email delivery is not configured', async () => {
    const { app } = buildTestApp({ otp: null });
    const methods = await request(app).get('/api/v1/auth/methods').expect(200);
    expect(methods.body.emailOtp).toEqual({ available: false, reason: 'email_delivery_not_configured' });
    const res = await request(app).post('/api/v1/auth/email-otp/request').send({ email: 'a@example.test' }).expect(503);
    expect(res.body.error.code).toBe('OTP_NOT_CONFIGURED');
  });

  it('sends a 6-digit code, stores only its HMAC, and exchanges it for a custom token', async () => {
    const { d, sent, challenges } = deps();
    const { app } = buildTestApp({ otp: d });
    await request(app).post('/api/v1/auth/email-otp/request').send({ email: ' Ayu@Example.TEST ' }).expect(202);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ayu@example.test');
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    expect(challenges.stored!.hash).not.toContain(sent[0]!.code);
    expect(challenges.stored!.hash).toBe(hashOtpCode(d.secret, 'ayu@example.test', sent[0]!.code));
    const res = await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'ayu@example.test', code: sent[0]!.code }).expect(200);
    expect(res.body.customToken).toContain('firebase-uid-1');
    // Single use.
    await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'ayu@example.test', code: sent[0]!.code }).expect(400);
  });

  it('rejects wrong codes and locks after too many attempts', async () => {
    const { d, sent } = deps();
    const { app } = buildTestApp({ otp: d });
    await request(app).post('/api/v1/auth/email-otp/request').send({ email: 'b@example.test' }).expect(202);
    const wrong = sent[0]!.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      const r = await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'b@example.test', code: wrong }).expect(400);
      expect(r.body.error.code).toBe('OTP_INVALID');
    }
    const locked = await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'b@example.test', code: wrong }).expect(429);
    expect(locked.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
    await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'b@example.test', code: sent[0]!.code }).expect(429);
  });

  it('validates input and enforces resend cooldown', async () => {
    const { d, challenges } = deps();
    const { app } = buildTestApp({ otp: d });
    await request(app).post('/api/v1/auth/email-otp/request').send({ email: 'not-an-email' }).expect(400);
    await request(app).post('/api/v1/auth/email-otp/verify').send({ email: 'c@example.test', code: '12ab56' }).expect(400);
    challenges.issueResult = { ok: false, reason: 'cooldown' };
    expect((await request(app).post('/api/v1/auth/email-otp/request').send({ email: 'c@example.test' }).expect(429)).body.error.code).toBe(
      'OTP_RESEND_TOO_SOON',
    );
  });

  it('reports delivery failure honestly and invalidates the unsent code', async () => {
    const { d, challenges } = deps({ sender: { sendOtp: async () => Promise.reject(new Error('smtp down')) } });
    const { app } = buildTestApp({ otp: d });
    const res = await request(app).post('/api/v1/auth/email-otp/request').send({ email: 'd@example.test' }).expect(502);
    expect(res.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
    expect(challenges.stored).toBeNull();
  });
});
