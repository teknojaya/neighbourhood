# NeighbourHood architecture

> **Updated 2026-10-17: architecture change.** PostgreSQL (Prisma 7 migrations; Cloud SQL in production) has replaced Firestore.
> Sign-in now uses **Google** or a **numeric email OTP** (both via Firebase Auth; there are no passwords).
> Firebase still provides Authentication, FCM and Cloud Storage. Any section below that mentions Firestore collections, rules or the Firestore emulator is out of date.
> For current details, see `docs/implementation-status.md` and `apps/api/prisma/schema.prisma`.


NeighbourHood is a mobile-first PWA where neighbours donate or lend groceries,
clothing, books, household goods, appliances and mobility aids. Recipients
collect from the owner's location or a partner-managed community point and
arrange their own transport, helpers, dismantling and installation. There is
no delivery, driver booking or transport matching.

## 1. System overview

```
Browser (React PWA)                         Cloud Run service (single container)
┌──────────────────────────┐   HTTPS     ┌───────────────────────────────────────┐
│ Firebase Auth (client)   │──ID token──▶│ Express API  /api/v1/*                │
│ TanStack Query + api.ts  │   Bearer    │  requireAuth → verifyIdToken(revoked) │
│ Service worker (shell)   │◀────────────│  module routes → service → repository │
└──────────────────────────┘             │  static /  (built apps/web/dist)      │
                                          └──────┬──────────────┬─────────────────┘
                                                 │ Admin SDK     │ @google/genai
                                         Firestore / Storage    Gemini Developer API
```

- **One deployable**: the API serves the built frontend (`WEB_DIST_DIR`) and
  `/api/v1`. Health check: `GET /healthz`.
- **No direct client database access**. Firestore and Storage rules deny
  everything. The Admin SDK bypasses rules, so **every service enforces
  authorization itself** (see §3).
- **Shared contracts** (`packages/shared`) are the single source of truth for
  enums, Zod schemas, DTOs, state machines and pure domain rules. Both apps
  import from `@neighbourhood/shared`.

## 2. Repository layout

```
packages/shared/src
  common.ts            ids, dates, LatLng, ApproximateLocation, ApiError body, idempotency
  enums.ts             categories, modes, conditions, roles
  geo.ts               radius options, geohash ranges, exact-distance search, privacy rounding
  routes.ts            canonical API paths
  domain/              state machines (listing, request, loan, deposit, medicine), stock, loan rules
  contracts/           DTOs per module (profiles, listings, requests-loans, communities, messaging)
  ai/contracts.ts      AI limits, needs extraction, listing-draft and matching contracts + grounding
apps/api/src
  config.ts            env validation + emulator/production safeguards
  app.ts               express app factory (DI for tests)
  server.ts            production wiring (Firebase Admin, Gemini)
  lib/                 http errors/validation, logger
  modules/<feature>/   <feature>.routes.ts, .service.ts, .repository.ts
apps/web/src
  lib/                 firebase init, api client, online status
  auth/                AuthProvider, RequireAuth, useMe
  features/<feature>/  pages + hooks mirroring backend modules
  i18n/                English strings keyed for translation
  pwa/, sw.ts          single service worker + cache policy
```

**Module pattern** (copy `modules/profiles`):

- `*.routes.ts` parses input with shared Zod schemas (`parseBody`/`parseQuery`)
  and takes the user only from `authUser(req)`.
- `*.service.ts` holds business rules and authorization; it receives
  repositories through its constructor.
- `*.repository.ts` is the only code that knows Firestore paths. Expose an
  interface so tests can use in-memory fakes (`apps/api/src/test/fakes.ts`).

## 3. Authentication and authorization

- Firebase Auth email/password on the client. The client sends
  `Authorization: Bearer <Firebase ID token>`.
- `requireAuth` calls `verifyIdToken(token, checkRevoked=true)` and sets
  `req.auth = { uid, email, emailVerified }`. **Every** `/api/v1` route is
  behind it. A uid, role or owner id in a request body is never trusted; strict
  schemas reject unknown fields such as `uid` or `platformRoles`.
- **Platform roles** (`staff`, `medicine_partner`) live in `userRoles/{uid}`
  and are written only by the operator script `npm run grant-role -w
  @neighbourhood/api`. There is no HTTP endpoint for granting them.
