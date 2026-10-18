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
- **Post-Merge Fixes**:
  - Deployed pending Prisma migrations (`20261017150000_product_categories` through `20261018000000_manual_search_radius`) adding `point_inventory_item_id` to listings table.
  - Aligned `CreateListingBodySchema` in `@neighbourhood/shared` to allow `pointInventoryItemId` to be optional in addition to nullable.
  - Exported missing `CreateLoanBody` type in `@neighbourhood/shared`.
  - Installed missing dependencies (`qrcode`, `leaflet`, `@types/leaflet`) and rebuilt shared package.
  - Restarted API server with Node `--watch` mode on port 8080 so schema changes take effect immediately.

The older entries below record behavior before this integration and may mention
the superseded local upload implementation.

## [Stable Modules] - 2026-10-18

The 4 core platform modules have achieved full stability, end-to-end frontend ↔ backend synchronization, defensive schema validation, and automated test verification:

### 1. Listing & Foto (Status: Stable)
- **Item Lifecycle & Offer Modes**: End-to-end creation, editing, and state machine transitions (`active`, `paused`, `closed`) for both donation ("Donate / Free to keep") and loan ("Lend / Return later").
- **Stock & Categorization**: Precise quantity tracking, categorical classification (Groceries, Books, Clothing, Household, Appliance, etc.), and condition tagging (`new`, `like_new`, `good`, `fair`).
- **Resilient Polymorphic Storage**: Zero-failure photo storage engine (`ObjectStorage`) automatically using `LocalFileObjectStorage` for offline development/emulation (persisting to local `uploads/` directory) and `FirebaseObjectStorage` for production, with HMAC-SHA256 signed read URLs and automatic fallback if cloud storage buckets do not exist.
- **Dual-Role Detail Views**: Dedicated item view at `/listings/:id` with private pickup instructions protected for donors and public specifications, photo gallery carousel, and radius distance for recipients.

### 2. Loan / Peminjaman (Status: Stable)
- **Availability & Conflict Prevention**: Atomic date range availability checking preventing overlapping bookings and double-scheduling for borrowed items.
- **Full Loan Lifecycle**: Complete transactional flow: borrower request -> donor approval/rejection -> item pickup (check out) -> return completion.
- **Frontend ↔ Backend Synchronization**: Dedicated endpoints (`GET /loans/incoming`, `GET /loans/outgoing`, `GET /loans/listing/:listingId/booked`), aligned schemas (`LoanSchema`, `LoanSummarySchema`), and safe fallback status formatting in UI modals (`BorrowModal.tsx`, `LoanRequestForm.tsx`).
- **Activity Hub Tracking**: Synchronized tracking across "Giving & Lending" (outgoing loans) and "Receiving & Borrowing" (active loans with due dates and return reminders).

### 3. Community Box / Titik Komunitas (Status: Stable)
- **Locations & Volunteer Management**: Partner-hosted physical community boxes managed by authenticated volunteers and moderators.
- **QR Code Check-in**: Dynamic QR code generation (`GET /api/v1/points/qr-image/:qrId`) and resolution for physical access verification and contactless handoffs.
- **Audited Deposit Confirmation**: Two-stage stock confirmation ensuring deposited items are physically inspected and verified by box volunteers before public listing.
- **Stock Adjustments & Audit Trail**: Real-time inventory adjustments with mandatory reason logging (`damaged`, `expired`, `reallocated`, `stocktake_correction`).

### 4. Appliance / Peralatan Rumah Tangga (Status: Stable)
- **Physical Specifications**: Detailed appliance metrics including dimensions (length x width x height in cm), approximate weight (kg), and operational condition.
- **Pickup Access & Logistics Coordination**: Multi-story logistics details (floor level, elevator vs stairs accessibility, suggested helper count) ensuring recipients can prepare proper handling.
- **Self-Managed Transport**: Explicit recipient-managed transport coordination with transparent pickup guidelines and donor safety instructions.
- **Input Sanitization**: Robust client-side numeric sanitization in `ListingFormModal.tsx` mapping empty/zero values to `null` to strictly satisfy `ApplianceDetailsSchema` constraints without unhandled validation errors.

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

- **Loan Module Frontend-Backend Synchronization** (`apps/api/src/modules/loans/`, `apps/web/src/features/loans/`):
  - Fixed route mismatches by adding dedicated endpoints in `loans.routes.ts`: `GET /loans/incoming`, `GET /loans/outgoing`, and `GET /loans/listing/:listingId/booked` (alias for availability), preventing routing conflicts with `:loanId`.
  - Added robust `try/catch` error handling with `next(err)` and structured logger calls (`logger.info`) across all loan routes in `loans.routes.ts`.
  - Updated `loans.service.ts` availability handler to return both `items` and `booked` arrays containing `status` and `checkedOut` flags, ensuring compatibility with both `LoanRequestForm.tsx` and `BorrowModal.tsx`.
  - Re-aligned `loansApi.ts` `LoanSummarySchema` directly with `@neighbourhood/shared` `LoanSchema`, making supplementary UI fields (`listingCategory`, `listingPhoto`, `borrowerName`, `ownerName`, `message`) optional to prevent client-side Zod validation errors.
  - Updated `LoansListResponseSchema` to support cursor-based pagination and optional `total`.
  - Added safe fallback for loan status formatting in `BorrowModal.tsx` to prevent runtime `TypeError`.

- **Appliance Form Input Sanitization & Error Transparency** (`apps/web/src/features/listings/ListingFormModal.tsx`, `apps/api/src/lib/http.ts`):
  - Sanitized appliance specifications input in `ListingFormModal.tsx`: numeric fields (`approxWeightKg`, `dimensionsCm`, `suggestedHelpers`, `floorLevel`) now properly map invalid, empty, or zero values to `null` so they adhere to positive integer constraints (`min(1)`, `positive()`) in `ApplianceDetailsSchema`.
  - Enhanced Express `errorHandler` in `apps/api/src/lib/http.ts` to log full `errorMessage` and `stack` upon unhandled errors, and display the descriptive error message in development mode instead of an opaque `'Something went wrong'`.

- **Local Storage Driver & Missing Bucket Resilience** (`apps/api/src/lib/storage.ts`, `apps/api/src/modules/storage/storage.routes.ts`, `apps/api/src/modules/ask/ask.images.ts`, `apps/api/src/server.ts`):
  - Implemented `LocalFileObjectStorage` for listing photos and `LocalAskImageStorage` for Ask AI image attachments, writing directly to the ignored local directory (`uploads/`) with HMAC-SHA256 URL signing and verification.
  - Configured `server.ts` to automatically select local filesystem storage when `USE_FIREBASE_EMULATORS=true`, `STORAGE_DRIVER=local`, or when no remote storage bucket is present.
  - Added fallback resilience to `FirebaseObjectStorage` and `FirebaseAskImageStorage` so that missing Google Cloud Storage buckets (`The specified bucket does not exist`) transparently delegate to local filesystem storage in non-production environments.
  - Added comprehensive test coverage in `storage.test.ts` verifying file persistence, signed URLs, traversal protection, and bucket fallback behavior.

### Verified
- Automated type checks pass across all workspaces (`npm run typecheck` across `@neighbourhood/shared`, `@neighbourhood/api`, and `@neighbourhood/web`).
- Unit and domain rule tests pass (61 API unit tests passing, including all storage and fallback tests).
- Backend server running with watch mode on port 8080 with active `storageDriver: "local"`.
