import express, { Router } from 'express';
import { AI_LIMITS } from '@neighbourhood/shared';
import { idempotencyKey } from '../requests/idempotency.js';
import { uuidParam } from '../../lib/route-input.js';
import {
  CreateListingBodySchema,
  UpdateListingBodySchema,
  ListingTransitionBodySchema,
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
        query: query.query,
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
      const listing = await service.createListing(user.userId, body, idempotencyKey(req));
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
      const listingId = uuidParam(req, 'listingId');
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
      const listingId = uuidParam(req, 'listingId');
      const body = parseBody(UpdateListingBodySchema, req);
      const updated = await service.updateListing(user.userId, listingId, body, idempotencyKey(req));
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Transition listing status (draft -> active -> paused -> closed)
  router.post('/listings/:listingId/transition', async (req, res, next) => {
    try {
      const user = authUser(req);
      const listingId = uuidParam(req, 'listingId');
      const body = parseBody(ListingTransitionBodySchema, req);
      const updated = await service.transitionStatus(user.userId, listingId, body.to, idempotencyKey(req));
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Return private pickup instructions to the listing owner
  router.get('/listings/:listingId/pickup', async (req, res, next) => {
    try {
      const user = authUser(req);
      const listingId = uuidParam(req, 'listingId');
      res.json(await service.pickup(user.userId, listingId));
    } catch (err) {
      next(err);
    }
  });

  // Upload a binary photo directly to storage and record the path in DB
  router.post(
    '/listings/:listingId/photos',
    express.raw({ type: [...AI_LIMITS.imageMimeTypes], limit: AI_LIMITS.imageMaxBytes }),
    async (req, res, next) => {
      try {
        const user = authUser(req);
        const listingId = uuidParam(req, 'listingId');
        const mimeType = (req.get('Content-Type') ?? '').split(';')[0]!;
        const key = idempotencyKey(req);
        const result = await service.uploadPhoto(user.userId, listingId, req.body, mimeType, key);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Remove a specific photo from storage and DB
  router.delete('/listings/:listingId/photos/:photoId', async (req, res, next) => {
    try {
      const user = authUser(req);
      const listingId = uuidParam(req, 'listingId');
      const photoId = uuidParam(req, 'photoId');
      const key = idempotencyKey(req);
      res.json(await service.removePhoto(user.userId, listingId, photoId, key));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
