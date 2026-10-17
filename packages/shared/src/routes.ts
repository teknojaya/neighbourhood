/**
 * Canonical API paths, shared by the backend router and the frontend client.
 * Status column mirrors docs/api-contracts.md.
 */
export const API_PREFIX = '/api/v1';

export const ApiRoutes = {
  health: '/healthz',
  /** Public (no token): sign-in support endpoints. */
  authMethods: `${API_PREFIX}/auth/methods`,
  authEmailOtpRequest: `${API_PREFIX}/auth/email-otp/request`,
  authEmailOtpVerify: `${API_PREFIX}/auth/email-otp/verify`,
  me: `${API_PREFIX}/me`,
  meProfile: `${API_PREFIX}/me/profile`,
  aiStatus: `${API_PREFIX}/ai/status`,
  aiExtractNeeds: `${API_PREFIX}/ai/needs/extract`,
  aiListingDraft: `${API_PREFIX}/ai/listing-draft`,
  aiMatchExplanations: `${API_PREFIX}/ai/match-explanations`,
  listings: `${API_PREFIX}/listings`,
  communities: `${API_PREFIX}/communities`,
  requests: `${API_PREFIX}/requests`,
  loans: `${API_PREFIX}/loans`,
  needs: `${API_PREFIX}/needs`,
  conversations: `${API_PREFIX}/conversations`,
  notifications: `${API_PREFIX}/notifications`,
  medicineAssistance: `${API_PREFIX}/medicine-assistance`,
} as const;
