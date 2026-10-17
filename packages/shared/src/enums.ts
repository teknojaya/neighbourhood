import { z } from 'zod';

export const ItemCategorySchema = z.enum([
  'groceries',
  'clothing',
  'books',
  'household',
  'appliances',
  'mobility_aids',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;
export const ITEM_CATEGORIES = ItemCategorySchema.options;

/** How an item is offered. One user may both give and receive. */
export const ListingModeSchema = z.enum(['donate', 'lend']);
export type ListingMode = z.infer<typeof ListingModeSchema>;

export const ItemConditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'needs_repair']);
export type ItemCondition = z.infer<typeof ItemConditionSchema>;

/**
 * Where collection happens. The recipient always arranges their own
 * transport and helpers — there is no delivery or driver booking.
 */
export const CollectionMethodSchema = z.enum(['owner_location', 'community_point']);
export type CollectionMethod = z.infer<typeof CollectionMethodSchema>;

/**
 * Platform-wide roles. Granted only by server-side tooling run by operators
 * (see apps/api/scripts/grant-role.ts) into `user_roles`. Never accepted from request bodies.
 */
export const PlatformRoleSchema = z.enum(['staff', 'product_category_editor']);
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

/** Per-community roles, stored server-side on the membership record. */
export const CommunityRoleSchema = z.enum(['member', 'volunteer', 'moderator']);
export type CommunityRole = z.infer<typeof CommunityRoleSchema>;

export const UiLanguageSchema = z.enum(['en', 'id']);
export type UiLanguage = z.infer<typeof UiLanguageSchema>;
