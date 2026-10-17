# API contracts

Base `/api/v1`. Shared Zod schemas in `packages/shared/src/contracts` are the
source of truth for bodies and DTOs. Routes parse strict bodies and authorize
with verified Firebase identity. Domain creates/transitions use
`Idempotency-Key`; Ask turns and UI proposals use their explicit client UUIDs.
Responses are no-store, errors follow `ApiErrorBodySchema`, and list endpoints
use cursor pagination where defined by the shared schema.

| Module | Implemented routes / contracts |
|---|---|
| Profiles | `GET /me`, `PUT /me/profile`; roles and memberships are read-only |
| Auth | Google Firebase sign-in, email OTP endpoints; `/auth/demo` only with demo Auth emulator |
| Listings | Search, mine, detail, create, update/status, private pickup, raw photo upload and photo deletion |
| Requests | Incoming/outgoing/detail/create/transitions; approval reserves, collection commits, expiry releases |
| Loans | Incoming/outgoing/detail/create/transitions and listing date availability |
| Communities | Directory/detail/create/join, member list/review, point create/list/detail and QR resolution/image |
| Inventory | Deposit propose/list/review, point inventory, reasoned adjustments and audit |
| Needs | List/detail/create/delete and `GET /needs/:id/matches` |
| Chat | Participant conversations, paged messages, send and read markers |
| Notifications | Inbox/read, `GET /notifications/unread` global authorized counts, push-token register/remove |
| AI | Status, needs extraction, owned-photo listing draft and owned-need match explanations |
| Ask | Status, sessions, paged history, turns/runs/stop, private attachments, UI proposals and actions |

Important integration contracts:

- Search/profile `radiusKm` / `searchRadiusKm` accept whole kilometres from 1
  through 50. Migration `20261018000000_manual_search_radius` expands the
  PostgreSQL profile constraint. Invalid/fractional values are rejected.
- Ask listing parts optionally carry `search` metadata: the checked `radiusKm`,
  an optional `broaderRadiusKm` and separately typed `fartherItems`. Older
  listing cards remain readable. Radius choices draft a user reply; they do not
  mutate profile preferences or approve marketplace actions.

- `GET /notifications/unread`: `{ messages, updates }` for the signed-in account only. Message counts exclude the viewer's own messages and respect each participant's read watermark. Update counts include all unread inbox entries, independent of pagination. No migration is required.
- Ask read-only tools `get_product_guide({ topic })` and `my_account({})` are
  internal model tools, not new public endpoints. Guide topics cover roles,
  giving, borrowing, points, saved needs, location, chat and navigation.
  `my_account` derives identity from the authenticated session and returns safe
  caller roles/membership statuses/preferences and a location-set flag. It never
  returns home coordinates, email or another resident's account data.

- `POST /ai/listing-draft`: `{ sessionId, attachmentId, hint? }`; the API reads
  the caller's normalized session image. No arbitrary URL fetch.
- `POST /ai/match-explanations`: `{ needId }`; candidates are server selected.
- `POST /ask/sessions/:id/proposals`: `{ clientId, action }` with
  `MarketplaceActionSchema`; returns a stored review card, never executes.
- `POST /ask/sessions/:id/messages`: existing JSON clients receive `AskRun`.
  `Accept: application/x-ndjson` streams validated `{ type: "run" | "done", run }`
  snapshots. Partial text replaces the prior snapshot. A disconnect does not
  approve an action or implicitly resend the message; durable detail/stop and
  idempotent client-message IDs remain the recovery path.
- Ask `questions` parts retain legacy one-to-four question compatibility, but
  new turns emit only the first question and wait for a normal chat answer.
  Listing drafts add optional defaulted `maxLoanDays`, `attachmentIds`
  and attachment metadata, preserving old history compatibility. Publication
  tools prepare approval cards; only the confirm endpoint performs the write.
  Historical listing/match photo URLs are renewed when detail is loaded.
- `STORAGE_UNAVAILABLE` (503) identifies unavailable Ask upload storage.
- `GET /saved-items/ids` returns caller-owned bookmark listing IDs. `GET
  /saved-items` returns paged `{ id, listingId, title, createdAt, listing }`
  bookmarks with fresh product DTOs; `listing` is null when unavailable. `PUT`
  and `DELETE /saved-items/:listingId` are idempotent caller-scoped toggles.
  Ask adds `saved_item_add`/`saved_item_remove` approval operations and a
  read-only `list_saved_items` tool.
- Conversation DTOs add optional `listingId`, `listingPhotoUrl`,
  `imagesAvailable` and own `pendingAttachments`. `POST
  /conversations/:id/attachments` accepts raw JPEG/PNG/WebP under 4 MB with an
  idempotency key. Authenticated `GET`/`DELETE .../attachments/:attachmentId`
  read photos or remove own pending photos. Only uploader reads pending photos;
  only participants read sent photos. Message bodies accept `attachmentIds`
  (up to two) and text or photos; photo-only messages store the body `Photo`.
  Message DTOs include attachment metadata without bucket paths.
  Migration: `20261018010000_saved_items_message_photos`.
- `POST /ask/actions/:id/confirm`: `{ revision }`; repeat confirmation returns
  the same outcome. Cancel is separate. Stale listing edits are rejected.
- `POST /listings/:id/photos`: raw JPEG/PNG/WebP with `Content-Type` and
  `Idempotency-Key`; server normalizes WebP and enforces ownership/limits.
- Point donation creation includes `pointInventoryItemId`; full unreserved
  inventory and volunteer authorization are required.

Private exact pickup fields never appear in public listing DTOs or model-safe
tool results. Only consented community point addresses are public. QR tokens
identify points without granting membership or inventory privileges. Listing
photo reads require an unexpired signed URL; Ask image reads require identity.

For exact route spelling and query fields, inspect each module's `*.routes.ts`
together with its shared schemas. [Architecture](architecture.md) explains
locking, idempotency and confirmation semantics.
