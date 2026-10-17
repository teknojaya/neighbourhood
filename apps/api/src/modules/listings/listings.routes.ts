import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 1. Contracts: packages/shared/src/contracts/listings.ts.
 * Public responses use ListingPublicSchema (approximate location only).
 * Private pickup data (listingPrivate/{id}) only for owner + approved participants.
 */
export function listingsRouter(): Router {
  return plannedRouter([
    ['get', '/listings', 'Nearby listing search'],
    ['post', '/listings', 'Create listing'],
    ['get', '/listings/mine', 'My listings'],
    ['get', '/listings/:listingId', 'Listing detail'],
    ['patch', '/listings/:listingId', 'Edit listing'],
    ['post', '/listings/:listingId/transition', 'Listing status change'],
    ['get', '/listings/:listingId/pickup', 'Private pickup details'],
    ['post', '/listings/:listingId/photos', 'Listing photo upload'],
  ]);
}
