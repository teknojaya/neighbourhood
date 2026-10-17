import { z } from 'zod';
import { ApproximateLocationSchema, IdSchema, IsoDateTimeSchema, LatLngSchema, pageOf } from '../common.js';
import { CollectionMethodSchema, ItemCategorySchema, ItemConditionSchema, ListingModeSchema } from '../enums.js';
import { RadiusKmSchema } from '../geo.js';
import { ListingStatusSchema } from '../domain/machines.js';
import { StockSchema } from '../domain/stock.js';

/** Unknown facts stay `null` — never guessed by UI or AI. */
export const ApplianceDetailsSchema = z.object({
  workingStatus: z.enum(['working', 'partially_working', 'not_working', 'unknown']),
  brand: z.string().max(80).nullable(),
  model: z.string().max(80).nullable(),
  dimensionsCm: z
    .object({
      width: z.number().positive().max(1000),
      height: z.number().positive().max(1000),
      depth: z.number().positive().max(1000),
    })
    .nullable(),
  approxWeightKg: z.number().positive().max(2000).nullable(),
  powerRequirement: z.string().max(80).nullable(),
  /** Access at the pickup location; recipients arrange helpers/transport. */
  access: z.object({
    floorLevel: z.number().int().min(-5).max(100).nullable(),
    elevatorAvailable: z.boolean().nullable(),
    requiresDismantling: z.boolean().nullable(),
    requiresInstallation: z.boolean().nullable(),
    suggestedHelpers: z.number().int().min(1).max(6).nullable(),
    notes: z.string().max(500).nullable(),
  }),
});
export type ApplianceDetails = z.infer<typeof ApplianceDetailsSchema>;

export const ListingPhotoSchema = z.object({
  /** Cloud Storage object path under listings/{listingId}/. */
  path: z.string().max(300),
  /** Short-lived signed URL produced server-side or local storage endpoint. */
  url: z.string().optional(),
});

export const LendingTermsSchema = z.object({
  maxLoanDays: z.number().int().min(1).max(90),
  depositRequired: z.literal(false).default(false),
  notes: z.string().max(500).nullable(),
});

/** Public DTO: no exact coordinates or pickup instructions. */
export const ListingPublicSchema = z.object({
  id: IdSchema,
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  status: ListingStatusSchema,
  mode: ListingModeSchema,
  category: ItemCategorySchema,
  title: z.string().max(100),
  description: z.string().max(2000),
  condition: ItemConditionSchema,
  stock: StockSchema,
  photos: z.array(ListingPhotoSchema).max(6),
  location: ApproximateLocationSchema,
  collection: z.object({
    method: CollectionMethodSchema,
    communityPointId: IdSchema.nullable(),
  }),
  appliance: ApplianceDetailsSchema.nullable(),
  lending: LendingTermsSchema.nullable(),
  /** Grocery best-before date if relevant. */
  bestBefore: z.iso.date().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ListingPublic = z.infer<typeof ListingPublicSchema>;

/**
 * Stored in `listingPrivate/{listingId}`. Returned only to the owner and to
 * requesters/borrowers whose request or loan is approved or checked out.
 */
export const ListingPrivateSchema = z.object({
  listingId: IdSchema,
  exactLocation: LatLngSchema,
  geohash: z.string(),
  pickupInstructions: z.string().max(1000),
  contactNote: z.string().max(300).nullable(),
});
export type ListingPrivate = z.infer<typeof ListingPrivateSchema>;

export const CreateListingBodySchema = z
  .strictObject({
    mode: ListingModeSchema,
    category: ItemCategorySchema,
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().max(2000),
    condition: ItemConditionSchema,
    quantity: z.number().int().min(1).max(1000),
    areaLabel: z.string().trim().min(2).max(120),
    exactLocation: LatLngSchema,
    pickupInstructions: z.string().trim().max(1000),
    collection: z.object({ method: CollectionMethodSchema, communityPointId: IdSchema.nullable() }),
    appliance: ApplianceDetailsSchema.nullable().default(null),
    lending: LendingTermsSchema.nullable().default(null),
    bestBefore: z.iso.date().nullable().default(null),
  })
  .refine((b) => b.mode !== 'lend' || b.quantity === 1, {
    message: 'Lending is single-unit: quantity must be 1',
    path: ['quantity'],
  })
  .refine((b) => b.mode !== 'lend' || b.lending !== null, {
    message: 'Lending terms are required for lend listings',
    path: ['lending'],
  })
  .refine((b) => b.category !== 'appliances' || b.appliance !== null, {
    message: 'Appliance details are required for appliances',
    path: ['appliance'],
  })
  .refine((b) => (b.collection.method === 'community_point') === (b.collection.communityPointId !== null), {
    message: 'communityPointId is required only for community_point collection',
    path: ['collection'],
  });
export type CreateListingBody = z.infer<typeof CreateListingBodySchema>;

export const UpdateListingBodySchema = z.strictObject({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  condition: ItemConditionSchema.optional(),
  quantity: z.number().int().min(1).max(1000).optional(),
  areaLabel: z.string().trim().min(2).max(120).optional(),
  pickupInstructions: z.string().trim().max(1000).optional(),
  appliance: ApplianceDetailsSchema.nullable().optional(),
  lending: LendingTermsSchema.nullable().optional(),
  bestBefore: z.iso.date().nullable().optional(),
});
export type UpdateListingBody = z.infer<typeof UpdateListingBodySchema>;

export const CreateListingPhotoBodySchema = z.strictObject({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type CreateListingPhotoBody = z.infer<typeof CreateListingPhotoBodySchema>;

export const ListingTransitionBodySchema = z.strictObject({
  to: ListingStatusSchema,
});

export const SearchListingsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: RadiusKmSchema,
  category: ItemCategorySchema.optional(),
  mode: ListingModeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchListingsQuery = z.infer<typeof SearchListingsQuerySchema>;

export const ListingPageSchema = pageOf(ListingPublicSchema);
