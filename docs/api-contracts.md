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

- `category`: one of the six item categories, `other` or `unknown`.
  `preference`: `donation | borrow | either | unknown`. Unknown values stay
  `null` or `unknown`.
- `outOfScope.kind`: `medicine` (UI links to the private medicine service),
  `blood_donation` or `transport_or_delivery`. These are never extracted as items.
- Errors: `503 AI_NOT_CONFIGURED`, `503 AI_MODEL_UNAVAILABLE`,
  `429 AI_QUOTA_EXCEEDED`/`RATE_LIMITED`, `504 AI_TIMEOUT`,
  `502 AI_INVALID_OUTPUT`, `422 AI_INPUT_REJECTED`, `400 VALIDATION_FAILED`
  (text must be 3–2,000 chars).

**Listing draft (contract)**: the user uploads an image to `uploads/{uid}/…`
(≤ 4 MB, jpeg/png/webp) and posts its path. The response is a suggestion for
the owner to edit. Null means "not visible/unknown". `safetyFlags` containing
`medicine` blocks the listing and points to the partner flow.

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
| POST | `/requests` | `CreateDonationRequestBodySchema` + `Idempotency-Key` | `DonationRequestSchema` | 🟡 |
| GET | `/requests/incoming` · `/requests/outgoing` | page query | page of `DonationRequestSchema` | 🟡 |
| GET | `/requests/:id` | – | `DonationRequestSchema` (participants only) | 🟡 |
| POST | `/requests/:id/transition` | `DonationRequestTransitionBodySchema` + `Idempotency-Key` | `DonationRequestSchema` | 🟡 |

Errors: `SELF_REQUEST`, `INSUFFICIENT_STOCK` (at approval),
`INVALID_TRANSITION`, `FORBIDDEN`, `CONFLICT` (duplicate active request,
idempotency mismatch).

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

## Needs (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET/POST | `/needs` | reviewed `NeedsExtraction` items | saved needs | 🟡 |
| DELETE | `/needs/:id` | – | 204 | 🟡 |
| GET | `/needs/:id/matches` | `radiusKm` | candidates + grounded explanations | 🟡 |

## Conversations (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/conversations` | page query | page of `ConversationSchema` | 🟡 |
| GET | `/conversations/:id/messages` | page query | page of `MessageSchema` | 🟡 |
| POST | `/conversations/:id/messages` | `SendMessageBodySchema` | `MessageSchema` | 🟡 |

A conversation is created by the server when a request or loan is created.
Its participants are taken from that record.

## Notifications (owner: Engineer 2)

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| GET | `/notifications` | page query | page of `NotificationSchema` | 🟡 |
| POST | `/notifications/:id/read` | – | `NotificationSchema` | 🟡 |
| POST | `/notifications/push-tokens` | `RegisterPushTokenBodySchema` | 204 | 🟡 |
| DELETE | `/notifications/push-tokens/:tokenId` | – | 204 | 🟡 |

## Medicine assistance (owner: Engineer 2) — private

| Method | Path | Body | Response | Status |
|---|---|---|---|---|
| POST | `/medicine-assistance` | `CreateMedicineAssistanceBodySchema` | `MedicineAssistanceCaseSchema` | 🟡 |
| GET | `/medicine-assistance/mine` | – | cases | 🟡 |
| POST | `/medicine-assistance/:id/withdraw` | – | case | 🟡 |
| GET | `/partner/medicine-assistance` | – | cases assigned to the caller's partner org (`medicine_partner`) | 🟡 |
| POST | `/partner/medicine-assistance/:id/transition` | `{ to }` | case | 🟡 |

There are no public medicine listings, medical advice, dosage information or
AI processing. `consentToShareWithPartner` must be `true`.
