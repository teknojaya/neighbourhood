import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RequestEmailOtpBodySchema, VerifyEmailOtpBodySchema } from '@neighbourhood/shared';
import { HttpError, parseBody } from '../../lib/http.js';
import type { EmailOtpService } from './otp.service.js';

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError('RATE_LIMITED', 'Too many attempts. Please wait and try again.')),
  });

/** Public (unauthenticated) sign-in routes. Per-IP limits on top of per-email limits. */
export function authPublicRouter(otp: EmailOtpService): Router {
  const r = Router();
  r.get('/auth/methods', (_req, res) => {
    res.json(otp.methods());
  });
  r.post('/auth/email-otp/request', limiter(10), async (req, res) => {
    const { email } = parseBody(RequestEmailOtpBodySchema, req);
    res.status(202).json(await otp.request(email));
  });
  r.post('/auth/email-otp/verify', limiter(30), async (req, res) => {
    const { email, code } = parseBody(VerifyEmailOtpBodySchema, req);
    res.json(await otp.verify(email, code));
  });
  return r;
}
