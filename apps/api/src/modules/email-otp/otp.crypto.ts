import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_POLICY } from '@neighbourhood/shared';

/** Uniformly random numeric code from the OS CSPRNG. */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_POLICY.codeLength)).padStart(OTP_POLICY.codeLength, '0');
}

/**
 * HMAC-SHA256(secret, email:code). Only this hash is stored, so a database
 * leak does not reveal codes and cannot be brute-forced without the secret.
 */
export function hashOtpCode(secret: string, email: string, code: string): string {
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

export function otpHashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
