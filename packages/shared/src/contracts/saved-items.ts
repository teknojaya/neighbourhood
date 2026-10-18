import { z } from 'zod';
import { pageOf } from '../common.js';
import { ListingPublicSchema } from './listings.js';
export const SavedItemSchema = z.object({ id: z.uuid(), listingId: z.uuid(), title: z.string(), createdAt: z.iso.datetime(), listing: ListingPublicSchema.nullable() });
export const SavedItemPageSchema = pageOf(SavedItemSchema);
export const SavedItemIdsSchema = z.object({ ids: z.array(z.uuid()) });
export const SavedItemStateSchema = z.object({ saved: z.boolean() });
