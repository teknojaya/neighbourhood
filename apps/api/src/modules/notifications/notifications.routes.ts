import { Router } from 'express';
import { PageQuerySchema } from '@neighbourhood/shared';
import { parseQuery } from '../../lib/http.js';
import { uuidParam } from '../../lib/route-input.js';
import { authUser } from '../auth/auth.js';
import type { NotificationsService } from './notifications.service.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/messaging.ts.
 * Push is opt-in; payloads must not contain addresses or medical details.
 */
export function notificationsRouter(service: NotificationsService): Router {
  const r = Router();
  r.get('/notifications/unread', async (req, res) => {
    res.json(await service.unread(authUser(req).userId));
  });
  r.get('/notifications', async (req, res) => {
    res.json(await service.list(authUser(req).userId, parseQuery(PageQuerySchema, req)));
  });
  r.post('/notifications/:notificationId/read', async (req, res) => {
    res.json(await service.markRead(authUser(req).userId, uuidParam(req, 'notificationId')));
  });
  return r;
}
