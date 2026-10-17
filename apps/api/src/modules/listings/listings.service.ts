import { randomUUID } from 'node:crypto';
import {
  type CreateListingBody,
  type UpdateListingBody,
  type ListingPublic,
  type ListingPrivate,
  type ItemCategory,
  type ListingMode,
  type ListingStatus,
  geohashFor,
  approximateLocation,
  listingMachine,
  assertTransition,
  DomainError,
} from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { Prisma } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import type { ObjectStorage } from '../../lib/storage.js';
import { searchNearbyListings } from './listings.repository.js';

export interface PhotoUploadResponse {
  photoId: string;
  storagePath: string;
  uploadUrl: string;
}

/**
 * Service managing listing lifecycle, photo metadata, and location-based discovery.
 */
export class ListingsService {
  constructor(
    private readonly db: Db,
    private readonly storage?: ObjectStorage,
  ) {}

  /**
   * Creates a new listing along with private pickup instructions in an atomic transaction.
   */
  async createListing(ownerId: string, input: CreateListingBody): Promise<ListingPublic> {
    try {
      logger.info('listing_create_attempt', { ownerId, mode: input.mode, category: input.category });

      const geohash = geohashFor(input.exactLocation);

      // Persist the listing and private instructions atomically
      const listing = await this.db.$transaction(async (tx) => {
        const created = await tx.listing.create({
          data: {
            ownerId,
            status: 'active', // default to active when published
            mode: input.mode,
            category: input.category,
            title: input.title,
            description: input.description,
            condition: input.condition,
            stockTotal: input.quantity,
            stockReserved: 0,
            stockCollected: 0,
            areaLabel: input.areaLabel,
            lat: input.exactLocation.lat,
            lng: input.exactLocation.lng,
            geohash,
            collectionMethod: input.collection.method,
            communityPointId: input.collection.communityPointId,
            appliance: input.appliance ? (input.appliance as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            maxLoanDays: input.lending?.maxLoanDays ?? null,
            lendingNotes: input.lending?.notes ?? null,
            bestBefore: input.bestBefore ? new Date(input.bestBefore) : null,
          },
          include: {
            owner: { select: { displayName: true } },
            photos: { orderBy: { position: 'asc' } },
          },
        });

        await tx.listingPrivate.create({
          data: {
            listingId: created.id,
            pickupInstructions: input.pickupInstructions,
            contactNote: null,
          },
        });

        return created;
      });

      logger.info('listing_created_success', { listingId: listing.id, ownerId });
      return await this.mapToPublicDto(listing);
    } catch (err) {
      logger.error('listing_create_failed', {
        ownerId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Updates an existing listing. Only the item owner is authorized to edit.
   */
  async updateListing(ownerId: string, listingId: string, input: UpdateListingBody): Promise<ListingPublic> {
    try {
      logger.info('listing_update_attempt', { ownerId, listingId });

      const existing = await this.db.listing.findUnique({
        where: { id: listingId },
        select: { ownerId: true, status: true, stockReserved: true, stockCollected: true },
      });

      if (!existing) {
        throw new HttpError('NOT_FOUND', `Listing not found: ${listingId}`);
      }

      if (existing.ownerId !== ownerId) {
        throw new HttpError('FORBIDDEN', 'Only the listing owner can modify this item');
      }

      if (existing.status === 'closed') {
        throw new HttpError('BAD_REQUEST', 'Cannot edit a closed listing');
      }

      // Ensure new total quantity does not drop below committed units
      if (input.quantity !== undefined) {
        const committed = existing.stockReserved + existing.stockCollected;
        if (input.quantity < committed) {
          throw new HttpError(
            'CONFLICT',
            `Cannot set total stock (${input.quantity}) below reserved/collected count (${committed})`,
          );
        }
      }

      // Update in transaction to keep private notes and public details synchronized
      const updated = await this.db.$transaction(async (tx) => {
        const res = await tx.listing.update({
          where: { id: listingId },
          data: {
            title: input.title,
            description: input.description,
            condition: input.condition,
            stockTotal: input.quantity,
            areaLabel: input.areaLabel,
            appliance: input.appliance ? (input.appliance as unknown as Prisma.InputJsonValue) : undefined,
            maxLoanDays: input.lending?.maxLoanDays,
            lendingNotes: input.lending?.notes,
            bestBefore: input.bestBefore ? new Date(input.bestBefore) : undefined,
          },
          include: {
            owner: { select: { displayName: true } },
            photos: { orderBy: { position: 'asc' } },
          },
        });

        if (input.pickupInstructions !== undefined) {
          await tx.listingPrivate.upsert({
            where: { listingId },
            update: { pickupInstructions: input.pickupInstructions },
            create: { listingId, pickupInstructions: input.pickupInstructions },
          });
        }

        return res;
      });

      logger.info('listing_update_success', { listingId });
      return await this.mapToPublicDto(updated);
    } catch (err) {
      logger.error('listing_update_failed', {
        listingId,
        ownerId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Performs a validated status transition using domain state-machine rules.
   */
  async transitionStatus(ownerId: string, listingId: string, toStatus: ListingStatus): Promise<ListingPublic> {
    try {
      logger.info('listing_transition_attempt', { listingId, ownerId, toStatus });

      const existing = await this.db.listing.findUnique({
        where: { id: listingId },
        select: { id: true, ownerId: true, status: true, stockReserved: true },
      });

      if (!existing) {
        throw new HttpError('NOT_FOUND', `Listing not found: ${listingId}`);
      }

      if (existing.ownerId !== ownerId) {
        throw new HttpError('FORBIDDEN', 'Only the listing owner can change item status');
      }

      // Enforce state machine transitions
      assertTransition(listingMachine, existing.status as ListingStatus, toStatus, 'owner');

      // Rule: cannot close listing while units are currently reserved for approved requests
      if (toStatus === 'closed' && existing.stockReserved > 0) {
        throw new DomainError('CONFLICT', 'Cannot close listing while units are reserved for active requests');
      }

      const updated = await this.db.listing.update({
        where: { id: listingId },
        data: { status: toStatus },
        include: {
          owner: { select: { displayName: true } },
          photos: { orderBy: { position: 'asc' } },
        },
      });

      logger.info('listing_transition_success', { listingId, newStatus: toStatus });
      return await this.mapToPublicDto(updated);
    } catch (err) {
      logger.error('listing_transition_failed', {
        listingId,
        toStatus,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Retrieves all listings created by the specified owner.
   */
  async getMyListings(ownerId: string): Promise<ListingPublic[]> {
    try {
      logger.info('listing_get_mine', { ownerId });

      const records = await this.db.listing.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { displayName: true } },
          photos: { orderBy: { position: 'asc' } },
        },
      });

      return await Promise.all(records.map((r) => this.mapToPublicDto(r)));
    } catch (err) {
      logger.error('listing_get_mine_failed', { ownerId, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Retrieves single listing detail. If requester is the owner, private instructions are returned.
   */
  async getListingDetail(
    requesterId: string | undefined,
    listingId: string,
  ): Promise<{ listing: ListingPublic; privateDetails?: ListingPrivate }> {
    try {
      const record = await this.db.listing.findUnique({
        where: { id: listingId },
        include: {
          owner: { select: { displayName: true } },
          photos: { orderBy: { position: 'asc' } },
          private: true,
        },
      });

      if (!record) {
        throw new HttpError('NOT_FOUND', `Listing not found: ${listingId}`);
      }

      const listing = await this.mapToPublicDto(record);
      let privateDetails: ListingPrivate | undefined;

      // Provide private pickup instructions to item owner
      if (requesterId && record.ownerId === requesterId && record.private) {
        privateDetails = {
          listingId: record.id,
          exactLocation: { lat: record.lat, lng: record.lng },
          geohash: record.geohash,
          pickupInstructions: record.private.pickupInstructions,
          contactNote: record.private.contactNote,
        };
      }

      return { listing, privateDetails };
    } catch (err) {
      logger.error('listing_get_detail_failed', { listingId, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Searches nearby listings using geohash candidate bounds and Haversine distance filtering.
   */
  async searchListings(params: {
    searcherId?: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    category?: ItemCategory;
    mode?: ListingMode;
    limit: number;
  }): Promise<ListingPublic[]> {
    try {
      const rows = await searchNearbyListings(this.db, {
        center: params.center,
        radiusKm: params.radiusKm,
        category: params.category,
        mode: params.mode,
        excludeOwnerId: params.searcherId,
        limit: params.limit,
      });

      if (rows.length === 0) return [];

      // Fetch photo metadata and owner names for candidate listing rows
      const listingIds = rows.map((r) => r.id);
      const fullRecords = await this.db.listing.findMany({
        where: { id: { in: listingIds } },
        include: {
          owner: { select: { displayName: true } },
          photos: { orderBy: { position: 'asc' } },
        },
      });

      const recordMap = new Map(fullRecords.map((item) => [item.id, item]));

      const results: ListingPublic[] = [];
      for (const row of rows) {
        const full = recordMap.get(row.id);
        if (full) {
          const dto = await this.mapToPublicDto(full, row.distanceKm);
          results.push(dto);
        }
      }

      return results;
    } catch (err) {
      logger.error('listing_search_failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Generates a signed upload URL for Cloud Storage and attaches photo metadata to the listing.
   */
  async createPhotoUpload(ownerId: string, listingId: string, contentType: string): Promise<PhotoUploadResponse> {
    try {
      logger.info('photo_upload_request', { ownerId, listingId, contentType });

      const listing = await this.db.listing.findUnique({
        where: { id: listingId },
        select: { ownerId: true, _count: { select: { photos: true } } },
      });

      if (!listing) {
        throw new HttpError('NOT_FOUND', `Listing not found: ${listingId}`);
      }

      if (listing.ownerId !== ownerId) {
        throw new HttpError('FORBIDDEN', 'Only owner can upload photos for this listing');
      }

      if (listing._count.photos >= 6) {
        throw new HttpError('BAD_REQUEST', 'Maximum 6 photos per listing allowed');
      }

      const photoId = randomUUID();
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `listings/${listingId}/${photoId}.${ext}`;

      let uploadUrl = '';
      if (this.storage) {
        try {
          uploadUrl = await this.storage.signedUploadUrl(storagePath, contentType, 15 * 60);
        } catch (storageErr) {
          logger.error('storage_signed_url_failed', { error: String(storageErr) });
          // Provide fallback local endpoint in local/emulator environments
          uploadUrl = `/api/v1/storage/upload?path=${encodeURIComponent(storagePath)}`;
        }
      } else {
        uploadUrl = `/api/v1/storage/upload?path=${encodeURIComponent(storagePath)}`;
      }

      // Record photo in database
      await this.db.listingPhoto.create({
        data: {
          id: photoId,
          listingId,
          storagePath,
          position: listing._count.photos,
        },
      });

      logger.info('photo_upload_ready', { photoId, storagePath });
      return { photoId, storagePath, uploadUrl };
    } catch (err) {
      logger.error('photo_upload_failed', { listingId, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Maps internal database record to safe public DTO, hiding private location and attaching photo URLs.
   */
  private async mapToPublicDto(
    record: Prisma.ListingGetPayload<{
      include: {
        owner: { select: { displayName: true } };
        photos: { orderBy: { position: 'asc' } };
      };
    }>,
    distanceKm?: number,
  ): Promise<ListingPublic> {
    const photosWithUrls = await Promise.all(
      record.photos.map(async (photo) => {
        let signedUrl: string | undefined;
        if (this.storage) {
          try {
            signedUrl = await this.storage.signedReadUrl(photo.storagePath);
          } catch {
            signedUrl = `/api/v1/storage/file?path=${encodeURIComponent(photo.storagePath)}`;
          }
        } else {
          signedUrl = `/api/v1/storage/file?path=${encodeURIComponent(photo.storagePath)}`;
        }
        return {
          path: photo.storagePath,
          url: signedUrl,
        };
      }),
    );

    return {
      id: record.id,
      ownerId: record.ownerId,
      ownerDisplayName: record.owner.displayName ?? 'Neighbour',
      status: record.status as ListingStatus,
      mode: record.mode as ListingMode,
      category: record.category as ItemCategory,
      title: record.title,
      description: record.description,
      condition: record.condition as ListingPublic['condition'],
      stock: {
        total: record.stockTotal,
        reserved: record.stockReserved,
        collected: record.stockCollected,
      },
      photos: photosWithUrls,
      location: approximateLocation({ lat: record.lat, lng: record.lng }, record.areaLabel, distanceKm),
      collection: {
        method: record.collectionMethod as ListingPublic['collection']['method'],
        communityPointId: record.communityPointId,
      },
      appliance: record.appliance ? (record.appliance as ListingPublic['appliance']) : null,
      lending: record.maxLoanDays
        ? {
            maxLoanDays: record.maxLoanDays,
            depositRequired: false,
            notes: record.lendingNotes,
          }
        : null,
      bestBefore: record.bestBefore ? record.bestBefore.toISOString().slice(0, 10) : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
