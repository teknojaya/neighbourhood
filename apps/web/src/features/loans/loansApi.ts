import {
  LoanSchema,
  type LoanStatus,
  type CreateLoanBody,
} from '@neighbourhood/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api, isAbortError } from '../../lib/api';

/**
 * Extended loan schema based on canonical shared LoanSchema,
 * allowing optional UI enhancements like photo and display names.
 */
export const LoanSummarySchema = LoanSchema.extend({
  borrowerName: z.string().optional(),
  ownerName: z.string().optional(),
  listingCategory: z.string().optional(),
  listingPhoto: z.string().nullable().optional(),
  message: z.string().optional(),
});
export type LoanSummary = z.infer<typeof LoanSummarySchema>;

export const BookedDateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  status: z.custom<LoanStatus>().optional().default('approved'),
  checkedOut: z.boolean().optional().default(false),
});
export type BookedDateRange = z.infer<typeof BookedDateRangeSchema>;

const AvailabilityResponseSchema = z.object({
  items: z.array(BookedDateRangeSchema).optional(),
  booked: z.array(BookedDateRangeSchema).optional(),
});

const LoansListResponseSchema = z.object({
  items: z.array(LoanSummarySchema),
  total: z.number().optional(),
  nextCursor: z.string().nullable().optional(),
});

/**
 * Creates a new loan request for a lendable item.
 */
export async function createLoan(
  body: CreateLoanBody,
  key: string = crypto.randomUUID(),
): Promise<LoanSummary> {
  try {
    return await api('/api/v1/loans', {
      method: 'POST',
      body,
      idempotencyKey: key,
      schema: LoanSummarySchema,
    });
  } catch (err) {
    console.error('[loansApi] createLoan failed:', err);
    throw err;
  }
}

/**
 * Fetches booked date intervals for a listing to prevent overlapping selection in UI.
 */
export async function fetchBookedDates(listingId: string, signal?: AbortSignal): Promise<BookedDateRange[]> {
  try {
    const res = await api(`/api/v1/listings/${listingId}/availability`, {
      method: 'GET',
      schema: AvailabilityResponseSchema,
      signal,
    });
    return res.booked ?? res.items ?? [];
  } catch (err) {
    // Never resolve as "no bookings" on failure: an unknown schedule is not a free one.
    if (!isAbortError(err)) console.error('[loansApi] fetchBookedDates failed:', err);
    throw err;
  }
}

export const bookedDatesQueryKey = (listingId: string) => ['availability', listingId] as const;

/** Booked ranges for a lendable listing. Borrowing stays disabled until this succeeds. */
export function useBookedDates(listingId: string) {
  return useQuery({ queryKey: bookedDatesQueryKey(listingId), queryFn: ({ signal }) => fetchBookedDates(listingId, signal) });
}

/**
 * Fetches incoming loan requests for items owned by the authenticated user.
 */
export async function fetchIncomingLoans(signal?: AbortSignal): Promise<LoanSummary[]> {
  try {
    const res = await api('/api/v1/loans/incoming', {
      method: 'GET',
      schema: LoansListResponseSchema,
      signal,
    });
    return res.items;
  } catch (err) {
    if (!isAbortError(err)) console.error('[loansApi] fetchIncomingLoans failed:', err);
    throw err;
  }
}

/**
 * Fetches outgoing loans / borrowing requests made by the authenticated user.
 */
export async function fetchOutgoingLoans(signal?: AbortSignal): Promise<LoanSummary[]> {
  try {
    const res = await api('/api/v1/loans/outgoing', {
      method: 'GET',
      schema: LoansListResponseSchema,
      signal,
    });
    return res.items;
  } catch (err) {
    if (!isAbortError(err)) console.error('[loansApi] fetchOutgoingLoans failed:', err);
    throw err;
  }
}

/**
 * Transitions loan state (e.g. approve, reject, cancel, check_out, return).
 */
export async function transitionLoan(
  loanId: string,
  to: Exclude<LoanStatus, 'pending'>,
  returnConditionNote?: string,
  key: string = crypto.randomUUID(),
): Promise<LoanSummary> {
  try {
    return await api(`/api/v1/loans/${loanId}/transition`, {
      method: 'POST',
      body: { to, returnConditionNote },
      idempotencyKey: key,
      schema: LoanSummarySchema,
    });
  } catch (err) {
    console.error('[loansApi] transitionLoan failed:', err);
    throw err;
  }
}
