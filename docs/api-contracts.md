# API contracts

> **Updated 2026-10-17: architecture change.** PostgreSQL (Prisma 7 migrations; Cloud SQL in production) has replaced Firestore.
> Sign-in now uses **Google** or a **numeric email OTP** (both via Firebase Auth; there are no passwords).
> Firebase still provides Authentication, FCM and Cloud Storage. Any section below that mentions Firestore collections, rules or the Firestore emulator is out of date.
> For current details, see `docs/implementation-status.md` and `apps/api/prisma/schema.prisma`.


Base path: `/api/v1`. Schemas referenced below are exported from
`@neighbourhood/shared` and are the source of truth; this document summarises
them. Paths are also in `ApiRoutes` (`packages/shared/src/routes.ts`).

**Status legend**: ✅ implemented and tested · 🟡 contract defined, endpoint returns `501 NOT_IMPLEMENTED`

## Conventions

| Topic | Rule |
|---|---|
| Auth | Every `/api/v1` route requires `Authorization: Bearer <Firebase ID token>`. Identity comes only from the verified token. |
| Bodies | JSON, max 32 kB. Request schemas are strict: unknown fields → `400 VALIDATION_FAILED`. |
| Errors | `{ "error": { "code": ApiErrorCode, "message": string, "details"?: [{path, message}] } }` (`ApiErrorBodySchema`). |
| Idempotency | Creates and transitions require an `Idempotency-Key` header (see architecture §6). |
| Pagination | `?cursor=&limit=` (max 50) → `{ items, nextCursor }` (`pageOf`). |
| Caching | All API responses send `Cache-Control: no-store`. |
| Rate limits | 300 req/min per IP on `/api/v1`, plus 10 req/min per user on AI routes → `429 RATE_LIMITED`. |
| Location | Public DTOs expose `ApproximateLocation` only. Exact data comes only from explicit private endpoints. |
| Versioning | Breaking changes need a new path or a coordinated change to shared schemas (see module-ownership.md). |

### Error codes → HTTP status

`BAD_REQUEST` 400 · `VALIDATION_FAILED` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `SELF_REQUEST` 403 ·
`NOT_FOUND` 404 · `CONFLICT` 409 · `INVALID_TRANSITION` 409 · `INSUFFICIENT_STOCK` 409 ·
`PAYLOAD_TOO_LARGE` 413 · `AI_INPUT_REJECTED` 422 · `RATE_LIMITED` 429 · `AI_QUOTA_EXCEEDED` 429 ·
`NOT_IMPLEMENTED` 501 · `AI_INVALID_OUTPUT` 502 · `AI_UPSTREAM_ERROR` 502 · `AI_NOT_CONFIGURED` 503 ·
`AI_MODEL_UNAVAILABLE` 503 · `AI_TIMEOUT` 504 · `INTERNAL` 500

---

## Health

| Method | Path | Auth | Status | Response |
|---|---|---|---|---|
| GET | `/healthz` | none | ✅ | `{ "status": "ok" }` |

## Auth & profiles (owner: Arung)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/me` | – | `MeSchema` | ✅ |
| PUT | `/me/profile` | `UpsertProfileBodySchema` | `MeSchema` | ✅ |

Registration and login happen client-side with Firebase Auth. After
registering, the client calls `PUT /me/profile` with `displayName`.
`Me.profile` is `null` until then.

```jsonc
// PUT /api/v1/me/profile
{ "displayName": "Ayu", "areaLabel": "Kemang, South Jakarta",
  "homeLocation": { "lat": -6.26, "lng": 106.81 },  // private, optional (null)
  "searchRadiusKm": 3,                               // 1 | 3 | 5 | 10, default 3
  "preferredLanguage": "id" }
// → Me
{ "uid": "…", "email": "ayu@example.com", "emailVerified": false,
  "profile": { …, "createdAt": "…", "updatedAt": "…" },
  "platformRoles": [], "memberships": [{ "communityId": "c1", "role": "volunteer" }] }
```

`platformRoles` and `memberships` are read-only. Sending `uid`, `role` or
`platformRoles` is rejected.

## AI (owner: Arung; matching consumer: Engineer 2; listing draft consumer: Engineer 1)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/ai/status` | – | `AiStatusSchema` | ✅ |
| POST | `/ai/needs/extract` | `ExtractNeedsBodySchema` | `ExtractNeedsResponseSchema` | ✅ |
| POST | `/ai/listing-draft` | `ListingDraftBodySchema` | `ListingDraftSchema` | 🟡 |
| POST | `/ai/match-explanations` | `{ needId, candidateIds }` (server loads candidates) | `MatchExplanationsSchema` after `groundMatchExplanations` | 🟡 |

