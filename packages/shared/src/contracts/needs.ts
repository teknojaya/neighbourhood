import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, pageOf } from '../common.js';
import { NeedsExtractionSchema } from '../ai/contracts.js';

/** The user confirms the AI draft before it becomes a saved, private need. */
export const SaveNeedBodySchema = z.strictObject({ extraction: NeedsExtractionSchema });
export type SaveNeedBody = z.infer<typeof SaveNeedBodySchema>;

export const SavedNeedSchema = z.object({
  id: IdSchema,
  extraction: NeedsExtractionSchema,
  createdAt: IsoDateTimeSchema,
});
export type SavedNeed = z.infer<typeof SavedNeedSchema>;
export const SavedNeedPageSchema = pageOf(SavedNeedSchema);
