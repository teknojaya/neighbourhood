import { z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';
import {
  ASK_LIMITS, AskActionPayloadSchema, AskListingDraftDataSchema, AskListingDraftSchema,
  CreateDonationRequestBodySchema, DonationRequestTransitionBodySchema, NeedsExtractionSchema,
  type AskActionPayload, type AskPart, type ListingPublic,
  ItemCategorySchema, ListingModeSchema, RadiusKmSchema, MAX_RADIUS_KM, modelSafe,
} from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import type { NeedsService } from '../needs/needs.service.js';
import type { RequestsService } from '../requests/requests.service.js';
import type { ConversationsService } from '../conversations/conversations.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { actionDto } from './ask.dto.js';
import { ModelMarketplaceActionSchema, authorizeProposal, marketplaceSummary, type MarketplaceServices } from './ask.marketplace.js';
import { PRODUCT_GUIDE } from './product-knowledge.js';

export interface AskServices {
  marketplace?: MarketplaceServices;
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
    this.add('get_product_guide', 'Read authoritative NeighbourHood product knowledge and navigation. Use for what is a community point, how roles work, giving, borrowing, saved needs, map/radius, photos and app help. Static guide; does not search neighbours or change anything.', z.strictObject({ topic: z.enum(['overview', 'roles', 'sharing', 'borrowing', 'points', 'saved_needs', 'location', 'chat', 'navigation', 'all']).default('overview') }), async ({ topic }) => ({ result: topic === 'all' ? PRODUCT_GUIDE : { topic, guide: PRODUCT_GUIDE[topic] }, parts: [] }));
    this.add('my_account', 'Read the caller’s actual baseline account label, platform roles, community memberships/statuses and whether a search location is set. No home coordinates, email or private pickup details. Use before answering about my role or memberships; neighbour is not proof of membership.', z.strictObject({}), async (_args, ctx) => {
      const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { areaLabel: true, preferredLanguage: true, searchRadiusKm: true, homeLat: true, homeLng: true, roles: { select: { role: true } }, memberships: { select: { role: true, status: true, communityId: true, community: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 } } });
      return { result: { accountLabel: 'neighbour', platformRoles: user.roles.map(r => r.role), memberships: user.memberships.map(m => ({ communityId: m.communityId, communityName: m.community.name, role: m.role, status: m.status })), searchLocationSet: user.homeLat !== null && user.homeLng !== null, publicArea: user.areaLabel, preferredLanguage: user.preferredLanguage, searchRadiusKm: user.searchRadiusKm }, parts: [] };
    });
    if (services.marketplace) {
      const market = services.marketplace;
      this.add('list_categories', 'Read supported product categories.', z.strictObject({}), async () => ({ result: { categories: ItemCategorySchema.options }, parts: [] }));
      if (market.matching) this.add('match_saved_need', 'Find real eligible nearby matches for a caller-owned saved need and provide grounded explanations. Requires a saved Profile location.', z.strictObject({ needId: z.uuid() }), async (args, ctx) => { const result = await market.matching!.matches(ctx.userId, args.needId); return { result, parts: [{ kind: 'matches', items: result.items }] }; });
      this.add('search_listings', 'Search real eligible nearby items using the caller’s private saved location. Query keywords should be short item names, not whole sentences. Radius is kilometres.', z.strictObject({ query: z.string().max(100).optional(), category: ItemCategorySchema.optional(), mode: ListingModeSchema.optional(), radiusKm: RadiusKmSchema.optional() }), async (args, ctx) => {
        const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } });
        if (user.homeLat === null || user.homeLng === null) throw new HttpError('VALIDATION_FAILED', 'Set your location in Profile to search nearby');
        const radiusKm = args.radiusKm ?? user.searchRadiusKm;
        const search = { ...args, searcherId: ctx.userId, center: { lat: user.homeLat, lng: user.homeLng }, radiusKm, limit: 10 };
        const items = await market.listings.searchListings(search);
        const broaderRadiusKm = items.length === 0 && radiusKm < MAX_RADIUS_KM ? MAX_RADIUS_KM : null;
        const fartherItems = broaderRadiusKm ? await market.listings.searchListings({ ...search, radiusKm: broaderRadiusKm }) : [];
        const scope = { radiusKm, broaderRadiusKm, query: args.query, category: args.category, mode: args.mode, fartherItems };
        return { result: { items, ...scope, note: 'Items and fartherItems are separate. State the exact radius checked. Empty means no eligible matching listings in that area at this time, never worldwide unavailability. Ask what radius the user wants; do not claim farther items are nearby or reserved.' }, parts: [{ kind: 'listings', items, search: scope }] };
      });
      this.add('get_listing', 'Read one accessible listing by its real UUID. Never returns private pickup details.', z.strictObject({ listingId: z.uuid() }), async (args, ctx) => { const { listing } = await market.listings.getListingDetail(ctx.userId, args.listingId); return { result: { listing }, parts: [{ kind: 'listings', items: [listing] }] }; });
      this.add('list_my_listings', 'Read the caller’s shared items.', z.strictObject({}), async (_args, ctx) => { const items = await market.listings.getMyListings(ctx.userId); return { result: { items }, parts: [{ kind: 'listings', items }] }; });
      this.add('list_loans', 'Read the caller’s incoming or outgoing loans and allowed actions.', z.strictObject({ direction: z.enum(['incoming', 'outgoing']) }), async (args, ctx) => { const page = await market.loans.list(ctx.userId, args.direction, { limit: 10 }); return { result: page, parts: [{ kind: 'loans', items: page.items }] }; });
      this.add('get_loan', 'Read one participant-authorized loan.', z.strictObject({ loanId: z.uuid() }), async (args, ctx) => { const item = await market.loans.get(ctx.userId, args.loanId); return { result: item, parts: [{ kind: 'loans', items: [item] }] }; });
      this.add('loan_availability', 'Read reserved loan date ranges, without borrower identity.', z.strictObject({ listingId: z.uuid() }), async (args, ctx) => ({ result: await market.loans.availability(ctx.userId, args.listingId), parts: [] }));
      this.add('list_communities', 'Browse communities. Discovery is independent of radius.', z.strictObject({}), async () => { const page = await market.communities.list(); return { result: page, parts: [{ kind: 'communities', items: page.items }] }; });
      this.add('get_community', 'Read a community and caller membership. Moderators can use its card to prepare a new point securely.', z.strictObject({ communityId: z.uuid() }), async (args, ctx) => { const result = await market.communities.get(ctx.userId, args.communityId); return { result, parts: [{ kind: 'communities', items: [result.community] }] }; });
      this.add('list_points', 'Read active collection points and consented public addresses.', z.strictObject({ communityId: z.uuid() }), async args => { const page = await market.communities.points(args.communityId); return { result: page, parts: [{ kind: 'points', items: page.items }] }; });
      this.add('point_inventory', 'Read collection point inventory.', z.strictObject({ pointId: z.uuid() }), async args => { const page = await market.communities.inventory(args.pointId); return { result: page, parts: [{ kind: 'inventory', items: page.items }] }; });
      this.add('list_deposits', 'Read caller-owned deposits or volunteer-authorized deposits.', z.strictObject({ pointId: z.uuid() }), async (args, ctx) => { const page = await market.communities.deposits(ctx.userId, args.pointId); return { result: page, parts: [{ kind: 'deposits', items: page.items }] }; });
      this.add('list_members', 'Moderators only: read members pending review and roles.', z.strictObject({ communityId: z.uuid() }), async (args, ctx) => { const page = await market.communities.members(ctx.userId, args.communityId); return { result: page, parts: [{ kind: 'members', items: page.items }] }; });
      this.add('inventory_audit', 'Volunteers only: read stock adjustments.', z.strictObject({ pointId: z.uuid() }), async (args, ctx) => { const page = await market.communities.audit(ctx.userId, args.pointId); return { result: page, parts: [{ kind: 'stock_audit', items: page.items }] }; });
      this.add('prepare_marketplace_action', 'Prepare a review card for the requested operation. Never executes it. Read the real resource first; current permissions and state are rechecked at confirmation. In-person deposit, checkout, return and collection require human confirmation.', ModelMarketplaceActionSchema, async (action, ctx) => this.propose(ctx, { kind: 'marketplace', action: await authorizeProposal(db, market, ctx.userId, action) }, await marketplaceSummary(db, market, ctx.userId, action)));
      this.add('my_preferences', 'Read only area, language and search radius; never coordinates.', z.strictObject({}), async (_args, ctx) => { const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { areaLabel: true, preferredLanguage: true, searchRadiusKm: true } }); return { result: user, parts: [] }; });
    }
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
      return { result: { draft, publicationAvailable: Boolean(services.marketplace) }, parts: [{ kind: 'listing_draft', draft }] };
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
      { payload: { path: ['kind'], equals: payload.kind } }, ...(target ? [{ payload: target }] : payload.kind === 'marketplace' ? [{ payload: { path: ['action', 'operation'], equals: payload.action.operation } }] : []),
    ] }, data: { status: 'cancelled' } });
    const row = await this.db.askAction.create({ data: { sessionId: ctx.sessionId, runId: ctx.runId, payload: parsed, summary, expiresAt: new Date(Date.now() + ASK_LIMITS.proposalMs) } });
    const action = actionDto(row);
    return { result: { action: modelSafe(action), requiresConfirmation: true, committed: false }, parts: [{ kind: 'action', action }] };
  }
}