- **Community roles** (`member` < `volunteer` < `moderator`) live in
  `communities/{cid}/members/{uid}` and are written only by the server.
  Policy (`canSetCommunityRole`): nobody changes their own role. Moderators can
  set member/volunteer for others in their community. Only staff can grant or
  remove moderator.
- Helpers: `assertCommunityRole(access, uid, cid, 'volunteer')` and
  `requirePlatformRole(access, 'medicine_partner')`.
- **Community membership is separate from geography**. Nearby search uses
  the radius only; membership gates volunteer and moderator actions.

### Emulator safeguards

`loadConfig` refuses to start when:

- any `*_EMULATOR_HOST` or `USE_FIREBASE_EMULATORS=true` is set with
  `NODE_ENV=production` or on Cloud Run (`K_SERVICE`);
- an emulator host is set without `USE_FIREBASE_EMULATORS=true`;
- emulators are enabled with a project id that is not `demo-*`.

The web app only connects to the Auth emulator in a Vite dev build on
localhost, and `vite build` fails if `VITE_USE_FIREBASE_EMULATORS=true` or a
secret-like `VITE_` variable (GEMINI, SECRET, PRIVATE_KEY...) is present.

## 4. Data model (Firestore)

| Collection | Contents | Visibility |
|---|---|---|
| `profiles/{uid}` | displayName, areaLabel, createdAt | other signed-in users (via API) |
| `profilesPrivate/{uid}` | homeLocation, preferences | owner only |
| `userRoles/{uid}` | platform roles | server/operators |
| `listings/{id}` | public listing fields, `geohash`, `stock`, `status` | via public DTO only |
| `listingPrivate/{id}` | exact location, pickup instructions | owner + approved participants |
| `donationRequests/{id}` | request + status | owner, requester |
| `requestLocks/{listingId}_{uid}` | prevents duplicate active requests | server |
| `loans/{id}` | loan + status + dates | owner, borrower |
| `communities/{cid}` + `/members/{uid}` | community, memberships | members / server |
| `communityPoints/{pid}` + `/private/details` | point, partner consent, exact address | public DTO / volunteers |
| `communityPoints/{pid}/inventory/{itemId}` | point stock | via API |
| `deposits/{id}` | proposed deposits | donor, point volunteers |
| `stockAdjustments/{id}` | append-only inventory audit | point volunteers, staff |
| `conversations/{id}` + `/messages/{mid}` | request/loan-linked chat | participants |
| `notifications/{id}`, `pushTokens/{uid}/tokens/{tokenId}` | inbox, opt-in tokens | owner |
| `medicineCases/{id}` | private medicine assistance | requester, assigned partner |
| `idempotencyKeys/{uid}_{key}` | stored mutation results (TTL 24 h) | server |

Listings store `geohash` (precision 9) of the **exact** location for querying.
The public DTO is built by `approximateLocation()`: coordinates rounded to
2 decimals (~1.1 km) and distance rounded up to 0.5 km steps. Exact geohash and
coordinates are never returned publicly.

## 5. Location search

- Radius options are 1, 3, 5 and 10 km, defaulting to 3 km (`RadiusKmSchema`).
- `searchWithinRadius()` builds geohash prefix ranges (`geohashQueryBounds`),
  runs one bounded Firestore query per range
  (`where('status','==','active').orderBy('geohash').startAt(s).endAt(e).limit(n)`),
  de-duplicates, filters by exact great-circle distance, then sorts. The
  collection is never downloaded wholesale. Indexes are in
  `firestore.indexes.json`.
- The search centre is the user's saved home location, or a manually entered
  point when geolocation is unavailable. The profile page supports both.

## 6. Domain rules

State machines live in `packages/shared/src/domain/machines.ts`. Each rule lists
the allowed **actor** (`owner`, `requester`, `volunteer`, `system`). The service
resolves the actor from the verified uid and stored records, then calls
`assertTransition(machine, from, to, actor)`.

