import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AI_LIMITS } from '@neighbourhood/shared';
import { MarkConversationReadBodySchema, PageQuerySchema, SendMessageBodySchema } from '@neighbourhood/shared';
import { HttpError, parseBody, parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import { idempotencyKey } from '../requests/idempotency.js';
import type { ConversationsService } from './conversations.service.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/messaging.ts.
 * Participants come from the request/loan record, never the client.
 */
export function conversationsRouter(service: ConversationsService): Router {
  const r = Router();
  const uploadLimit = rateLimit({ windowMs: 600000, limit: 20, keyGenerator: req => authUser(req).userId, handler: (_req, _res, next) => next(new HttpError('RATE_LIMITED', 'Too many photos; try again later')) });
  r.post('/conversations/:conversationId/attachments', uploadLimit, express.raw({ type: [...AI_LIMITS.imageMimeTypes], limit: AI_LIMITS.imageMaxBytes }), async (req, res) => { if (!service.upload) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage unavailable'); if (!Buffer.isBuffer(req.body)) throw new HttpError('VALIDATION_FAILED', 'Choose a JPEG, PNG or WebP'); res.status(201).json(await service.upload(authUser(req).userId, uuidParam(req, 'conversationId'), req.body, (req.get('Content-Type') ?? '').split(';')[0]!, idempotencyKey(req))); });
  r.get('/conversations/:conversationId/attachments/:attachmentId', async (req, res) => { if (!service.image) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage unavailable'); const photo = await service.image(authUser(req).userId, uuidParam(req, 'conversationId'), uuidParam(req, 'attachmentId')); res.type(photo.mimeType).send(photo.bytes); });
  r.delete('/conversations/:conversationId/attachments/:attachmentId', async (req, res) => { if (!service.removeAttachment) throw new HttpError('STORAGE_UNAVAILABLE', 'Photo storage unavailable'); await service.removeAttachment(authUser(req).userId, uuidParam(req, 'conversationId'), uuidParam(req, 'attachmentId')); res.sendStatus(204); });
  r.get('/conversations', async (req, res) => {
    res.json(await service.list(authUser(req).userId, parseQuery(PageQuerySchema, req)));
  });
  r.get('/conversations/:conversationId', async (req, res) => {
    res.json(await service.get(authUser(req).userId, uuidParam(req, 'conversationId')));
  });
  r.get('/conversations/:conversationId/messages', async (req, res) => {
    res.json(await service.messages(authUser(req).userId, uuidParam(req, 'conversationId'), parseQuery(PageQuerySchema, req)));
  });
  r.post('/conversations/:conversationId/messages', async (req, res) => {
    const { body, attachmentIds } = parseBody(SendMessageBodySchema, req);
    const result = await service.send(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'conversationId'), body, attachmentIds);
    res.status(result.status).json(result.body);
  });
  r.post('/conversations/:conversationId/read', async (req, res) => {
    const { throughMessageId } = parseBody(MarkConversationReadBodySchema, req);
    await service.markRead(authUser(req).userId, uuidParam(req, 'conversationId'), throughMessageId);
    res.sendStatus(204);
  });
  return r;
}
