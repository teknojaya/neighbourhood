import { describe, expect, it } from 'vitest';
import type { CreateListingBody } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { ListingsService } from './listings.service.js';

/**
 * Creates an in-memory database mock supporting listings transactions and basic CRUD.
 */
function createMockDb(): Db {
  const listings: Array<{
    id: string;
    ownerId: string;
    status: string;
    mode: string;
    category: string;
    title: string;
    description: string;
    condition: string;
    stockTotal: number;
    stockReserved: number;
    stockCollected: number;
    areaLabel: string;
    lat: number;
    lng: number;
    geohash: string;
    collectionMethod: string;
    communityPointId: string | null;
    appliance: unknown;
    maxLoanDays: number | null;
    lendingNotes: string | null;
    bestBefore: Date | null;
    createdAt: Date;
    updatedAt: Date;
    owner: { displayName: string | null };
    photos: Array<{ id: string; listingId: string; storagePath: string; position: number }>;
  }> = [];

  const privateRecords: Array<{
    listingId: string;
    pickupInstructions: string;
    contactNote: string | null;
  }> = [];

  const mockDb = {
    listing: {
      create: async ({ data }: { data: any }) => {
        const record = {
          id: 'listing-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { displayName: 'Alice' },
          photos: [],
        };
        listings.push(record);
        return record;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return listings.find((l) => l.id === where.id) ?? null;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = listings.find((l) => l.id === where.id);
        if (!item) throw new Error('Not found');
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      findMany: async ({ where }: { where: { ownerId?: string } }) => {
        return listings.filter((l) => !where.ownerId || l.ownerId === where.ownerId);
      },
    },
    listingPrivate: {
      create: async ({ data }: { data: any }) => {
        privateRecords.push(data);
        return data;
      },
      upsert: async ({ where, update, create }: { where: { listingId: string }; update: any; create: any }) => {
        const item = privateRecords.find((p) => p.listingId === where.listingId);
        if (item) Object.assign(item, update);
        else privateRecords.push(create);
      },
    },
    listingPhoto: {
      create: async ({ data }: { data: any }) => {
        const listing = listings.find((l) => l.id === data.listingId);
        if (listing) listing.photos.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(mockDb),
  };

  return mockDb as unknown as Db;
}

describe('ListingsService', () => {
  const sampleInput: CreateListingBody = {
    mode: 'donate',
    category: 'groceries',
    title: 'Surplus Rice 5kg',
    description: 'Unopened bag of jasmine rice',
    condition: 'new',
    quantity: 2,
    areaLabel: 'Menteng, Jakarta Pusat',
    exactLocation: { lat: -6.195, lng: 106.832 },
    pickupInstructions: 'Ring doorbell 3A at reception',
    collection: { method: 'owner_location', communityPointId: null },
    appliance: null,
    lending: null,
    bestBefore: null,
  };

  it('creates listing and private instructions atomically', async () => {
    const db = createMockDb();
    const service = new ListingsService(db);

    const created = await service.createListing('user-1', sampleInput);

    expect(created.id).toBe('listing-1');
    expect(created.title).toBe('Surplus Rice 5kg');
    expect(created.status).toBe('active');
    expect(created.stock.total).toBe(2);
    expect(created.location.areaLabel).toBe('Menteng, Jakarta Pusat');
  });

  it('allows owner to update listing and prevents non-owner edits', async () => {
    const db = createMockDb();
    const service = new ListingsService(db);

    await service.createListing('user-1', sampleInput);

    // Update by owner succeeds
    const updated = await service.updateListing('user-1', 'listing-1', {
      title: 'Surplus Rice 10kg',
      quantity: 5,
    });
    expect(updated.title).toBe('Surplus Rice 10kg');
    expect(updated.stock.total).toBe(5);

    // Update by other user throws FORBIDDEN
    await expect(service.updateListing('user-2', 'listing-1', { title: 'Hacked' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('enforces valid status transitions using state machine', async () => {
    const db = createMockDb();
    const service = new ListingsService(db);

    await service.createListing('user-1', sampleInput);

    // active -> paused is allowed
    const paused = await service.transitionStatus('user-1', 'listing-1', 'paused');
    expect(paused.status).toBe('paused');

    // paused -> active is allowed
    const activeAgain = await service.transitionStatus('user-1', 'listing-1', 'active');
    expect(activeAgain.status).toBe('active');

    // active -> closed is allowed
    const closed = await service.transitionStatus('user-1', 'listing-1', 'closed');
    expect(closed.status).toBe('closed');

    // closed is a terminal state; cannot transition back to active
    await expect(service.transitionStatus('user-1', 'listing-1', 'active')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
});