| Entity | States | Notes |
|---|---|---|
| Listing | draft → active ⇄ paused → closed | Quantity is separate (`stock`). Closing with reserved units is refused by the service. |
| Donation request | pending → approved → collected; pending → rejected/cancelled/expired; approved → cancelled/expired | Only owner/volunteer approve or confirm collection. |
| Loan | pending → approved → checked_out → returned; pending → rejected/cancelled; approved → cancelled | Overdue is derived (`isLoanOverdue`). The lender confirms the return. |
| Deposit | proposed → accepted/rejected | Volunteer only. Stock is added on acceptance only. |
| Medicine case | submitted → under_review → referred/closed; withdrawn | Verified partner staff only; never `system`/AI. |

### Approval and stock (atomic)

Stock is `{ total, reserved, collected }`, with `available = total - reserved - collected`.
**Pending requests do not reserve stock.**

```
approveRequest(uid, requestId, idemKey):
  db.runTransaction(tx => {
    stored = tx.get(idempotencyKeys/{uid}_{idemKey});  if stored → return stored.response
    req     = tx.get(donationRequests/{requestId})
    listing = tx.get(listings/{req.listingId})          // always read+write the listing doc
    actor   = resolveActor(uid, req, listing)           // owner, or volunteer of the point's community
    assertTransition(donationRequestMachine, req.status, 'approved', actor)
    require listing.status === 'active'
    stock   = reserveStock(listing.stock, req.quantity)   // throws INSUFFICIENT_STOCK
    tx.update(listing, { stock, updatedAt })
    tx.update(req, { status: 'approved', pickupBy, updatedAt })
    tx.create(idempotencyKeys/{uid}_{idemKey}, { requestHash, response, expireAt })
    tx.create(notifications/..., conversation if missing)
  })
```

- **Release**: approved → cancelled/expired calls `releaseStock` in the same
  kind of transaction.
- **Collect**: approved → collected calls `collectStock`. It is confirmed by
  the giver, or by a volunteer for community-point stock, in person. A QR scan
  alone never confirms anything.
- Firestore transactions retry on contention, and every approval writes the
  listing document, so concurrent approvals serialize and cannot oversell.
- **Self-requests** are blocked with `assertNotSelfRequest(listing.ownerId, uid)`
  at creation and approval.
- **Duplicate active requests**: create `requestLocks/{listingId}_{uid}` in the
  creation transaction (fails if present). Delete it when the request reaches
  a terminal state.

### Idempotency

Every create or transition endpoint requires the `Idempotency-Key` header
(8–128 chars, `[A-Za-z0-9_-]`). The server stores
`idempotencyKeys/{uid}_{key}` with a hash of method+path+body and the response,
inside the same transaction as the mutation. A retry with the same key and
hash replays the stored response. The same key with a different hash returns
`409 CONFLICT`. Enable a Firestore TTL policy on `expireAt` (24 h). The web
client generates keys with `newIdempotencyKey()` and reuses one per user action.

### Conflicting loans (single unit)

Lend listings always have quantity 1. Approval transaction:

1. read the listing doc (serialization point, see above);
2. query `loans where listingId == X and status in (approved, checked_out)`;
3. `assertValidRange` (≤ `lending.maxLoanDays`) and `assertNoConflictingLoan`.
   Pending loans do not block. A checked-out loan past its end date blocks
   until it is returned;
4. update the loan and touch the listing (`updatedAt`, `loanVersion++`).

Dates are calendar dates (`YYYY-MM-DD`, inclusive). The helpers currently
compare UTC days. Before launch, evaluate "today" and "overdue" in the
community's timezone (WIB/WITA/WIT).

### Community points, QR and deposits

- `qrId` is a random opaque id printed at the point. `GET /points/by-qr/:qrId`
  only *identifies* the point.
- A donor proposes a deposit, and a volunteer of that community reviews it in
  person (`accepted` with possibly lower counts, or `rejected`). In one
  transaction: update the deposit, increment inventory, and append
  `stockAdjustments`.
- Public point addresses appear only when `partnerConsent.publicAddress` is
  true; otherwise only the approximate location and area label are shown.

### Expiry

`pending`/`approved` → `expired` is a `system` transition. Plan: a Cloud
Scheduler job calls an internal endpoint authenticated by an OIDC token (a
service account, not a Firebase user). It processes due requests in bounded
batches, each one in its own transaction. Not implemented yet.

## 7. AI (Gemini)

