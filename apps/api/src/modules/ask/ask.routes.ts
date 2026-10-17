import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AI_LIMITS, AskCreateSessionBodySchema, AskSendBodySchema, AskConfirmBodySchema, AskEditNeedBodySchema, PageQuerySchema } from '@neighbourhood/shared';
import { HttpError, parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { aiRateLimiter } from '../ai/ai.routes.js';
import { idempotencyKey } from '../requests/idempotency.js';
import type { AskService } from './ask.service.js';

export function askRouter(service: AskService): Router {
  const r = Router();
  const limiter = aiRateLimiter();
  const uploadLimit = rateLimit({ windowMs: 10 * 60_000, limit: 20, keyGenerator: (req) => authUser(req).userId,
    handler: (_req, _res, next) => next(new HttpError('RATE_LIMITED', 'Too many photos; try again later')) });
  r.get('/ask/status', (_req, res) => { res.json(service.status()); });
  r.get('/ask/sessions', async (req, res) => { res.json(await service.list(authUser(req).userId, parseQuery(PageQuerySchema, req))); });
  r.post('/ask/sessions', async (req, res) => {
    const body = parseBody(AskCreateSessionBodySchema, req);
    res.status(201).json(await service.create(authUser(req).userId, body.clientId));
  });
  r.get('/ask/sessions/:sessionId', async (req, res) => {
    const query = parseQuery(z.object({ before: z.coerce.number().int().nonnegative().optional() }), req);
    res.json(await service.detail(authUser(req).userId, uuidParam(req, 'sessionId'), query.before));
  });
  r.post('/ask/sessions/:sessionId/messages', limiter, async (req, res) => {
    res.json(await service.send(authUser(req).userId, uuidParam(req, 'sessionId'), parseBody(AskSendBodySchema, req)));
  });
  r.post('/ask/sessions/:sessionId/stop', async (req, res) => { await service.stop(authUser(req).userId, uuidParam(req, 'sessionId')); res.sendStatus(204); });
  r.delete('/ask/sessions/:sessionId', async (req, res) => {
    await service.deleteSession(authUser(req).userId, uuidParam(req, 'sessionId')); res.sendStatus(204);
  });
  r.post('/ask/sessions/:sessionId/attachments', uploadLimit,
    express.raw({ type: [...AI_LIMITS.imageMimeTypes], limit: AI_LIMITS.imageMaxBytes }), async (req, res) => {
      if (!Buffer.isBuffer(req.body)) throw new HttpError('VALIDATION_FAILED', 'Attach a JPEG, PNG or WebP file');
      res.status(201).json(await service.upload(authUser(req).userId, uuidParam(req, 'sessionId'), req.body, (req.get('Content-Type') ?? '').split(';')[0]!.trim(), idempotencyKey(req)));
    });
  r.get('/ask/sessions/:sessionId/attachments/:attachmentId', async (req, res) => {
    const photo = await service.image(authUser(req).userId, uuidParam(req, 'sessionId'), uuidParam(req, 'attachmentId'));
    res.type(photo.mimeType).send(photo.bytes);
  });
  r.delete('/ask/sessions/:sessionId/attachments/:attachmentId', async (req, res) => {
    await service.removeAttachment(authUser(req).userId, uuidParam(req, 'sessionId'), uuidParam(req, 'attachmentId')); res.sendStatus(204);
  });
  r.patch('/ask/actions/:actionId', async (req, res) => {
    const body = parseBody(AskEditNeedBodySchema, req);
    res.json(await service.editNeed(authUser(req).userId, uuidParam(req, 'actionId'), body.revision, body.extraction));
  });
  r.post('/ask/actions/:actionId/confirm', async (req, res) => {
    const body = parseBody(AskConfirmBodySchema, req);
    res.json(await service.confirm(authUser(req).userId, uuidParam(req, 'actionId'), body.revision));
  });
  r.post('/ask/actions/:actionId/cancel', async (req, res) => {
    res.json(await service.cancelAction(authUser(req).userId, uuidParam(req, 'actionId')));
  });
  return r;
}
