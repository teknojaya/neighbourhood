import { Router } from 'express';
import { z } from 'zod';
import { CreateLoanBodySchema, LoanTransitionBodySchema, PageQuerySchema } from '@neighbourhood/shared';
import { parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from '../requests/idempotency.js';
import { logger } from '../../lib/logger.js';
import type { LoansService } from './loans.service.js';
import { plannedRouter } from '../planned.js';

/**
 * Express router handling single-unit lending requests, status transitions,
 * and date availability checks to prevent schedule overlaps.
 */
export function loansRouter(service?: LoansService): Router {
  if (!service) return plannedRouter([['get', '/loans', 'Loans']]);
  const r = Router();

  // Retrieve incoming loan requests for listings owned by the user
  r.get('/loans/incoming', async (req, res, next) => {
    try {
      const user = authUser(req);
      const query = parseQuery(PageQuerySchema, req);
      const result = await service.list(user.userId, 'incoming', query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Retrieve outgoing borrowing requests created by the user
  r.get('/loans/outgoing', async (req, res, next) => {
    try {
      const user = authUser(req);
      const query = parseQuery(PageQuerySchema, req);
      const result = await service.list(user.userId, 'outgoing', query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Query loans with direction filter (?direction=incoming|outgoing)
  r.get('/loans', async (req, res, next) => {
    try {
      const user = authUser(req);
      const query = parseQuery(
        PageQuerySchema.extend({
          direction: z.enum(['incoming', 'outgoing']).default('outgoing'),
        }),
        req,
      );
      const result = await service.list(user.userId, query.direction, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Create a new loan request for a lendable listing
  r.post('/loans', async (req, res, next) => {
    try {
      const user = authUser(req);
      const key = idempotencyKey(req);
      const body = parseBody(CreateLoanBodySchema, req);
      logger.info('loan_create_requested', { userId: user.userId, listingId: body.listingId });
      const result = await service.create(user.userId, key, body);
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  });

  // Booked dates lookup alias for compatibility with frontend booked-dates client
  r.get('/loans/listing/:listingId/booked', async (req, res, next) => {
    try {
      const user = authUser(req);
      const listingId = uuidParam(req, 'listingId');
      const result = await service.availability(user.userId, listingId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Read booked date intervals for a listing to ensure no overlapping schedules
  r.get('/listings/:listingId/availability', async (req, res, next) => {
    try {
      const user = authUser(req);
      const listingId = uuidParam(req, 'listingId');
      const result = await service.availability(user.userId, listingId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Retrieve details for a specific loan where the user is owner or borrower
  r.get('/loans/:loanId', async (req, res, next) => {
    try {
      const user = authUser(req);
      const loanId = uuidParam(req, 'loanId');
      const detail = await service.get(user.userId, loanId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  // Transition loan status (e.g., approved, rejected, checked_out, returned)
  r.post('/loans/:loanId/transition', async (req, res, next) => {
    try {
      const user = authUser(req);
      const loanId = uuidParam(req, 'loanId');
      const key = idempotencyKey(req);
      const body = parseBody(LoanTransitionBodySchema, req);
      logger.info('loan_transition_requested', { userId: user.userId, loanId, to: body.to });
      const result = await service.transition(user.userId, key, loanId, body);
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
