import { Router } from 'express';
import { CreateDonationRequestBodySchema, DonationRequestTransitionBodySchema, PageQuerySchema } from '@neighbourhood/shared';
import { parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from './idempotency.js';
import type { RequestsService } from './requests.service.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/requests-loans.ts.
 * Transitions: donationRequestMachine. Approval reserves stock atomically;
 * see docs/architecture.md "Approval and stock".
 */
export function requestsRouter(service: RequestsService): Router {
  const r = Router();
  r.post('/requests', async (req, res) => {
    const body = parseBody(CreateDonationRequestBodySchema, req);
    const result = await service.create(authUser(req).userId, idempotencyKey(req), body);
    res.status(result.status).json(result.body);
  });
  for (const direction of ['incoming', 'outgoing'] as const) {
    r.get(`/requests/${direction}`, async (req, res) => {
      res.json(await service.list(authUser(req).userId, direction, parseQuery(PageQuerySchema, req)));
    });
  }
  r.get('/requests/:requestId', async (req, res) => {
    res.json(await service.get(authUser(req).userId, uuidParam(req, 'requestId')));
  });
  r.post('/requests/:requestId/transition', async (req, res) => {
    const body = parseBody(DonationRequestTransitionBodySchema, req);
    const result = await service.transition(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'requestId'), body);
    res.status(result.status).json(result.body);
  });
  return r;
}
