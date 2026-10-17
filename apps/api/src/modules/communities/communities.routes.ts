import { Router } from 'express';
import { z } from 'zod';
import { CreateCommunityBodySchema, CreatePointBodySchema, ProposeDepositBodySchema, ReviewDepositBodySchema, AdjustStockBodySchema, CommunityRoleSchema } from '@neighbourhood/shared';
import { parseBody } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from '../requests/idempotency.js';
import { plannedRouter } from '../planned.js';
import type { CommunitiesService } from './communities.service.js';

export function communitiesRouter(service?: CommunitiesService): Router {
  if (!service) return plannedRouter([['get', '/communities', 'Communities']]);
  const r = Router();
  r.get('/communities', async (_req, res) => { res.json(await service.list()); });
  r.post('/communities', async (req, res) => { const result = await service.create(authUser(req).userId, idempotencyKey(req), parseBody(CreateCommunityBodySchema, req)); res.status(result.status).json(result.body); });
  r.get('/communities/:communityId', async (req, res) => { res.json(await service.get(authUser(req).userId, uuidParam(req, 'communityId'))); });
  r.post('/communities/:communityId/join', async (req, res) => { const result = await service.join(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'communityId')); res.json(result.body); });
  r.get('/communities/:communityId/members', async (req, res) => { res.json(await service.members(authUser(req).userId, uuidParam(req, 'communityId'))); });
  r.post('/communities/:communityId/members/:uid/role', async (req, res) => { const body = parseBody(z.strictObject({ role: CommunityRoleSchema.optional(), status: z.enum(['active', 'removed']).optional() }).refine(b => b.role || b.status), req); const result = await service.setMember(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'communityId'), uuidParam(req, 'uid'), body); res.json(result.body); });
  r.get('/communities/:communityId/points', async (req, res) => { res.json(await service.points(uuidParam(req, 'communityId'))); });
  r.post('/communities/:communityId/points', async (req, res) => { const result = await service.createPoint(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'communityId'), parseBody(CreatePointBodySchema, req)); res.status(result.status).json(result.body); });
  r.get('/points/by-qr/:qrId', async (req, res) => { const qrId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).parse(req.params.qrId); res.json(await service.qr(qrId)); });
  r.get('/points/:pointId/inventory', async (req, res) => { res.json(await service.inventory(uuidParam(req, 'pointId'))); });
  r.get('/points/:pointId', async (req, res) => { res.json(await service.point(uuidParam(req, 'pointId'))); });
  r.get('/points/:pointId/deposits', async (req, res) => { res.json(await service.deposits(authUser(req).userId, uuidParam(req, 'pointId'))); });
  r.post('/points/:pointId/deposits', async (req, res) => { const body = parseBody(ProposeDepositBodySchema.omit({ pointId: true }), req); const result = await service.propose(authUser(req).userId, idempotencyKey(req), { ...body, pointId: uuidParam(req, 'pointId') }); res.status(result.status).json(result.body); });
  r.post('/deposits/:depositId/review', async (req, res) => { const result = await service.review(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'depositId'), parseBody(ReviewDepositBodySchema, req)); res.json(result.body); });
  r.post('/points/:pointId/adjustments', async (req, res) => { const result = await service.adjust(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'pointId'), parseBody(AdjustStockBodySchema, req)); res.json(result.body); });
  r.get('/points/:pointId/adjustments', async (req, res) => { res.json(await service.audit(authUser(req).userId, uuidParam(req, 'pointId'))); });
  return r;
}
