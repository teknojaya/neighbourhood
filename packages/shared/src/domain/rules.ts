import { DomainError } from './state-machine.js';
import type { LoanStatus } from './machines.js';

/** Users can never request or borrow their own listing. */
export function assertNotSelfRequest(ownerId: string, requesterId: string): void {
  if (ownerId === requesterId) throw new DomainError('SELF_REQUEST', 'You cannot request your own item');
}

export interface DateRange {
  /** Inclusive start, ISO date (YYYY-MM-DD). */
  startDate: string;
  /** Inclusive end, ISO date (YYYY-MM-DD). */
  endDate: string;
}

const toDay = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) throw new DomainError('BAD_REQUEST', `Invalid date: ${iso}`);
  return t;
};

export function assertValidRange(r: DateRange, maxDays = 90): void {
  const start = toDay(r.startDate);
  const end = toDay(r.endDate);
  if (end < start) throw new DomainError('BAD_REQUEST', 'End date is before start date');
  if ((end - start) / 86_400_000 + 1 > maxDays) {
    throw new DomainError('BAD_REQUEST', `Loan cannot exceed ${maxDays} days`);
  }
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return toDay(a.startDate) <= toDay(b.endDate) && toDay(b.startDate) <= toDay(a.endDate);
}

/** Loan statuses that block the single unit for their date range. */
export const BLOCKING_LOAN_STATUSES: readonly LoanStatus[] = ['approved', 'checked_out'];

/**
 * Single-unit lending: an approval must not overlap any approved or
 * checked-out loan for the same listing. Pending loans do not block.
 * A checked-out loan blocks until it is returned, even past its end date.
 */
export function assertNoConflictingLoan(
  candidate: DateRange & { id: string },
  existing: ReadonlyArray<DateRange & { id: string; status: LoanStatus }>,
  today: string,
): void {
  for (const loan of existing) {
    if (loan.id === candidate.id || !BLOCKING_LOAN_STATUSES.includes(loan.status)) continue;
    const effective =
      loan.status === 'checked_out' && toDay(today) > toDay(loan.endDate) ? { ...loan, endDate: today } : loan;
    if (rangesOverlap(candidate, effective)) {
      throw new DomainError('CONFLICT', 'Item is already lent for these dates');
    }
  }
}

/** Overdue is derived: checked out and past the inclusive end date. */
export function isLoanOverdue(loan: { status: LoanStatus; endDate: string }, now: Date): boolean {
  if (loan.status !== 'checked_out') return false;
  const endOfDueDay = toDay(loan.endDate) + 86_400_000;
  return now.getTime() >= endOfDueDay;
}
