import { Router } from 'express';
import { MarkConversationReadBodySchema, PageQuerySchema, SendMessageBodySchema } from '@neighbourhood/shared';
import { parseBody, parseQuery } from '../../lib/http.js';
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
    const { body } = parseBody(SendMessageBodySchema, req);
    const result = await service.send(authUser(req).userId, idempotencyKey(req), uuidParam(req, 'conversationId'), body);
    res.status(result.status).json(result.body);
  });
  r.post('/conversations/:conversationId/read', async (req, res) => {
    const { throughMessageId } = parseBody(MarkConversationReadBodySchema, req);
    await service.markRead(authUser(req).userId, uuidParam(req, 'conversationId'), throughMessageId);
    res.sendStatus(204);
  });
  return r;
}
