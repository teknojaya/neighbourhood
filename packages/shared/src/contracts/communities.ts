import { z } from 'zod';
import { ApproximateLocationSchema, IdSchema, IsoDateTimeSchema } from '../common.js';
import { CommunityRoleSchema, ItemCategorySchema } from '../enums.js';
import { DepositStatusSchema } from '../domain/machines.js';

/**
 * A community is a social group with moderators. It is NOT a radius:
 * nearby search is geographic and independent of membership.
 */
export const CommunitySchema = z.object({
  id: IdSchema,
  name: z.string().max(80),
  description: z.string().max(1000),
  areaLabel: z.string().max(120),
  joinPolicy: z.enum(['open', 'approval_required']),
  memberCount: z.number().int().min(0),
  createdAt: IsoDateTimeSchema,
});
export type Community = z.infer<typeof CommunitySchema>;

/** `community_memberships` row — written only by the server. */
export const MembershipSchema = z.object({
  communityId: IdSchema,
  userId: IdSchema,
  role: CommunityRoleSchema,
  status: z.enum(['pending', 'active', 'removed']),
  /** User id of the moderator/staff who granted a role above `member`. */
  grantedBy: z.string().nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type Membership = z.infer<typeof MembershipSchema>;

/** POST /api/v1/communities/:id/members/:userId/role — moderators only. */
export const SetMemberRoleBodySchema = z.strictObject({ role: CommunityRoleSchema });

export const CommunityPointSchema = z.object({
  id: IdSchema,
  communityId: IdSchema,
  name: z.string().max(80),
  kind: z.enum(['box', 'pantry', 'shelf', 'partner_desk']),
  partnerName: z.string().max(120),
  /** Present only when the partner consented to a public address. */
  publicAddress: z.string().max(300).nullable(),
  location: ApproximateLocationSchema,
  openingHours: z.string().max(300).nullable(),
  /**
   * Opaque random identifier printed as a QR code at the point. Scanning it
   * only *identifies* the point; deposits/collections still require an
   * authenticated volunteer confirmation.
   */
  qrId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  active: z.boolean(),
});
export type CommunityPoint = z.infer<typeof CommunityPointSchema>;

/** Private columns of `community_points` — partner consent + exact address. */
export const CommunityPointPrivateSchema = z.object({
  pointId: IdSchema,
  exactAddress: z.string().max(300),
  partnerConsent: z.object({
    publicAddress: z.boolean(),
    consentedBy: z.string().max(120),
    consentedAt: IsoDateTimeSchema,
  }),
});

export const PointInventoryItemSchema = z.object({
  id: IdSchema,
  pointId: IdSchema,
  category: ItemCategorySchema,
  title: z.string().max(100),
  available: z.number().int().min(0),
  reserved: z.number().int().min(0),
  bestBefore: z.iso.date().nullable(),
  updatedAt: IsoDateTimeSchema,
});

export const DepositSchema = z.object({
  id: IdSchema,
  pointId: IdSchema,
  donorId: z.string(),
  items: z
    .array(
      z.object({
        category: ItemCategorySchema,
        title: z.string().max(100),
        quantity: z.number().int().min(1).max(500),
        bestBefore: z.iso.date().nullable(),
      }),
    )
    .min(1)
    .max(20),
  status: DepositStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewNote: z.string().max(300).nullable(),
  createdAt: IsoDateTimeSchema,
  reviewedAt: IsoDateTimeSchema.nullable(),
});
export type Deposit = z.infer<typeof DepositSchema>;

export const ProposeDepositBodySchema = DepositSchema.pick({ pointId: true, items: true }).strict();

/** Volunteer-only; accepted counts may be lower than proposed. */
export const ReviewDepositBodySchema = z.strictObject({
  to: z.enum(['accepted', 'rejected']),
  acceptedQuantities: z.array(z.number().int().min(0)).optional(),
  reviewNote: z.string().trim().max(300).optional(),
});

/** Append-only audit of every inventory change at a point. */
export const StockAdjustmentSchema = z.object({
  id: IdSchema,
  pointId: IdSchema,
  itemId: IdSchema,
  delta: z.number().int(),
  reason: z.enum(['deposit_accepted', 'collected', 'damaged', 'expired', 'correction']),
  actorId: z.string(),
  depositId: IdSchema.nullable(),
  requestId: IdSchema.nullable(),
  note: z.string().max(300).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type StockAdjustment = z.infer<typeof StockAdjustmentSchema>;
