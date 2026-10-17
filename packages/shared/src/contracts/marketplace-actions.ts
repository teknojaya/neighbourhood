import { z } from 'zod';
import { CreateListingBodySchema, UpdateListingBodySchema, ListingTransitionBodySchema } from './listings.js';
import { CreateLoanBodySchema, LoanTransitionBodySchema } from './requests-loans.js';
import { ProposeDepositBodySchema, ReviewDepositBodySchema, AdjustStockBodySchema, CreateCommunityBodySchema, CreatePointBodySchema } from './communities.js';
import { CommunityRoleSchema, UiLanguageSchema } from '../enums.js';
import { RadiusKmSchema } from '../geo.js';

export const MarketplaceActionSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('listing_publish'), body: CreateListingBodySchema, attachmentIds: z.array(z.uuid()).max(2).default([]) }),
  z.strictObject({ operation: z.literal('listing_edit'), listingId: z.uuid(), expectedUpdatedAt: z.iso.datetime().optional(), body: UpdateListingBodySchema }),
  z.strictObject({ operation: z.literal('listing_transition'), listingId: z.uuid(), expectedUpdatedAt: z.iso.datetime().optional(), body: ListingTransitionBodySchema }),
  z.strictObject({ operation: z.literal('photo_delete'), listingId: z.uuid(), photoId: z.uuid() }),
  z.strictObject({ operation: z.literal('loan_request'), body: CreateLoanBodySchema }),
  z.strictObject({ operation: z.literal('loan_transition'), loanId: z.uuid(), body: LoanTransitionBodySchema }),
  z.strictObject({ operation: z.literal('community_join'), communityId: z.uuid() }),
  z.strictObject({ operation: z.literal('community_create'), body: CreateCommunityBodySchema }),
  z.strictObject({ operation: z.literal('point_create'), communityId: z.uuid(), body: CreatePointBodySchema }),
  z.strictObject({ operation: z.literal('member_update'), communityId: z.uuid(), userId: z.uuid(), role: CommunityRoleSchema.optional(), status: z.enum(['active', 'removed']).optional() }),
  z.strictObject({ operation: z.literal('deposit_propose'), body: ProposeDepositBodySchema }),
  z.strictObject({ operation: z.literal('deposit_review'), depositId: z.uuid(), body: ReviewDepositBodySchema }),
  z.strictObject({ operation: z.literal('stock_adjust'), pointId: z.uuid(), body: AdjustStockBodySchema }),
  z.strictObject({ operation: z.literal('need_delete'), needId: z.uuid() }),
  z.strictObject({ operation: z.literal('notification_read'), notificationId: z.uuid() }),
  z.strictObject({ operation: z.literal('profile_preferences'), preferredLanguage: UiLanguageSchema.optional(), searchRadiusKm: RadiusKmSchema.optional() }),
  z.strictObject({ operation: z.literal('saved_item_add'), listingId: z.uuid() }),
  z.strictObject({ operation: z.literal('saved_item_remove'), listingId: z.uuid() }),
]);
export type MarketplaceAction = z.infer<typeof MarketplaceActionSchema>;

/** Remove private fields before cards enter model context or tool results. */
export function modelSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(modelSafe);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['exactLocation', 'homeLocation', 'pickupInstructions', 'contactNote', 'exactAddress', 'consentedBy', 'lat', 'lng', 'geohash', 'email'].includes(key)).map(([key, child]) => [key, modelSafe(child)]));
  return value;
}
