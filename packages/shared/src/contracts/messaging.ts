import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, pageOf } from '../common.js';

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
  unreadCount: z.number().int().nonnegative().optional(),
  listingTitle: z.string().max(100).optional(),
  listingId: z.uuid().optional(),
  listingPhotoUrl: z.string().optional(),
  imagesAvailable: z.boolean().optional(),
  pendingAttachments: z.array(z.object({ id: z.uuid(), name: z.string(), mimeType: z.enum(['image/jpeg','image/png','image/webp']), size: z.number().int().positive() })).max(2).optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;
export const ConversationPageSchema = pageOf(ConversationSchema);

export const MessageAttachmentSchema = z.object({ id: z.uuid(), name: z.string(), mimeType: z.enum(['image/jpeg','image/png','image/webp']), size: z.number().int().positive().max(4194304) });
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;
export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  senderId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: IsoDateTimeSchema,
  attachments: z.array(MessageAttachmentSchema).max(2).default([]),
});
export type Message = z.infer<typeof MessageSchema>;
export const MessagePageSchema = pageOf(MessageSchema);

export const SendMessageBodySchema = z.strictObject({
  body: z.string().trim().max(2000),
  attachmentIds: z.array(z.uuid()).max(2).default([]),
}).refine(value => value.body.length > 0 || value.attachmentIds.length > 0, { message: 'Add a message or photo' });
/** Read only through a message actually displayed by the client. */
export const MarkConversationReadBodySchema = z.strictObject({ throughMessageId: z.uuid() });

// --------------------------------------------------------- Notifications
export const NotificationTypeSchema = z.enum([
  'request_received',
  'request_approved',
  'request_rejected',
  'request_cancelled',
  'request_collected',
  'request_expiring',
  'request_expired',
  'loan_received',
  'loan_approved',
  'loan_due_soon',
  'loan_overdue',
  'loan_update',
  'deposit_reviewed',
  'deposit_update',
  'message_received',
  'product_category_updated',
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
export const NotificationPageSchema = pageOf(NotificationSchema);
/** Authorized global counts, independent of inbox/conversation pagination. */
export const UnreadSummarySchema = z.object({ messages: z.number().int().nonnegative(), updates: z.number().int().nonnegative() });

/** POST /api/v1/notifications/push-tokens — explicit user opt-in only. */
export const RegisterPushTokenBodySchema = z.strictObject({
  token: z.string().min(20).max(4096),
  platform: z.literal('web'),
});