```jsonc
// POST /api/v1/ai/needs/extract
{ "text": "Saya butuh pinjam kursi roda dewasa minggu depan selama 2 minggu", "today": "2026-10-17" }
// → 200
{ "model": "gemini-3.5-flash-lite", "requiresUserReview": true,
  "extraction": {
    "language": "id",
    "items": [{ "name": "kursi roda", "category": "mobility_aids", "quantity": 1,
                "preference": "borrow", "attributes": [{ "name": "ukuran", "value": "dewasa" }] }],
    "timing": { "neededBy": "2026-10-24", "loanDurationDays": 14, "originalText": "minggu depan selama 2 minggu" },
    "clarificationQuestions": ["Apakah perlu kursi roda yang bisa dilipat?"],
    "outOfScope": [] } }
```

- `category`: one of the six product categories, `other` or `unknown`.
  `preference`: `donation | borrow | either | unknown`. Unknown values stay
  `null` or `unknown`.
- `outOfScope.kind`: `blood_donation` or `transport_or_delivery`.
  Product needs use normal categories; unsupported categories remain `other` or `unknown`.
- Errors: `503 AI_NOT_CONFIGURED`, `503 AI_MODEL_UNAVAILABLE`,
  `429 AI_QUOTA_EXCEEDED`/`RATE_LIMITED`, `504 AI_TIMEOUT`,
  `502 AI_INVALID_OUTPUT`, `422 AI_INPUT_REJECTED`, `400 VALIDATION_FAILED`
  (text must be 3–2,000 chars).

**Listing draft (contract)**: the user uploads an image to `uploads/{uid}/…`
(≤ 4 MB, jpeg/png/webp) and posts its path. The response is a suggestion for
the owner to edit. Null means "not visible/unknown". `safetyFlags` covers
hazardous items and other details for owner review.

