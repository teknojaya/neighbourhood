import {
  ApiRoutes,
  ListingPublicSchema,
  ListingPrivateSchema,
  type CreateListingBody,
  type UpdateListingBody,
  type ListingPublic,
  type ListingStatus,
} from '@neighbourhood/shared';
import { z } from 'zod';
import { api } from '../../lib/api';

export const ListingDetailResponseSchema = z.object({
  listing: ListingPublicSchema,
  privateDetails: ListingPrivateSchema.optional(),
});
export type ListingDetailResponse = z.infer<typeof ListingDetailResponseSchema>;

const MyListingsResponseSchema = z.object({
  items: z.array(ListingPublicSchema),
  total: z.number(),
});

const PhotoUploadResponseSchema = z.object({
  photoId: z.string(),
  storagePath: z.string(),
  uploadUrl: z.string(),
});

/**
 * Fetches all listings owned by the authenticated user.
 */
export async function fetchMyListings(signal?: AbortSignal): Promise<ListingPublic[]> {
  try {
    const res = await api(`${ApiRoutes.listings}/mine`, {
      method: 'GET',
      schema: MyListingsResponseSchema,
      signal,
    });
    return res.items;
  } catch (err) {
    console.error('[listingApi] fetchMyListings failed:', err);
    throw err;
  }
}

/**
 * Fetches single listing detail. If current user is the owner, privateDetails is included.
 */
export async function fetchListingDetail(listingId: string, signal?: AbortSignal): Promise<ListingDetailResponse> {
  try {
    return await api(`${ApiRoutes.listings}/${listingId}`, {
      method: 'GET',
      schema: ListingDetailResponseSchema,
      signal,
    });
  } catch (err) {
    console.error('[listingApi] fetchListingDetail failed:', err);
    throw err;
  }
}

/**
 * Creates a new donation or loan listing.
 */
export async function createListing(body: CreateListingBody, key: string): Promise<ListingPublic> {
  try {
    return await api(ApiRoutes.listings, {
      method: 'POST',
      idempotencyKey: key,
      body,
      schema: ListingPublicSchema,
    });
  } catch (err) {
    console.error('[listingApi] createListing failed:', err);
    throw err;
  }
}

/**
 * Updates details of an existing listing.
 */
export async function updateListing(listingId: string, body: UpdateListingBody, key: string = crypto.randomUUID()): Promise<ListingPublic> {
  try {
    return await api(`${ApiRoutes.listings}/${listingId}`, {
      method: 'PATCH',
      idempotencyKey: key,
      body,
      schema: ListingPublicSchema,
    });
  } catch (err) {
    console.error('[listingApi] updateListing failed:', err);
    throw err;
  }
}

/**
 * Transitions listing status (e.g. active <-> paused, or closed).
 */
export async function transitionListing(listingId: string, to: ListingStatus, key: string = crypto.randomUUID()): Promise<ListingPublic> {
  try {
    return await api(`${ApiRoutes.listings}/${listingId}/transition`, {
      method: 'POST',
      body: { to },
      idempotencyKey: key,
      schema: ListingPublicSchema,
    });
  } catch (err) {
    console.error('[listingApi] transitionListing failed:', err);
    throw err;
  }
}

/**
 * Requests a signed upload URL from the server, then PUTs the raw image binary to storage.
 */
export async function uploadListingPhoto(listingId: string, file: File, key: string): Promise<string> {
  const result = await api(ApiRoutes.listings + '/' + listingId + '/photos', { method: 'POST', binaryBody: file, idempotencyKey: key, schema: PhotoUploadResponseSchema });
  return result.storagePath;
}
