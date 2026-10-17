import { Router } from 'express';
import {
  CreateListingBodySchema,
  UpdateListingBodySchema,
  ListingTransitionBodySchema,
  CreateListingPhotoBodySchema,
  SearchListingsQuerySchema,
} from '@neighbourhood/shared';
import { parseBody, parseQuery } from '../../lib/http.js';
import { authUser } from '../auth/auth.js';
import { plannedRouter } from '../planned.js';
import type { ListingsService } from './listings.service.js';

/**
 * Routes managing items offered for donation or loan, including photo uploads and radius searches.
 */
export function listingsRouter(service?: ListingsService): Router {
  if (!service) {
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

  const router = Router();

  // Search nearby active listings within a specified geographical radius
  router.get('/listings', async (req, res, next) => {
    try {
      const query = parseQuery(SearchListingsQuerySchema, req);
      const user = req.auth; // Optional authenticated user context
      const listings = await service.searchListings({
        searcherId: user?.userId,
        center: { lat: query.lat, lng: query.lng },
        radiusKm: query.radiusKm,
        category: query.category,
        mode: query.mode,
        limit: query.limit,
      });
      res.json({ items: listings, total: listings.length });
    } catch (err) {
      next(err);
    }
  });

  // Create a new listing (donation or lend)
  router.post('/listings', async (req, res, next) => {
    try {
      const user = authUser(req);
      const body = parseBody(CreateListingBodySchema, req);
      const listing = await service.createListing(user.userId, body);
      res.status(201).json(listing);
    } catch (err) {
      next(err);
    }
  });

  // Get all listings belonging to the authenticated user
  router.get('/listings/mine', async (req, res, next) => {
    try {
      const user = authUser(req);
      const items = await service.getMyListings(user.userId);
      res.json({ items, total: items.length });
    } catch (err) {
      next(err);
    }
  });

  // Get detail for a single listing
  router.get('/listings/:listingId', async (req, res, next) => {
    try {
      const { listingId } = req.params;
      const user = req.auth;
      const detail = await service.getListingDetail(user?.userId, listingId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  // Edit details of an existing listing
  router.patch('/listings/:listingId', async (req, res, next) => {
    try {
      const user = authUser(req);
      const { listingId } = req.params;
      const body = parseBody(UpdateListingBodySchema, req);
      const updated = await service.updateListing(user.userId, listingId, body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Transition listing status (draft -> active -> paused -> closed)
  router.post('/listings/:listingId/transition', async (req, res, next) => {
    try {
      const user = authUser(req);
      const { listingId } = req.params;
      const body = parseBody(ListingTransitionBodySchema, req);
      const updated = await service.transitionStatus(user.userId, listingId, body.to);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Request a signed upload URL to attach a photo to the listing
  router.post('/listings/:listingId/photos', async (req, res, next) => {
    try {
      const user = authUser(req);
      const { listingId } = req.params;
      const body = parseBody(CreateListingPhotoBodySchema, req);
      const result = await service.createPhotoUpload(user.userId, listingId, body.contentType);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
