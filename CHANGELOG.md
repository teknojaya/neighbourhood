# Changelog

All notable changes to the **NeighbourHood** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Marketplace integration — 2026-10-17

- Integrated Engineer 1 listings with Engineer 2 requests, chat, inbox and needs.
- Implemented loan lifecycle, communities/points, reviewed deposits and audited
  inventory-backed listings with transactional permissions and stock checks.
- Expanded Ask with marketplace tools, secure photo-assisted publication and
  point creation, review/confirm/cancel, history and streamed progress.
- Replaced local/public upload handling with normalized private bucket storage
  and expiring reads; added orphan cleanup, push outbox and request expiry.
- Applied nine local migrations and added demo accounts, mobile journeys and
  deployment/maintenance documentation. Current verification: 92 unit tests,
  44 PostgreSQL tests, real Gemini and Storage emulator mobile smoke.
- Node 24.12+ is required. Real cloud bucket, SMTP, FCM and container execution
  remain environment checks; see `docs/integration-handoff.md`.

The older entries below record behavior before this integration and may mention
the superseded local upload implementation.

---

## [Unreleased] - 2026-10-17

> **Initiated NeighbourHood**: A peer-to-peer community platform where neighbours share and lend items to help each other. Neighbours can donate surplus goods (groceries, clothing, books, household items) or lend useful appliances and tools with clear scheduling, pickup coordination, and partner-managed community boxes.

### Added
- **Activity Page Dual-Role Navigation** (`apps/web/src/features/activity/ActivityPage.tsx`):
  - Implemented Segmented Tab Switcher with two dedicated views:
    - **Giving & Lending** (Donor / Item Owner role): Manages shared listings, outgoing loans, and incoming neighbour requests.
    - **Receiving & Borrowing** (Recipient / Borrower role): Tracks requested items, active loans, and due dates to avoid schedule conflicts.
  - Added URL query parameter sync (`?tab=giving` and `?tab=receiving`) with structured event logging and defensive error handling.
  - Added modern empty states with quick action CTAs.
- **Home Page Dual-Action Grid** (`apps/web/src/features/home/HomePage.tsx`):
  - Added a secondary primary CTA card for **"Share or lend an item"** (`/activity?tab=giving`) alongside the existing **"Describe what you need"** AI assistant card.
  - Balances the interface for both donors and recipients directly on the landing screen.
- **Localization Strings** (`apps/web/src/i18n/en.ts`):
  - Added UI message keys for activity tabs, empty states, and home action cards (`activity.tab.*`, `activity.giving.*`, `activity.receiving.*`, `home.shareCta`, `home.shareBody`).
- **Listing & Photo Backend Module** (`apps/api/src/modules/listings/`):
  - Added `ListingsService` handling atomic creation of listings with private pickup instructions, safe editing, state machine transitions (`draft` -> `active` -> `paused` -> `closed`), photo upload URL generation, and Haversine radius searches.
  - Added real controller routes in `listings.routes.ts` for `POST /listings`, `GET /listings/mine`, `GET /listings/:id`, `PATCH /listings/:id`, `POST /listings/:id/transition`, and `POST /listings/:id/photos` with fallback to planned routes when unconfigured.
  - Added `UpdateListingBodySchema` and `CreateListingPhotoBodySchema` in `@neighbourhood/shared`.
  - Added unit test suite in `listings.service.test.ts`.
- **Listing & Photo Frontend Module** (`apps/web/src/features/listings/`):
  - Added `listingApi.ts` client with typed functions for my listings, create, patch, status transition, and photo binary upload.
  - Added `ListingFormModal.tsx` for creating/editing items: offering mode (donate vs lend), categories, conditions, appliance specifications, pickup instructions, and photo selection with preview.
  - Updated `ActivityPage.tsx` to display real shared items in "Giving & Lending" with status indicators, stock counters, quick actions (Pause/Resume, Edit, Close), and integrated the modal.

- **Local File Object Storage Provider** (`apps/api/src/lib/storage.ts`, `apps/api/src/modules/storage/storage.routes.ts`):
  - Implemented `LocalFileObjectStorage` driver honoring the polymorphic `ObjectStorage` interface for offline local testing and emulator mode.
  - Automatically switches between `LocalFileObjectStorage` (when `USE_FIREBASE_EMULATORS=true` or in development) and production `FirebaseObjectStorage` (Google Cloud Storage) without changes to database schema or business logic.
  - Added dedicated endpoints (`PUT /api/v1/storage/upload` and `GET /api/v1/storage/file`) with path sanitization (`SAFE_PATH`) and binary payload streaming.
  - Added thumbnail resilience (`ListingThumbnail`) in `ActivityPage.tsx` with automatic fallback to category emojis if an image load fails.
- **Listing Detail Page** (`apps/web/src/features/listings/ListingDetailPage.tsx`, `apps/web/src/App.tsx`):
  - Created dedicated item detail view at `/listings/:id` supporting dual roles:
    - **Donor / Owner View**: Full item specs, appliance details, loan duration, and a confidential box with private pickup instructions, contact notes, and direct owner controls (Edit, Pause/Resume, Close).
    - **Recipient / Borrower View**: Public details, multi-photo carousel, item specs, approx area distance, donor profile, and request action button.
  - Linked item thumbnails, titles, and added dedicated "👁 Details" action buttons in `ActivityPage.tsx`.
  - Added typed `fetchListingDetail` in `listingApi.ts` consuming `GET /listings/:id`.

### Verified
- Automated type checks pass across all workspaces (`npm run typecheck`).
- Unit and domain rule tests pass (84 tests passing across `shared`, `api`, and `web`).
- Backend server running with `LocalFileObjectStorage` on port 8080.
