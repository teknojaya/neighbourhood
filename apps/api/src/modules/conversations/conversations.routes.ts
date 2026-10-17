import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/messaging.ts.
 * Participants come from the request/loan record, never the client.
 */
export function conversationsRouter(): Router {
  return plannedRouter([
    ['get', '/conversations', 'My conversations'],
    ['get', '/conversations/:conversationId/messages', 'Conversation messages'],
    ['post', '/conversations/:conversationId/messages', 'Send message'],
  ]);
}
