import { describe, expect, it } from 'vitest';
import { assertNoConflictingLoan, assertNotSelfRequest, assertValidRange, isLoanOverdue, rangesOverlap } from './rules.js';

describe('self-request prevention', () => {
  it('blocks owners requesting their own listing', () => {
    expect(() => assertNotSelfRequest('u1', 'u1')).toThrowError(expect.objectContaining({ code: 'SELF_REQUEST' }) as unknown as Error);
    expect(() => assertNotSelfRequest('u1', 'u2')).not.toThrow();
  });
});

describe('loan date rules', () => {
  it('detects inclusive overlaps', () => {
    expect(rangesOverlap({ startDate: '2026-11-01', endDate: '2026-11-05' }, { startDate: '2026-11-05', endDate: '2026-11-07' })).toBe(true);
    expect(rangesOverlap({ startDate: '2026-11-01', endDate: '2026-11-04' }, { startDate: '2026-11-05', endDate: '2026-11-07' })).toBe(false);
  });
  it('validates range order and maximum length', () => {
    expect(() => assertValidRange({ startDate: '2026-11-05', endDate: '2026-11-01' })).toThrow();
    expect(() => assertValidRange({ startDate: '2026-11-01', endDate: '2026-11-30' }, 14)).toThrow(/exceed/);
  });

  const candidate = { id: 'new', startDate: '2026-11-10', endDate: '2026-11-12' };
  it('blocks overlap with approved or checked-out loans only', () => {
    expect(() =>
      assertNoConflictingLoan(candidate, [{ id: 'a', status: 'approved', startDate: '2026-11-11', endDate: '2026-11-15' }], '2026-11-01'),
    ).toThrow(/already lent/);
    expect(() =>
      assertNoConflictingLoan(candidate, [{ id: 'p', status: 'pending', startDate: '2026-11-11', endDate: '2026-11-15' }], '2026-11-01'),
    ).not.toThrow();
    expect(() =>
      assertNoConflictingLoan(candidate, [{ id: 'r', status: 'returned', startDate: '2026-11-11', endDate: '2026-11-15' }], '2026-11-01'),
    ).not.toThrow();
  });
  it('treats an overdue checked-out loan as blocking until returned', () => {
    const overdue = { id: 'o', status: 'checked_out' as const, startDate: '2026-11-01', endDate: '2026-11-03' };
    expect(() => assertNoConflictingLoan({ id: 'n', startDate: '2026-11-08', endDate: '2026-11-09' }, [overdue], '2026-11-08')).toThrow();
    expect(() => assertNoConflictingLoan({ id: 'n', startDate: '2026-12-01', endDate: '2026-12-02' }, [overdue], '2026-11-08')).toThrow();
  });
  it('derives overdue from the due date', () => {
    const loan = { status: 'checked_out' as const, endDate: '2026-11-03' };
    expect(isLoanOverdue(loan, new Date('2026-11-03T23:00:00Z'))).toBe(false);
    expect(isLoanOverdue(loan, new Date('2026-11-04T00:00:00Z'))).toBe(true);
    expect(isLoanOverdue({ ...loan, status: 'returned' }, new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });
});
