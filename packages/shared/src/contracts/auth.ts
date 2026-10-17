import { z } from 'zod';

/**
 * Sign-in methods. Both end in a Firebase ID token for the SAME Firebase
 * user per email address:
 *  - Google: Firebase Auth GoogleAuthProvider (popup, redirect fallback).
 *  - Email OTP: server verifies a 6-digit code, then returns a Firebase
 *    custom token; the client calls signInWithCustomToken.
 * Passwords and magic links are not supported.
 */
export const OTP_POLICY = {
  codeLength: 6,
  ttlSeconds: 10 * 60,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxRequestsPerEmailPerHour: 5,
} as const;

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

/** GET /api/v1/auth/methods (public) */
export const AuthMethodsSchema = z.object({
  google: z.object({ available: z.boolean() }),
  emailOtp: z.object({
    available: z.boolean(),
    reason: z.enum(['ok', 'email_delivery_not_configured', 'auth_backend_not_configured']),
  }),
});
export type AuthMethods = z.infer<typeof AuthMethodsSchema>;

/** POST /api/v1/auth/email-otp/request (public). Always 202 for valid input. */
export const RequestEmailOtpBodySchema = z.strictObject({ email: EmailSchema });
export const RequestEmailOtpResponseSchema = z.object({
  sent: z.literal(true),
  expiresInSeconds: z.number().int(),
  resendAfterSeconds: z.number().int(),
});

/** POST /api/v1/auth/email-otp/verify (public) */
export const VerifyEmailOtpBodySchema = z.strictObject({
  email: EmailSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export const VerifyEmailOtpResponseSchema = z.object({
  /** Short-lived Firebase custom token; exchange with signInWithCustomToken. */
  customToken: z.string().min(20),
});
