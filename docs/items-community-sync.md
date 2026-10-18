# items-community integration

Merged peer commit `23b2961` into `feat/mobile-first-ui` on 2026-10-18.
The peer branch adds local photo adapters, upload-contract fixes, normalized
listing appliance fields, loan route aliases and sorted booked-date responses.
Our streaming Ask, approved publication with photos, private neighbour message
attachments, saved items and Profile location handoffs remain in place.

Git conflicts were in `ask.images.ts` and `server.ts`: the peer image constructor
added a fallback argument in the position used by our private-image prefix.
The combined constructor preserves the prefix and accepts optional fallback
separately. Private conversation and AI cleanup continue to scan their own paths.

The server, maintenance job and playground seed now share storage selection.
A configured Firebase bucket remains authoritative, including with emulators.
This preserves existing seeded and uploaded photos. Local development can use
`STORAGE_DRIVER=local` and optionally an absolute `STORAGE_LOCAL_DIR`. All local
adapters share that root but isolate listing, AI and neighbour-message paths.
Deployed/production processes reject local disk mode. A bucket outage is reported
instead of silently splitting photos between bucket and temporary disk.

To use local disk deliberately, set the same environment for the API, seed and
maintenance commands, then rerun the seed. Existing bucket objects are not
automatically copied. Keep uploads and environment files ignored by Git.
The optional low-level fallback adapters remain available for explicit callers.

The incoming/outgoing/booked loan aliases reuse the existing authorized service,
including approval locks, date overlap checks, participant access and idempotency.
The current item-details page continues to use `LoanRequestForm` and Activity's
existing loan controls. The peer's additional `BorrowModal` and store convenience
methods are retained but are not wired into those screens by this integration.

Unexpected server errors retain the existing generic response and sanitized log
metadata; raw database errors or stacks are not returned to browsers or logged.
No new migration or dependency version was introduced by the merge; the lockfile
retains the installed versions despite the peer's compatible range changes.

Validation on 2026-10-18:
- `npm run check`: type checks, lint, 102 unit tests and API/web/PWA builds passed.
- `npm run test:db`: all 54 tests passed against an isolated PostgreSQL database,
  including the incoming/outgoing/booked loan aliases and overlapping approvals.
- Local migration deployment found all 11 migrations applied, with none pending.
- `npm run smoke:marketplace`: two mobile browser sessions passed publication
  with an uploaded photo, actual Gemini discovery/extraction/matching, Ask photo
  review and explicit publication, requests/collection, loan approval/checkout/
  return, community membership, point deposits, inventory publication and QR access.
- `npm run smoke:conversations-saved`: two browsers passed private photo upload,
  participant-only visibility, product thumbnails and saved-item persistence.
- The smoke scripts honor their selected API URL; the marketplace script also
  waits for streaming completion instead of parsing NDJSON as a single JSON body.

Browser verification used fresh local servers on ports 18080 and 15173 after
older running dev processes produced a stale response-contract failure. Restart
existing dev servers after installing merged dependencies. Disposable fixture
users, database records and bucket photos were removed after the smoke tests.
Build warnings about bundle size/PWA options and the install's seven dependency
audit findings remain; this merge does not upgrade their locked versions.
