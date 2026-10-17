import { Router } from 'express';
import { PageQuerySchema, SaveNeedBodySchema } from '@neighbourhood/shared';
import { notImplemented, parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from '../requests/idempotency.js';
import type { NeedsService } from './needs.service.js';

/**
 * Owner: Engineer 2. Saved needs (after the user reviews an AI extraction)
 * and grounded matching. AI extraction itself lives in ../ai.
 */
export function needsRouter(service: NeedsService): Router {
  const r = Router();
  r.get('/needs', async (req, res) => {
    res.json(await service.list(authUser(req).userId, parseQuery(PageQuerySchema, req)));
  });
  r.post('/needs', async (req, res) => {
    const result = await service.save(authUser(req).userId, idempotencyKey(req), parseBody(SaveNeedBodySchema, req));
    res.status(result.status).json(result.body);
  });
  r.delete('/needs/:needId', async (req, res) => {
    await service.delete(authUser(req).userId, uuidParam(req, 'needId'));
    res.sendStatus(204);
  });
  r.get('/needs/:needId/matches', notImplemented('Matching listings for a need'));
  return r;
}
