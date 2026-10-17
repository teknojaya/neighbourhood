import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 2. Saved needs (after the user reviews an AI extraction)
 * and grounded matching. AI extraction itself lives in ../ai.
 */
export function needsRouter(): Router {
  return plannedRouter([
    ['get', '/needs', 'My saved needs'],
    ['post', '/needs', 'Save reviewed need'],
    ['delete', '/needs/:needId', 'Delete need'],
    ['get', '/needs/:needId/matches', 'Matching listings for a need'],
  ]);
}
