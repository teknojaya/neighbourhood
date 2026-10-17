import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 1 (lending) with Engineer 2 (handover UI).
 * Contracts: packages/shared/src/contracts/requests-loans.ts. Transitions:
 * loanMachine; conflicts: assertNoConflictingLoan; overdue: isLoanOverdue.
 */
export function loansRouter(): Router {
  return plannedRouter([
    ['post', '/loans', 'Create loan request'],
    ['get', '/loans/incoming', 'Incoming loan requests'],
    ['get', '/loans/outgoing', 'My loans'],
    ['get', '/loans/:loanId', 'Loan detail'],
    ['post', '/loans/:loanId/transition', 'Loan status change'],
  ]);
}
