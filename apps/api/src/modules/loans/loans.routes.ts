import { Router } from 'express';
import { z } from 'zod';
import { CreateLoanBodySchema, LoanTransitionBodySchema, PageQuerySchema } from '@neighbourhood/shared';
import { parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from '../requests/idempotency.js';
import type { LoansService } from './loans.service.js';
import { plannedRouter } from '../planned.js';

export function loansRouter(service?: LoansService): Router {
  if (!service) return plannedRouter([['get', '/loans', 'Loans']]);
  const r = Router();
  r.get('/loans', async (req, res) => { const q = parseQuery(PageQuerySchema.extend({ direction: z.enum(['incoming', 'outgoing']).default('outgoing') }), req); res.json(await service.list(authUser(req).userId, q.direction, q)); });
  r.post('/loans', async (req, res) => { const result = await service.create(authUser(req).userId, idempotencyKey(req), parseBody(CreateLoanBodySchema, req)); res.status(result.status).json(result.body); });
  r.get('/loans/:loanId', async (req, res) => { res.json(await service.get(authUser(req).userId, uuidParam(req, 'loanId'))); });
  r.post('/loans/:loanId/transition', async (req, res) => { const result = await service.transition(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'loanId'), parseBody(LoanTransitionBodySchema, req)); res.status(result.status).json(result.body); });
  r.get('/listings/:listingId/availability', async (req, res) => { res.json(await service.availability(authUser(req).userId, uuidParam(req, 'listingId'))); });
  return r;
}
