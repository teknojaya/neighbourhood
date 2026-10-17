import { describe, expect, it } from 'vitest';
import {
  depositMachine,
  donationRequestMachine,
  listingMachine,
  loanMachine,
} from './machines.js';
import { allowedTargets, assertTransition, canTransition, DomainError } from './state-machine.js';

describe('listing transitions', () => {
  it('lets owners publish, pause, resume and close', () => {
    expect(canTransition(listingMachine, 'draft', 'active', 'owner')).toBe(true);
    expect(canTransition(listingMachine, 'active', 'paused', 'owner')).toBe(true);
    expect(canTransition(listingMachine, 'paused', 'active', 'owner')).toBe(true);
    expect(canTransition(listingMachine, 'active', 'closed', 'owner')).toBe(true);
  });
  it('treats closed as terminal', () => {
    expect(allowedTargets(listingMachine, 'closed', 'owner')).toEqual([]);
    expect(() => assertTransition(listingMachine, 'closed', 'active', 'owner')).toThrow(/cannot move/);
  });
  it('does not let non-owners change listing status', () => {
    expect(canTransition(listingMachine, 'draft', 'active', 'requester')).toBe(false);
  });
});

describe('donation request transitions', () => {
  it('only owners/volunteers approve; requesters cannot self-approve', () => {
    expect(canTransition(donationRequestMachine, 'pending', 'approved', 'owner')).toBe(true);
    expect(canTransition(donationRequestMachine, 'pending', 'approved', 'volunteer')).toBe(true);
    expect(() => assertTransition(donationRequestMachine, 'pending', 'approved', 'requester')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }) as unknown as Error,
    );
  });
  it('only the system expires requests', () => {
    expect(canTransition(donationRequestMachine, 'pending', 'expired', 'system')).toBe(true);
    expect(canTransition(donationRequestMachine, 'approved', 'expired', 'owner')).toBe(false);
  });
  it('cannot collect without approval', () => {
    expect(() => assertTransition(donationRequestMachine, 'pending', 'collected', 'owner')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }) as unknown as Error,
    );
  });
  it('requester cannot mark an item collected', () => {
    expect(canTransition(donationRequestMachine, 'approved', 'collected', 'requester')).toBe(false);
  });
  it('terminal states have no exits', () => {
    for (const s of donationRequestMachine.terminal) {
      for (const actor of ['owner', 'requester', 'volunteer', 'system'] as const) {
        expect(allowedTargets(donationRequestMachine, s, actor)).toEqual([]);
      }
    }
  });
});

describe('loan transitions', () => {
  it('follows pending → approved → checked_out → returned', () => {
    expect(() => assertTransition(loanMachine, 'pending', 'approved', 'owner')).not.toThrow();
    expect(() => assertTransition(loanMachine, 'approved', 'checked_out', 'owner')).not.toThrow();
    expect(() => assertTransition(loanMachine, 'checked_out', 'returned', 'owner')).not.toThrow();
  });
  it('borrower cannot confirm their own return', () => {
    expect(canTransition(loanMachine, 'checked_out', 'returned', 'requester')).toBe(false);
  });
  it('cannot cancel once checked out', () => {
    expect(canTransition(loanMachine, 'checked_out', 'cancelled', 'requester')).toBe(false);
    expect(canTransition(loanMachine, 'checked_out', 'cancelled', 'owner')).toBe(false);
  });
  it('has no overdue status', () => {
    expect(loanMachine.rules.some((r) => (r.to as string) === 'overdue')).toBe(false);
  });
});

describe('deposit transitions', () => {
  it('only volunteers accept deposits', () => {
    expect(canTransition(depositMachine, 'proposed', 'accepted', 'volunteer')).toBe(true);
    expect(canTransition(depositMachine, 'proposed', 'accepted', 'owner')).toBe(false);
    expect(canTransition(depositMachine, 'proposed', 'accepted', 'system')).toBe(false);
  });
  it('raises DomainError instances', () => {
    try {
      assertTransition(depositMachine, 'accepted', 'rejected', 'volunteer');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
    }
  });
});
