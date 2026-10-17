import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 2. Contracts: packages/shared/src/contracts/requests-loans.ts.
 * Transitions: donationRequestMachine. Approval reserves stock atomically;
 * see docs/architecture.md "Approval and stock".
 */
export function requestsRouter(): Router {
  return plannedRouter([
    ['post', '/requests', 'Create donation request'],
    ['get', '/requests/incoming', 'Incoming requests'],
    ['get', '/requests/outgoing', 'My requests'],
    ['get', '/requests/:requestId', 'Request detail'],
    ['post', '/requests/:requestId/transition', 'Request status change'],
  ]);
}