- Server-only adapter: `apps/api/src/modules/ai/gemini.adapter.ts` uses
  `@google/genai` → `ai.interactions.create({ model, input, system_instruction,
  response_format: { type: 'text', mime_type: 'application/json', schema },
  generation_config: { max_output_tokens }, store: false })` and reads
  `interaction.output_text`. This SDK usage was checked against
  ai.google.dev/gemini-api/docs/structured-output and the SDK 2.30.0 type
  definitions (2026-10-17).
- **Model** comes from `GEMINI_MODEL`; nothing is hardcoded in code. The
  stable models listed on 2026-10-17 are `gemini-3.5-flash-lite` (default in
  `.env.example`) and `gemini-3.8-flash`.
- **Missing key or model** → `/ai/status` reports `available: false`, and the
  extraction endpoint returns `503 AI_NOT_CONFIGURED`. There are no canned
  fallbacks.
- **Bounds** (`AI_LIMITS`): 2,000-char input, 32 kB JSON body, 2,048 output
  tokens, 25 s timeout (SDK `timeout_ms` + `AbortSignal`), 10 requests/min
  per user. Images (future): 4 MB, jpeg/png/webp.
- **Errors** map to stable codes: 429 → `AI_QUOTA_EXCEEDED`, 404/unsupported
  model → `AI_MODEL_UNAVAILABLE`, 401/403 → `AI_NOT_CONFIGURED`,
  timeout → `AI_TIMEOUT`, malformed/incomplete/schema-invalid →
  `AI_INVALID_OUTPUT`. Upstream messages are never echoed to clients.
- **Validation**: Gemini receives a hand-written JSON schema (only keywords
  Gemini documents as supported). Output is then validated with the
  authoritative Zod schema. A test keeps the two aligned.
- **Prompt-injection posture**: user text and (future) listing text and images
  are wrapped in delimiters and treated as data, and delimiter look-alikes are
  stripped. For matching, the server selects candidates (geo + eligibility).
  AI only explains them, and `groundMatchExplanations()` drops any listing id
  that was not supplied. AI never approves requests, alters stock, publishes
  listings, reviews medicine cases or judges who deserves aid.
- **Privacy**: needs text is not logged or stored by the extraction endpoint,
  and responses are not cached by the client or the SW. Logs contain only
  task, model, code, status and duration. Medicine cases are never sent to AI.
- **Rate limiting** is in-memory per Cloud Run instance. With multiple
  instances the effective limit is N × 10/min. Gemini project quota is the
  global backstop. Move to a shared counter (a Firestore doc per uid/minute)
  if abuse appears.

## 8. PWA and service worker

- `vite-plugin-pwa` with `injectManifest` builds **one** service worker from
  `apps/web/src/sw.ts`.
- It precaches only build assets (JS/CSS/HTML/icons/manifest) and serves
  `index.html` for same-origin navigations, except `/api/*`, `/healthz` and
  `/__/*` (`pwa/cache-policy.ts`, unit-tested).
- **No runtime caching routes**, so authenticated API responses, chat, pickup
  addresses, images and medical data are never cached by the SW. The API also
  sends `Cache-Control: no-store`.
- Mutations require connectivity. `api()` throws `OFFLINE` before sending,
  mutations are never retried or queued, and forms disable submit and show a
  message while offline.
- **FCM plan**: add `firebase/messaging/sw` `onBackgroundMessage` to the same
  `sw.ts` and call `getToken({ vapidKey, serviceWorkerRegistration })` with
  the existing registration. Do not add a second `firebase-messaging-sw.js`.
  Push payloads stay generic (no addresses or medical details). Tokens are
  registered only after an explicit opt-in.

## 9. Realtime chat rules (future, not enabled)

Chat currently goes through the API. If realtime reads are needed, enable only
participant-only **read** rules (the commented block in `firestore.rules`):

- `participantIds` is written only by the server, from the request/loan record;
- clients never write conversations or messages directly (sending stays
  `POST /api/v1/conversations/:id/messages`);
- no other collection gets client access;
- add emulator rule tests (`@firebase/rules-unit-testing`) before enabling.

## 10. Security headers and logging

- Helmet sets the CSP (self + Firebase Auth/FCM/Storage endpoints) and
  `frame-ancestors 'none'`, and removes `x-powered-by`.
- Logs are JSON lines (Cloud Logging severity). Never log request bodies,
  needs text, medicine data, exact locations, tokens or keys.
