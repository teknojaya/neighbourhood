import { z } from 'zod';
import type { StateMachine } from './state-machine.js';

// ---------------------------------------------------------------- Listing
export const ListingStatusSchema = z.enum(['draft', 'active', 'paused', 'closed']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const listingMachine: StateMachine<ListingStatus> = {
  name: 'listing',
  terminal: ['closed'],
  rules: [
    { from: 'draft', to: 'active', actors: ['owner'] },
    { from: 'draft', to: 'closed', actors: ['owner'] },
    { from: 'active', to: 'paused', actors: ['owner'] },
    { from: 'paused', to: 'active', actors: ['owner'] },
    // Closing with reserved units is rejected by the service (see docs/architecture.md).
    { from: 'active', to: 'closed', actors: ['owner', 'system'] },
    { from: 'paused', to: 'closed', actors: ['owner', 'system'] },
  ],
};

// ------------------------------------------------------- Donation request
export const DonationRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'collected',
  'expired',
]);
export type DonationRequestStatus = z.infer<typeof DonationRequestStatusSchema>;

/**
 * `owner` = listing owner, or for community-point stock, a volunteer of that
 * community acting as owner. `requester` = the user who asked.
 */
export const donationRequestMachine: StateMachine<DonationRequestStatus> = {
  name: 'donationRequest',
  terminal: ['rejected', 'cancelled', 'collected', 'expired'],
  rules: [
    { from: 'pending', to: 'approved', actors: ['owner', 'volunteer'] }, // reserves stock
    { from: 'pending', to: 'rejected', actors: ['owner', 'volunteer'] },
    { from: 'pending', to: 'cancelled', actors: ['requester'] },
    { from: 'pending', to: 'expired', actors: ['system'] },
    { from: 'approved', to: 'cancelled', actors: ['requester', 'owner', 'volunteer'] }, // releases stock
    { from: 'approved', to: 'expired', actors: ['system'] }, // releases stock
    // Confirmed in person by the giver/volunteer; a QR scan alone is never sufficient.
    { from: 'approved', to: 'collected', actors: ['owner', 'volunteer'] },
  ],
};

// ------------------------------------------------------------------ Loan
export const LoanStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'checked_out',
  'returned',
]);
export type LoanStatus = z.infer<typeof LoanStatusSchema>;

/** `requester` = borrower. Overdue is derived (see loans.ts), not a status. */
export const loanMachine: StateMachine<LoanStatus> = {
  name: 'loan',
  terminal: ['rejected', 'cancelled', 'returned'],
  rules: [
    { from: 'pending', to: 'approved', actors: ['owner', 'volunteer'] }, // checks date conflicts
    { from: 'pending', to: 'rejected', actors: ['owner', 'volunteer'] },
    { from: 'pending', to: 'cancelled', actors: ['requester'] },
    { from: 'approved', to: 'cancelled', actors: ['requester', 'owner', 'volunteer'] },
    { from: 'approved', to: 'checked_out', actors: ['owner', 'volunteer'] }, // handover confirmed
    { from: 'checked_out', to: 'returned', actors: ['owner', 'volunteer'] }, // return confirmed by lender
  ],
};

// ----------------------------------------------------- Community deposit
export const DepositStatusSchema = z.enum(['proposed', 'accepted', 'rejected']);
export type DepositStatus = z.infer<typeof DepositStatusSchema>;

/** Stock becomes available only when a volunteer accepts in person. */
export const depositMachine: StateMachine<DepositStatus> = {
  name: 'deposit',
  terminal: ['accepted', 'rejected'],
  rules: [
    { from: 'proposed', to: 'accepted', actors: ['volunteer'] },
    { from: 'proposed', to: 'rejected', actors: ['volunteer'] },
  ],
};

// --------------------------------------------- Medicine assistance (private)
export const MedicineAssistanceStatusSchema = z.enum([
  'submitted',
  'under_review',
  'referred',
  'closed',
  'withdrawn',
]);
export type MedicineAssistanceStatus = z.infer<typeof MedicineAssistanceStatusSchema>;

/**
 * `volunteer` here means a verified medicine partner (PlatformRole
 * `medicine_partner`). Only humans at verified partners move cases; AI never does.
 */
export const medicineAssistanceMachine: StateMachine<MedicineAssistanceStatus> = {
  name: 'medicineAssistance',
  terminal: ['closed', 'withdrawn'],
  rules: [
    { from: 'submitted', to: 'under_review', actors: ['volunteer'] },
    { from: 'submitted', to: 'withdrawn', actors: ['requester'] },
    { from: 'under_review', to: 'referred', actors: ['volunteer'] },
    { from: 'under_review', to: 'closed', actors: ['volunteer'] },
    { from: 'under_review', to: 'withdrawn', actors: ['requester'] },
    { from: 'referred', to: 'closed', actors: ['volunteer'] },
  ],
};
