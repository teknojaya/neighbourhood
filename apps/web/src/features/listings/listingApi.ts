import {
  ApiRoutes,
  ListingPublicSchema,
  ListingPrivateSchema,
  type CreateListingBody,
  type UpdateListingBody,
  type ListingPublic,
  type ListingPrivate,
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
    console.info('[listingApi] Fetching my listings');
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
    console.info('[listingApi] Fetching listing detail:', listingId);
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
export async function createListing(body: CreateListingBody): Promise<ListingPublic> {
  try {
    console.info('[listingApi] Creating listing:', body.title);
    return await api(ApiRoutes.listings, {
      method: 'POST',
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
export async function updateListing(listingId: string, body: UpdateListingBody): Promise<ListingPublic> {
  try {
    console.info('[listingApi] Updating listing:', listingId);
    return await api(`${ApiRoutes.listings}/${listingId}`, {
      method: 'PATCH',
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
export async function transitionListing(listingId: string, to: ListingStatus): Promise<ListingPublic> {
  try {
    console.info(`[listingApi] Transitioning listing ${listingId} to ${to}`);
    return await api(`${ApiRoutes.listings}/${listingId}/transition`, {
      method: 'POST',
      body: { to },
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
export async function uploadListingPhoto(listingId: string, file: File): Promise<string> {
  try {
    console.info(`[listingApi] Requesting photo upload URL for ${file.name} (${file.type})`);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'] as const;
    const contentType = validMimes.find((m) => m === file.type) ?? 'image/jpeg';

    const { uploadUrl, storagePath } = await api(`${ApiRoutes.listings}/${listingId}/photos`, {
      method: 'POST',
      body: { contentType },
      schema: PhotoUploadResponseSchema,
    });

    // If a signed URL is returned (or mock endpoint), upload the binary payload
    if (uploadUrl) {
      console.info(`[listingApi] Uploading image binary to destination URL`);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });

      if (!uploadRes.ok) {
        console.warn('[listingApi] Binary upload responded with non-2xx status:', uploadRes.status);
      }
    }

    return storagePath;
  } catch (err) {
    console.error('[listingApi] uploadListingPhoto failed:', err);
    throw err;
  }
}
