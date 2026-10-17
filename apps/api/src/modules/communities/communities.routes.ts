import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 1. Contracts: packages/shared/src/contracts/communities.ts.
 * Use assertCommunityRole / canSetCommunityRole from ../auth/access.ts.
 * A QR scan only identifies a point; volunteers confirm in person.
 */
export function communitiesRouter(): Router {
  return plannedRouter([
    ['get', '/communities', 'Community directory'],
    ['get', '/communities/:communityId', 'Community detail'],
    ['post', '/communities/:communityId/join', 'Join community'],
    ['post', '/communities/:communityId/members/:uid/role', 'Set member role'],
    ['get', '/communities/:communityId/points', 'Community points'],
    ['get', '/points/by-qr/:qrId', 'Resolve QR to community point'],
    ['get', '/points/:pointId/inventory', 'Point inventory'],
    ['post', '/points/:pointId/deposits', 'Propose deposit'],
    ['post', '/deposits/:depositId/review', 'Review deposit (volunteer)'],
    ['post', '/points/:pointId/adjustments', 'Stock adjustment (volunteer)'],
  ]);
}
