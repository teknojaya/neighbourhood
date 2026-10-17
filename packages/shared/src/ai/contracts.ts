import { z } from 'zod';
import { IdSchema } from '../common.js';
import { ItemCategorySchema, ItemConditionSchema, ListingModeSchema } from '../enums.js';

/** Hard bounds enforced server-side (body parser, validation and SDK call). */
export const AI_LIMITS = {
  needsTextMaxChars: 2000,
  listingHintMaxChars: 500,
  imageMaxBytes: 4 * 1024 * 1024,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  matchCandidatesMax: 20,
  maxOutputTokens: 2048,
  requestTimeoutMs: 25_000,
  /** Per-user AI calls per window (see apps/api rate limiter). */
  rateLimitPerWindow: 10,
  rateLimitWindowMs: 60_000,
} as const;

export const AiStatusSchema = z.object({
  available: z.boolean(),
  /** Configured model id when available; omitted otherwise. */
  model: z.string().optional(),
  reason: z.enum(['ok', 'not_configured', 'disabled']),
});
export type AiStatus = z.infer<typeof AiStatusSchema>;

// ===================================================== 1. Needs extraction
export const ExtractNeedsBodySchema = z.strictObject({
  text: z.string().trim().min(3).max(AI_LIMITS.needsTextMaxChars),
  /** Today's date in the user's locale; lets the model resolve "next Friday". */
  today: z.iso.date().optional(),
});
export type ExtractNeedsBody = z.infer<typeof ExtractNeedsBodySchema>;

/** Whether the person hopes to receive to keep, or to borrow and return. */
export const AcquisitionPreferenceSchema = z.enum(['donation', 'borrow', 'either', 'unknown']);

const shortText = z.string().trim().min(1).max(200);

export const ExtractedNeedItemSchema = z.object({
  name: shortText,
  category: z.union([ItemCategorySchema, z.literal('other'), z.literal('unknown')]),
  quantity: z.number().int().min(1).max(1000).nullable(),
  preference: AcquisitionPreferenceSchema,
  attributes: z
    .array(z.object({ name: z.string().trim().min(1).max(50), value: z.string().trim().min(1).max(100) }))
    .max(10),
});

export const NeedsExtractionSchema = z.object({
  language: z.enum(['en', 'id', 'mixed', 'unknown']),
  items: z.array(ExtractedNeedItemSchema).max(10),
  timing: z.object({
    neededBy: z.iso.date().nullable(),
    loanDurationDays: z.number().int().min(1).max(365).nullable(),
    /** The user's own words about timing, if any (e.g. "minggu depan"). */
    originalText: z.string().max(200).nullable(),
  }),
  /** Questions in the same language as the input. */
  clarificationQuestions: z.array(shortText).max(5),
  /**
   * Requests outside what the marketplace handles. UI routes medicine to the
   * private partner flow; blood donation and transport are out of scope.
   */
  outOfScope: z
    .array(
      z.object({
        kind: z.enum(['medicine', 'blood_donation', 'transport_or_delivery', 'other']),
        note: shortText,
      }),
    )
    .max(5),
});
export type NeedsExtraction = z.infer<typeof NeedsExtractionSchema>;

export const ExtractNeedsResponseSchema = z.object({
  extraction: NeedsExtractionSchema,
  model: z.string(),
  /** Always true: the user must review before anything is saved or shared. */
  requiresUserReview: z.literal(true),
});
export type ExtractNeedsResponse = z.infer<typeof ExtractNeedsResponseSchema>;

// ===================================== 2. Photo-assisted listing draft (contract)
/** POST /api/v1/ai/listing-draft — multipart image or an uploaded Storage path. */
export const ListingDraftBodySchema = z.strictObject({
  /** Cloud Storage path of an image the caller uploaded under uploads/{userId}/. */
  imagePath: z.string().regex(/^uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/),
  mimeType: z.enum(AI_LIMITS.imageMimeTypes),
  hint: z.string().trim().max(AI_LIMITS.listingHintMaxChars).optional(),
});

/** A suggestion only. The owner edits and publishes; AI never publishes. */
export const ListingDraftSchema = z.object({
  title: shortText.nullable(),
  category: ItemCategorySchema.nullable(),
  suggestedMode: ListingModeSchema.nullable(),
  condition: ItemConditionSchema.nullable(),
  description: z.string().max(1000).nullable(),
  /** Visible facts only, e.g. colour, material. Never inferred brand/specs. */
  observedAttributes: z.array(z.object({ name: z.string().max(50), value: z.string().max(100) })).max(10),
  /** Things the owner must confirm (dimensions, working status, expiry...). */
  needsConfirmation: z.array(shortText).max(10),
  /** e.g. medicine detected → listing blocked and user directed to partner flow. */
  safetyFlags: z.array(z.enum(['medicine', 'weapon', 'hazardous', 'personal_data_visible', 'other'])).max(5),
});
export type ListingDraft = z.infer<typeof ListingDraftSchema>;

// ===================================== 3. Grounded matching explanations (contract)
/** Candidates are selected by the server (geo search + eligibility), never by AI. */
export const MatchCandidateSchema = z.object({
  listingId: IdSchema,
  title: z.string().max(100),
  category: ItemCategorySchema,
  mode: ListingModeSchema,
  description: z.string().max(500),
  distanceKm: z.number().nonnegative(),
});
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;

export const MatchExplanationsSchema = z.object({
  matches: z
    .array(
      z.object({
        listingId: z.string().max(128),
        fit: z.enum(['strong', 'partial', 'weak']),
        /** Grounded only in the supplied candidate fields. */
        reason: z.string().trim().min(1).max(300),
        missingInfo: z.array(shortText).max(5),
      }),
    )
    .max(AI_LIMITS.matchCandidatesMax),
});
export type MatchExplanations = z.infer<typeof MatchExplanationsSchema>;

/**
 * Drops any match whose listingId is not among the supplied eligible
 * candidates (hallucinated or injected IDs) and removes duplicates.
 * Ranking/eligibility stays with the server; AI only explains.
 */
export function groundMatchExplanations(
  output: MatchExplanations,
  eligibleCandidateIds: ReadonlyArray<string>,
): { matches: MatchExplanations['matches']; rejectedIds: string[] } {
  const eligible = new Set(eligibleCandidateIds);
  const seen = new Set<string>();
  const matches: MatchExplanations['matches'] = [];
  const rejectedIds: string[] = [];
  for (const m of output.matches) {
    if (!eligible.has(m.listingId)) {
      rejectedIds.push(m.listingId);
      continue;
    }
    if (seen.has(m.listingId)) continue;
    seen.add(m.listingId);
    matches.push(m);
  }
  return { matches, rejectedIds };
}