**Match explanations (contract)**: the server builds `MatchCandidate[]`
(≤ 20) from eligible active listings in the radius (excluding the user's own).
AI returns `{ matches: [{ listingId, fit, reason, missingInfo }] }`, and
`groundMatchExplanations` drops ids not in the candidate set. Ordering and
eligibility are decided by the server.

## Listings (owner: Engineer 1)

| Method | Path | Body / query | Response | Status |
|---|---|---|---|---|
| GET | `/listings` | `SearchListingsQuerySchema` (`lat,lng,radiusKm,category?,mode?,limit`) | `ListingPageSchema` | 🟡 |
| POST | `/listings` | `CreateListingBodySchema` | `ListingPublicSchema` | 🟡 |
| GET | `/listings/mine` | – | `ListingPageSchema` | 🟡 |
| GET | `/listings/:id` | – | `ListingPublicSchema` | 🟡 |
| PATCH | `/listings/:id` | partial of create (owner) | `ListingPublicSchema` | 🟡 |
| POST | `/listings/:id/transition` | `ListingTransitionBodySchema` | `ListingPublicSchema` | 🟡 |
| GET | `/listings/:id/pickup` | – | `ListingPrivateSchema` (owner, or approved/checked-out participant) | 🟡 |
| POST | `/listings/:id/photos` | multipart ≤ 4 MB | `ListingPhotoSchema` | 🟡 |

Rules: lend ⇒ quantity 1 and `lending` terms. Appliances ⇒ `appliance`
details (dimensions, weight, access, dismantling/installation; unknown =
null). `community_point` ⇒ `communityPointId`. Stock edits use `setTotalStock`.

## Donation requests (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| POST | `/requests` | `CreateDonationRequestBodySchema` + `Idempotency-Key` | `DonationRequestSchema` (201) | ✅ |
| GET | `/requests/incoming` · `/requests/outgoing` | page query | `DonationRequestPageSchema` | ✅ |
| GET | `/requests/:id` | – | `DonationRequestSchema` (owner, requester or active community volunteer) | ✅ |
| POST | `/requests/:id/transition` | `DonationRequestTransitionBodySchema` + `Idempotency-Key` | `DonationRequestSchema` | ✅ |

Errors: `SELF_REQUEST`, `INSUFFICIENT_STOCK` (at approval),
`INVALID_TRANSITION`, `FORBIDDEN`, `CONFLICT` (duplicate active request,
idempotency mismatch).

Requests are for active **donation** listings. `pending` does not reserve stock;
approval reserves, cancellation releases, and pickup confirmation moves reserved
units to collected. Only the giver or an active volunteer may confirm pickup.
The response adds `listingTitle` and server-computed `allowedActions` for the
mobile activity screen. Community volunteers receive `conversationId: null`
because private chat is limited to the giver and requester. A valid key is
8–128 URL-safe characters. It is scoped to the user and saved for 24 hours;
retries with the same path and parsed payload replay the saved status/body.
Reusing a key for another payload or path returns `409 CONFLICT`.

## Loans (owner: Engineer 1, handover UI with Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| POST | `/loans` | `CreateLoanBodySchema` + `Idempotency-Key` | `LoanSchema` | 🟡 |
| GET | `/loans/incoming` · `/loans/outgoing` | page query | page of `LoanSchema` | 🟡 |
| GET | `/loans/:id` | – | `LoanSchema` | 🟡 |
| POST | `/loans/:id/transition` | `LoanTransitionBodySchema` + `Idempotency-Key` | `LoanSchema` | 🟡 |

`overdue` is computed at read time with `isLoanOverdue`. `returned` is
confirmed by the lender, with an optional `returnConditionNote`.

## Communities & points (owner: Engineer 1)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/communities` | page query | page of `CommunitySchema` | 🟡 |
| GET | `/communities/:id` | – | `CommunitySchema` | 🟡 |
| POST | `/communities/:id/join` | – | `MembershipSchema` (`active` or `pending`) | 🟡 |
| POST | `/communities/:id/members/:uid/role` | `SetMemberRoleBodySchema` | `MembershipSchema` (`canSetCommunityRole`) | 🟡 |
| GET | `/communities/:id/points` | – | `CommunityPointSchema[]` | 🟡 |
| GET | `/points/by-qr/:qrId` | – | `CommunityPointSchema` (identification only) | 🟡 |
| GET | `/points/:id/inventory` | – | `PointInventoryItemSchema[]` | 🟡 |
| POST | `/points/:id/deposits` | `ProposeDepositBodySchema` | `DepositSchema` | 🟡 |
| POST | `/deposits/:id/review` | `ReviewDepositBodySchema` (volunteer) | `DepositSchema` | 🟡 |
| POST | `/points/:id/adjustments` | stock adjustment (volunteer) | `StockAdjustmentSchema` | 🟡 |

## Ask agent (owner: Engineer 2; Gemini adapter coordinated with Arung)

All routes below are authenticated and implemented. AI sessions are private
and separate from neighbour-to-neighbour conversations.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/ask/status` | – | `AskStatusSchema` |
| GET | `/ask/sessions` | `PageQuerySchema` | `AskSessionPageSchema` |
| POST | `/ask/sessions` | `AskCreateSessionBodySchema` (client UUID) | `AskSessionSchema` |
| GET | `/ask/sessions/:id` | optional `before` message sequence | `AskSessionDetailSchema` |
| POST | `/ask/sessions/:id/messages` | `AskSendBodySchema` (client message UUID) | `AskRunSchema`; history is persisted |
| POST | `/ask/sessions/:id/stop` | – | 204 |
| DELETE | `/ask/sessions/:id` | – | 204; domain records and saved needs remain |
| POST | `/ask/sessions/:id/attachments` | raw image bytes + `Idempotency-Key` | `AskAttachmentSchema` |
| GET | `/ask/sessions/:id/attachments/:attachmentId` | – | private image bytes |
| DELETE | `/ask/sessions/:id/attachments/:attachmentId` | – | 204; unsent photos only |
| PATCH | `/ask/actions/:id` | `AskEditNeedBodySchema` | `AskActionSchema` with new revision |
| POST | `/ask/actions/:id/confirm` | `AskConfirmBodySchema` (displayed revision) | `AskActionSchema`; stored receipt on success |
| POST | `/ask/actions/:id/cancel` | – | `AskActionSchema` |

The server builds cards from authorized tool results. Model calls prepare
actions only; confirmation invokes the existing domain services. See
`docs/ask-agent-handoff.md` for budgets, image processing and recovery details.

## Needs (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/needs` | `PageQuerySchema` | `SavedNeedPageSchema` (caller only) | ✅ |
| POST | `/needs` | `SaveNeedBodySchema`, `Idempotency-Key` | `SavedNeedSchema` | ✅ |
| DELETE | `/needs/:id` | – | 204 (caller only) | ✅ |
| GET | `/needs/:id/matches` | `radiusKm` | candidates + grounded explanations | 🟡 |

## Conversations (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/conversations` | page query | `ConversationPageSchema` (includes `unreadCount`, `listingTitle`) | ✅ |
| GET | `/conversations/:id` | – | `ConversationSchema` (participant only) | ✅ |
| GET | `/conversations/:id/messages` | page query | `MessagePageSchema` (participant only) | ✅ |
| POST | `/conversations/:id/messages` | `SendMessageBodySchema` + `Idempotency-Key` | `MessageSchema` (201) | ✅ |
| POST | `/conversations/:id/read` | `MarkConversationReadBodySchema` | 204 | ✅ |

A conversation is created by the server when a request or loan is created.
Its participants are taken from that record.
`/read` takes `{ "throughMessageId": "<loaded message UUID>" }` and never
marks later, unseen messages read. Messages are visible only to participants.

## Notifications (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/notifications` | page query | `NotificationPageSchema` | ✅ |
| POST | `/notifications/:id/read` | – | `NotificationSchema` | ✅ |
| POST | `/notifications/push-tokens` | `RegisterPushTokenBodySchema` | 204 | 🟡 |
| DELETE | `/notifications/push-tokens/:tokenId` | – | 204 | 🟡 |

Request and message events create short, generic inbox entries in the same
database transaction. FCM token registration and push delivery are still planned.

## Product categories (Engineer 1 listing contract; Engineer 2 discovery)

`ItemCategorySchema` is the single taxonomy for listing creation, filtering,
needs extraction and matching. Category choice does not create a separate case
or partner-review workflow. The web category page links into listing discovery;
the `GET /listings` implementation is owned by Engineer 1.
