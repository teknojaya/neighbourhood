import { z } from 'zod';
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from '../common.js';
import { DonationRequestStatusSchema, LoanStatusSchema } from '../domain/machines.js';

// ------------------------------------------------------- Donation requests
export const DonationRequestSchema = z.object({
  id: IdSchema,
  listingId: IdSchema,
  ownerId: z.string(),
  requesterId: z.string(),
  quantity: z.number().int().min(1),
  message: z.string().max(500),
  status: DonationRequestStatusSchema,
  /** Pickup window agreed at approval; expiry job moves to `expired` after it. */
  pickupBy: IsoDateTimeSchema.nullable(),
  conversationId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type DonationRequest = z.infer<typeof DonationRequestSchema>;

/** POST /api/v1/requests (Idempotency-Key header required). requesterId comes from the token. */
export const CreateDonationRequestBodySchema = z.strictObject({
  listingId: IdSchema,
  quantity: z.number().int().min(1).max(100),
  message: z.string().trim().max(500).default(''),
});

/** POST /api/v1/requests/:id/transition (Idempotency-Key header required). */
export const DonationRequestTransitionBodySchema = z.strictObject({
  to: DonationRequestStatusSchema.exclude(['pending', 'expired']),
  pickupBy: IsoDateTimeSchema.optional(),
  note: z.string().trim().max(300).optional(),
});

// ------------------------------------------------------------------- Loans
export const LoanSchema = z.object({
  id: IdSchema,
  listingId: IdSchema,
  ownerId: z.string(),
  borrowerId: z.string(),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  status: LoanStatusSchema,
  /** Derived at read time from endDate; never stored as a status. */
  overdue: z.boolean(),
  checkedOutAt: IsoDateTimeSchema.nullable(),
  returnedAt: IsoDateTimeSchema.nullable(),
  /** Lender's condition notes at return confirmation. */
  returnConditionNote: z.string().max(500).nullable(),
  conversationId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Loan = z.infer<typeof LoanSchema>;

export const CreateLoanBodySchema = z.strictObject({
  listingId: IdSchema,
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  message: z.string().trim().max(500).default(''),
});

export const LoanTransitionBodySchema = z.strictObject({
  to: LoanStatusSchema.exclude(['pending']),
  returnConditionNote: z.string().trim().max(500).optional(),
});
