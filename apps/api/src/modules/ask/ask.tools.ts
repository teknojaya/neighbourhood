import { z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';
import {
  ASK_LIMITS, AskActionPayloadSchema, AskListingDraftDataSchema, AskListingDraftSchema,
  CreateDonationRequestBodySchema, DonationRequestTransitionBodySchema, NeedsExtractionSchema,
  type AskActionPayload, type AskPart, type ListingPublic,
} from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import type { NeedsService } from '../needs/needs.service.js';
import type { RequestsService } from '../requests/requests.service.js';
import type { ConversationsService } from '../conversations/conversations.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { actionDto } from './ask.dto.js';

export interface AskServices {
  needs: NeedsService; requests: RequestsService; conversations: ConversationsService; notifications: NotificationsService;
  /** Engineer 1 can connect this when authorized listing detail is implemented. */
  listings?: { get(userId: string, id: string): Promise<ListingPublic> };
}
export interface ToolContext { userId: string; sessionId: string; runId: string; attemptId: string; signal: AbortSignal }
interface ToolResult { result: unknown; parts: AskPart[] }
interface RegisteredTool { declaration: FunctionDeclaration; execute(args: unknown, ctx: ToolContext): Promise<ToolResult> }
const paging = z.strictObject({ cursor: z.string().max(500).optional() });

export class AskTools {
  private readonly tools = new Map<string, RegisteredTool>();
  constructor(private readonly db: Db, private readonly services: AskServices) {
    this.add('list_saved_needs', 'List the caller\'s private saved needs. Does not change them.', paging, async (args, ctx) => {
      const page = await services.needs.list(ctx.userId, { ...args, limit: 10 });
      return { result: page, parts: [{ kind: 'saved_needs', items: page.items }] };
    });
    this.add('list_requests', 'Read incoming or outgoing item requests and their server-allowed actions.', paging.extend({ direction: z.enum(['incoming', 'outgoing']) }), async (args, ctx) => {
      const page = await services.requests.list(ctx.userId, args.direction, { ...args, limit: 10 });
      return { result: page, parts: [{ kind: 'requests', items: page.items }] };
    });
    this.add('get_request', 'Read one request the caller may access.', z.strictObject({ requestId: z.uuid() }), async (args, ctx) => {
      const item = await services.requests.get(ctx.userId, args.requestId);
      return { result: item, parts: [{ kind: 'requests', items: [item] }] };
    });
    this.add('list_conversations', 'List the caller\'s private neighbour conversations.', paging, async (args, ctx) => {
      const page = await services.conversations.list(ctx.userId, { ...args, limit: 10 });
      return { result: page, parts: [{ kind: 'conversations', items: page.items }] };
    });
    this.add('read_messages', 'Read messages only in a conversation the caller participates in. Does not mark unread messages read.', paging.extend({ conversationId: z.uuid() }), async (args, ctx) => {
      const page = await services.conversations.messages(ctx.userId, args.conversationId, { ...args, limit: 10 });
      return { result: page, parts: [{ kind: 'messages', items: page.items }] };
    });
    this.add('list_notifications', 'Read the caller\'s inbox updates.', paging, async (args, ctx) => {
      const page = await services.notifications.list(ctx.userId, { ...args, limit: 10 });
      return { result: page, parts: [{ kind: 'notifications', items: page.items }] };
    });
    this.add('prepare_save_need', 'Prepare an editable review card to save a structured need. This does not save the need.', z.strictObject({ extraction: NeedsExtractionSchema }), async (args, ctx) => {
      if (!args.extraction.items.length) throw new HttpError('VALIDATION_FAILED', 'A need must contain at least one item');
      return this.propose(ctx, { kind: 'save_need', ...args }, args.extraction.items.map((i) => i.name).join(', ').slice(0, 300));
    });
    if (services.listings) this.add('prepare_request', 'Prepare a donation request for a known listing UUID. Submission and stock eligibility are checked when the user confirms.', CreateDonationRequestBodySchema, async (body, ctx) => {
      if (!z.uuid().safeParse(body.listingId).success) throw new HttpError('VALIDATION_FAILED', 'Invalid listing');
      const listing = await services.listings!.get(ctx.userId, body.listingId);
      if (listing.status !== 'active' || listing.mode !== 'donate' || listing.ownerId === ctx.userId) throw new HttpError('NOT_FOUND', 'Listing unavailable');
      return this.propose(ctx, { kind: 'request_item', body }, listing.title);
    });
    this.add('prepare_request_transition', 'Prepare a request approval, rejection, cancellation or handover review card. Use only a server-allowed action.', z.strictObject({ requestId: z.uuid(), body: DonationRequestTransitionBodySchema }), async (args, ctx) => {
      const req = await services.requests.get(ctx.userId, args.requestId);
      if (!req.allowedActions?.includes(args.body.to)) throw new HttpError('FORBIDDEN', 'This action is unavailable');
      return this.propose(ctx, { kind: 'transition_request', ...args }, `${req.listingTitle ?? 'Item request'} × ${req.quantity}: ${args.body.to}`);
    });
    this.add('prepare_message', 'Prepare a message review card showing exact text and the authorized conversation. Does not send.', z.strictObject({ conversationId: z.uuid(), body: z.string().trim().min(1).max(2000) }), async (args, ctx) => {
      const conversation = await services.conversations.get(ctx.userId, args.conversationId);
      if (conversation.closed) throw new HttpError('CONFLICT', 'This conversation is closed');
      return this.propose(ctx, { kind: 'send_message', ...args }, conversation.listingTitle ?? 'Neighbour conversation');
    });
    this.add('draft_listing', 'Create or update the current private listing draft. Supply only changed fields. Null means unknown. It cannot publish.', AskListingDraftDataSchema.partial(), async (args, ctx) => {
      const previous = await db.askDraft.findUnique({ where: { sessionId_kind: { sessionId: ctx.sessionId, kind: 'listing' } } });
      const data = AskListingDraftDataSchema.parse({ title: null, category: null, mode: null, condition: null, quantity: null, description: null, ...(previous?.data as object ?? {}), ...args });
      const row = await db.askDraft.upsert({ where: { sessionId_kind: { sessionId: ctx.sessionId, kind: 'listing' } }, create: { sessionId: ctx.sessionId, kind: 'listing', data }, update: { data } });
      const draft = AskListingDraftSchema.parse({ ...row, updatedAt: row.updatedAt.toISOString() });
      return { result: { draft, publicationAvailable: false }, parts: [{ kind: 'listing_draft', draft }] };
    });
  }

  declarations() { return [...this.tools.values()].map((t) => t.declaration); }
  async execute(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
    ctx.signal.throwIfAborted();
    const tool = this.tools.get(name);
    if (!tool) throw new HttpError('BAD_REQUEST', 'Unknown assistant tool');
    const run = await this.db.askRun.findFirst({ where: { id: ctx.runId, attemptId: ctx.attemptId, status: 'running', session: { userId: ctx.userId, deletedAt: null } } });
    if (!run) throw new HttpError('CONFLICT', 'This assistant turn is no longer active');
    return tool.execute(args, ctx);
  }

  private add<T extends z.ZodType>(name: string, description: string, schema: T, handler: (args: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>) {
    const json = z.toJSONSchema(schema, { target: 'draft-7' });
    delete json.$schema;
    this.tools.set(name, {
      declaration: { name, description, parametersJsonSchema: json },
      execute: (args, ctx) => {
        const parsed = schema.safeParse(args);
        if (!parsed.success) throw new HttpError('VALIDATION_FAILED', 'Assistant tool arguments are invalid');
        return handler(parsed.data, ctx);
      },
    });
  }

  private async propose(ctx: ToolContext, payload: AskActionPayload, summary: string): Promise<ToolResult> {
    const parsed = AskActionPayloadSchema.parse(payload);
    // Supersede only a draft for the same target, preserving independent actions.
    const target = payload.kind === 'transition_request' ? { path: ['requestId'], equals: payload.requestId }
      : payload.kind === 'send_message' ? { path: ['conversationId'], equals: payload.conversationId }
      : payload.kind === 'request_item' ? { path: ['body', 'listingId'], equals: payload.body.listingId } : null;
    await this.db.askAction.updateMany({ where: { sessionId: ctx.sessionId, status: 'pending', AND: [
      { payload: { path: ['kind'], equals: payload.kind } }, ...(target ? [{ payload: target }] : []),
    ] }, data: { status: 'cancelled' } });
    const row = await this.db.askAction.create({ data: { sessionId: ctx.sessionId, runId: ctx.runId, payload: parsed, summary, expiresAt: new Date(Date.now() + ASK_LIMITS.proposalMs) } });
    const action = actionDto(row);
    return { result: { action, requiresConfirmation: true, committed: false }, parts: [{ kind: 'action', action }] };
  }
}
