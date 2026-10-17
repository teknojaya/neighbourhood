# NeighbourHood

A mobile-first neighbourhood marketplace for donating and borrowing groceries,
clothing, books, household goods, appliances and mobility aids. Ask is an AI
chat agent for marketplace discovery and actions; every consequential action
requires a stored review card and explicit confirmation. Recipients arrange
their own transport and collect from an owner or a community point.

React 19/Vite/Tailwind PWA, Express 5, shared Zod contracts, PostgreSQL 17 with
Prisma migrations, Firebase Auth/Storage/FCM, and server-side Gemini.

## Run locally

Requirements: Node **24.12+**, npm, PostgreSQL 17, Java **21+** for emulators.

1. Run `npm ci`. Copy each app's `.env.example` to its ignored local env file
   only if it does not already exist.
2. Set API `DATABASE_URL` to your local database. `npm run db:up` offers Docker
   PostgreSQL on port **55432**; an existing PostgreSQL installation can use
   **5432**. Keep `TEST_DATABASE_URL` on a separate disposable database.
3. For local Firebase, use `USE_FIREBASE_EMULATORS=true`, project
   `demo-neighbourhood`, bucket `demo-neighbourhood.firebasestorage.app`, Auth
   host `127.0.0.1:9099` and Storage host `127.0.0.1:9199`. Set the web app's
   matching demo identifiers and `VITE_USE_FIREBASE_EMULATORS=true`.
4. Run `npm run db:deploy -w @neighbourhood/api`, then `npm run emulators`.
5. Run `npm run seed:demo -w @neighbourhood/api`, then `npm run dev`.
6. Open http://localhost:5173. Emulator-only sign-in offers Owner, Neighbour
   and Volunteer accounts. Real sign-in supports Google or email OTP.

Set `GEMINI_API_KEY` only in the API env to enable Ask, image understanding and
matching. Without it the UI reports AI unavailable. Email OTP needs SMTP and
`OTP_SECRET`; browser push needs real Firebase credentials and a public VAPID
key. See the [integration runbook](docs/integration-handoff.md).

## Verify and maintain

| Command | Purpose |
|---|---|
| `npm run check` | Types, lint, unit tests, API/PWA production build |
| `npm run test:db` | Isolated PostgreSQL permission, stock and concurrency tests |
| `npm run smoke:marketplace` | Real Gemini/bucket and two-user mobile journey; local disposable fixtures only |
| `npm run smoke:ui` | Local demo navigation, draft recovery, loading/empty states and responsive captures |
| `npm run smoke:unread` | Authorized unread counts and header read-state updates; disposable local fixtures |
| `npm run smoke:ask -w @neighbourhood/api` | Real tools, private images, confirmation and history |
| `npm run maintenance -w @neighbourhood/api` | Request expiry, push outbox and orphan photo cleanup |
| `npm run migrate:photos -w @neighbourhood/api` | Import referenced legacy local photos into the configured bucket |

Smoke scripts require a running API/web app and demo emulators. Set
`SMOKE_API_URL` to use a separate API port; optionally `PLAYWRIGHT_CHANNEL=msedge`
and `SMOKE_SCREENSHOT_DIR` for mobile captures. They remove only their fixtures.

## Current implementation

- Donation and lending listings, bucket photos, private pickup, radius/keyword
  search, saved needs and grounded matching.
- Requests, approval, reserved stock, collection, expiry, private chat and inbox.
- Single-unit loans with availability, overlap protection, checkout and return.
- Community membership, consented points/QR, reviewed deposits, audited stock
  and inventory-backed donation listings.
- Ask sessions/history, camera/photos, streamed progress, typed tools,
  review/confirm/cancel and recovery; direct forms remain available.

[Architecture](docs/architecture.md) · [API](docs/api-contracts.md) ·
[Status](docs/implementation-status.md) · [Runbook](docs/integration-handoff.md) ·
[Acceptance checklist](docs/integration-checklist.md).

The UI branch's scope and validation are recorded in the
[UI handoff](docs/ui-enhancement-handoff.md), with product context in
[PRODUCT.md](apps/web/PRODUCT.md) and the documented system in
[DESIGN.md](apps/web/DESIGN.md).

Deploy using the runbook: migrate PostgreSQL before serving the new app,
configure a private Firebase bucket, shared URL-signing secret and provider
credentials, and schedule the maintenance job. No resources are deployed
automatically. Secrets and local uploads must stay outside Git and images.
