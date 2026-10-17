import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common.js';
import { MedicineAssistanceStatusSchema } from '../domain/machines.js';

// --------------------------------------------------------- Conversations
/**
 * One private conversation per donation request or loan. Participants are
 * fixed at creation from the request record (owner + requester, or the
 * point's volunteers for community stock). Never accepted from the client.
 */
export const ConversationSchema = z.object({
  id: IdSchema,
  subject: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('donation_request'), requestId: IdSchema }),
    z.object({ kind: z.literal('loan'), loanId: IdSchema }),
  ]),
  participantIds: z.array(z.string()).min(2).max(10),
  lastMessageAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  /** Read-only once the request/loan reaches a terminal state + 30 days. */
  closed: z.boolean(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  senderId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: IsoDateTimeSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const SendMessageBodySchema = z.strictObject({
  body: z.string().trim().min(1).max(2000),
});

// --------------------------------------------------------- Notifications
export const NotificationTypeSchema = z.enum([
  'request_received',
  'request_approved',
  'request_rejected',
  'request_cancelled',
  'request_expiring',
  'loan_received',
  'loan_approved',
  'loan_due_soon',
  'loan_overdue',
  'deposit_reviewed',
  'message_received',
  'medicine_case_updated',
]);

/** In-app inbox entry. Bodies must not contain medical details or exact addresses. */
export const NotificationSchema = z.object({
  id: IdSchema,
  userId: z.string(),
  type: NotificationTypeSchema,
  title: z.string().max(120),
  body: z.string().max(300),
  /** In-app path, e.g. /requests/abc. */
  link: z.string().startsWith('/').max(200).nullable(),
  readAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;

/** POST /api/v1/notifications/push-tokens — explicit user opt-in only. */
export const RegisterPushTokenBodySchema = z.strictObject({
  token: z.string().min(20).max(4096),
  platform: z.literal('web'),
});

// ----------------------------------------------- Medicine assistance (private)
/**
 * Private case for verified pharmacy/health-service partners. There are no
 * public medicine listings. The app gives no medical advice or dosage
 * guidance, and AI never reviews, approves or triages these cases.
 */
export const MedicineAssistanceCaseSchema = z.object({
  id: IdSchema,
  requesterId: z.string(),
  status: MedicineAssistanceStatusSchema,
  /** Assigned verified partner organisation (PlatformRole medicine_partner). */
  partnerOrgId: IdSchema.nullable(),
  /** Private free text: never logged, never sent to AI, visible only to requester + assigned partner. */
  summary: z.string().max(1000),
  hasPrescription: z.boolean().nullable(),
  preferredContact: z.enum(['in_app', 'phone']),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type MedicineAssistanceCase = z.infer<typeof MedicineAssistanceCaseSchema>;

export const CreateMedicineAssistanceBodySchema = z.strictObject({
  summary: z.string().trim().min(10).max(1000),
  hasPrescription: z.boolean().nullable(),
  preferredContact: z.enum(['in_app', 'phone']),
  /** Must be explicitly true: user consents to sharing with a verified partner. */
  consentToShareWithPartner: z.literal(true),
});
