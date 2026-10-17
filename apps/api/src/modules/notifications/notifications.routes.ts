import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/messaging.ts.
 * Push is opt-in; payloads must not contain addresses or medical details.
 */
export function notificationsRouter(): Router {
  return plannedRouter([
    ['get', '/notifications', 'Notification inbox'],
    ['post', '/notifications/:notificationId/read', 'Mark notification read'],
    ['post', '/notifications/push-tokens', 'Register push token'],
    ['delete', '/notifications/push-tokens/:tokenId', 'Remove push token'],
  ]);
}
