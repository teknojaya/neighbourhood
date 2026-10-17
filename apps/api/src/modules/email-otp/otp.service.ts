import { type AuthMethods, OTP_POLICY } from '@neighbourhood/shared';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import type { EmailSender } from './email.sender.js';
import type { IdentityProvider } from './firebase-identity.js';
import { generateOtpCode, hashOtpCode } from './otp.crypto.js';
import type { OtpChallengeRepository } from './otp.repository.js';

export interface OtpDeps {
  secret: string;
  challenges: OtpChallengeRepository;
  sender: EmailSender;
  identity: IdentityProvider;
}

/**
 * Numeric email OTP → Firebase custom token. `deps` is null when email
 * delivery is not configured: the method reports unavailable and the
 * endpoints return 503 OTP_NOT_CONFIGURED. There is no fallback sender.
 */
export class EmailOtpService {
  constructor(
    private readonly deps: OtpDeps | null,
    private readonly firebaseConfigured: boolean,
    private readonly now: () => Date = () => new Date(),
    private readonly generate: () => string = generateOtpCode,
  ) {}

  methods(): AuthMethods {
    return {
      google: { available: this.firebaseConfigured },
      emailOtp: !this.firebaseConfigured
        ? { available: false, reason: 'auth_backend_not_configured' }
        : this.deps
          ? { available: true, reason: 'ok' }
          : { available: false, reason: 'email_delivery_not_configured' },
    };
  }

  async request(email: string) {
    const d = this.require();
    const code = this.generate();
    const issued = await d.challenges.issue(email, hashOtpCode(d.secret, email, code), this.now());
    if (!issued.ok) {
      throw issued.reason === 'cooldown'
        ? new HttpError('OTP_RESEND_TOO_SOON', `Please wait ${OTP_POLICY.resendCooldownSeconds} seconds before requesting another code`)
        : new HttpError('RATE_LIMITED', 'Too many codes requested for this email. Try again later.');
    }
    try {
      await d.sender.sendOtp(email, code, OTP_POLICY.ttlSeconds / 60);
    } catch (err) {
      await d.challenges.expire(issued.challengeId);
      // Never log the address or the code.
      logger.error('otp_email_failed', { errorName: err instanceof Error ? err.name : 'unknown', code: (err as { code?: string }).code ?? null });
      throw new HttpError('EMAIL_DELIVERY_FAILED', 'We could not send the email. Please try again later.');
    }
    logger.info('otp_issued', {});
    return { sent: true as const, expiresInSeconds: OTP_POLICY.ttlSeconds, resendAfterSeconds: OTP_POLICY.resendCooldownSeconds };
  }

  async verify(email: string, code: string) {
    const d = this.require();
    const result = await d.challenges.consume(email, hashOtpCode(d.secret, email, code), this.now());
    switch (result) {
      case 'ok':
        break;
      case 'invalid':
        throw new HttpError('OTP_INVALID', 'That code is not correct');
      case 'locked':
        throw new HttpError('OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
      case 'expired':
      case 'none':
        throw new HttpError('OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    const uid = await d.identity.uidForVerifiedEmail(email);
    const customToken = await d.identity.createCustomToken(uid);
    logger.info('otp_verified', {});
    return { customToken };
  }

  private require(): OtpDeps {
    if (!this.firebaseConfigured) throw new HttpError('AUTH_NOT_CONFIGURED', 'Sign-in is not configured on this server');
    if (!this.deps) throw new HttpError('OTP_NOT_CONFIGURED', 'Email sign-in codes are not available on this server');
    return this.deps;
  }
}
