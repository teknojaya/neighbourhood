import type { Router } from 'express';
import { plannedRouter } from '../planned.js';

/**
 * Owner: Engineer 2. Private, partner-mediated workflow.
 * Contracts: packages/shared/src/contracts/messaging.ts (MedicineAssistance*).
 * - No public medicine listings; never sent to AI; never logged.
 * - Partner endpoints must use requirePlatformRole(access, 'medicine_partner')
 *   AND check the case's partnerOrgId.
 */
export function medicineAssistanceRouter(): Router {
  return plannedRouter([
    ['post', '/medicine-assistance', 'Submit medicine assistance case'],
    ['get', '/medicine-assistance/mine', 'My medicine assistance cases'],
    ['post', '/medicine-assistance/:caseId/withdraw', 'Withdraw case'],
    ['get', '/partner/medicine-assistance', 'Partner case queue'],
    ['post', '/partner/medicine-assistance/:caseId/transition', 'Partner case update'],
  ]);
}
