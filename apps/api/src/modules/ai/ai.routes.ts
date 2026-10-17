import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AI_LIMITS, ExtractNeedsBodySchema } from '@neighbourhood/shared';
import { HttpError, notImplemented, parseBody } from '../../lib/http.js';
import { authUser } from '../auth/auth.js';
import type { AiService } from './ai.service.js';

/**
 * Per-user limiter (keyed by verified uid, so it must run after requireAuth).
 * In-memory: each Cloud Run instance keeps its own counters. Gemini project
 * quota is the global backstop; see docs/architecture.md.
 */
export function aiRateLimiter() {
  return rateLimit({
    windowMs: AI_LIMITS.rateLimitWindowMs,
    limit: AI_LIMITS.rateLimitPerWindow,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${authUser(req).userId}`,
    handler: (_req, _res, next) => next(new HttpError('RATE_LIMITED', 'Too many AI requests. Please wait a minute.')),
  });
}

export function aiRouter(service: AiService): Router {
  const r = Router();
  const limiter = aiRateLimiter();

  r.get('/ai/status', (_req, res) => {
    res.json(service.status());
  });

  r.post('/ai/needs/extract', limiter, async (req, res) => {
    const body = parseBody(ExtractNeedsBodySchema, req);
    res.json(await service.extractNeeds(body));
  });

  // Contracts defined in packages/shared/src/ai/contracts.ts; owners: see docs/module-ownership.md.
  r.post('/ai/listing-draft', limiter, notImplemented('Photo-assisted listing drafts'));
  r.post('/ai/match-explanations', limiter, notImplemented('Matching explanations'));
  return r;
}
