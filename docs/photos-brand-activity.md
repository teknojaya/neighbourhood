# Photos, Activity and brand

Every published item needs a photo. `POST /listings` creates a private draft;
upload at least one photo, then `POST /listings/:id/transition` with
`{"to":"active"}`. The activation check runs under the listing lock. Removing
the last photo is rejected; upload a replacement first. Draft creation and each
upload/activation retain their own idempotency keys, so a failed upload can be
retried without exposing an incomplete item. Owners can resume a private draft
from Activity → Shared items. Community stock uses the same photo requirement.

Ask asks for a photo first, saves known draft facts across answers, and returns
one next missing question instead of an incomplete review card. The current
draft is supplied independently of the bounded chat history. Quantity and
condition remain user-confirmed facts. Ask publication requires a photo at both
proposal and confirmation, and activates only after the photo copy succeeds.
Old history still parses, including old proposals without photos; those
proposals cannot publish. Publication still requires the resident's Confirm.

## Local data cleanup

The playground seeder now uses photographed goods for all distance, request and
loan scenarios. All product images are committed in
`apps/api/seed-assets/products/`. The simple demo seed also uploads photos before
activation. Run the usual seed command after starting PostgreSQL and Firebase
Auth/Storage emulators:

```powershell
npm run seed:playground -w @neighbourhood/api
# To add scenarios to your existing account:
npm run seed:playground -w @neighbourhood/api -- --target-uid YOUR_FIREBASE_UID
```

For older local data, inspect first:

```powershell
npm run cleanup:photos -w @neighbourhood/api
```

To remove listings with no readable photo, provide a backup folder outside the
repository. The command refuses to delete anything unless a full PostgreSQL
custom-format backup succeeds. Set `PG_DUMP_PATH` if `pg_dump` is not on PATH.

```powershell
$backupDir = Join-Path (Split-Path (Get-Location).Path -Parent) 'neighbourhood-backups'
npm run cleanup:photos -w @neighbourhood/api -- --apply --backup-dir $backupDir
npm run seed:playground -w @neighbourhood/api
```

Cleanup also removes the selected listings' requests, loans, conversations,
saved-item references and linked notifications. It preserves user accounts,
profiles, saved needs and Ask history. Point reservations are released. An item
changed during inspection is not deleted. The cleanup command is local/emulator
only; production cleanup needs a separately reviewed plan and backup. No schema
migration is required for this release. Restore a backup with `pg_restore` into
a separate database first to inspect it.

## Brand and UI

The supplied peer logo is copied into `apps/web/public/brand/`; supplied PWA
icons and derived 32px/180px icons are in `apps/web/public/icons/`. SVG/PNG
favicons, Apple touch icon, PWA manifest and theme colour use the new identity.
The original SVG geometry and wordmark are preserved. Primary actions use
`#166534`, with `#14532d` text, logo green `#22c55e`, charcoal `#24332b`, and the
supplied blue connector accent. White on the primary green exceeds WCAG AA.

Activity uses labelled tab icons, real product thumbnails, readable date ranges
and text/icon status badges. Loan actions use verbs and retain confirmation.
Thumbnails load lazily. Profile has identity, described navigation, a private
location summary, the existing location form and collapsible preferences.

## Validation

```powershell
npm run check
npm run test:db
npm run smoke:brand-activity
npm run smoke:ask-recovery
```

The brand smoke uses real local API/Auth/Storage and captures 320px, 440px and
1440px layouts. It exercises navigation, product photos, location controls and
the photo-required direct publication form. Regression coverage includes
missing-photo activation, last-photo protection, approval-only Ask publication,
next-question handoff and draft continuity beyond the history window. Real
Gemini behavior remains subject to the configured provider's quota.

Validated locally on 2026-10-18: 107 unit tests, 60 isolated PostgreSQL tests,
type checks, lint, API/web/PWA builds, the brand/Activity smoke, Ask recovery
smoke and two-browser messaging/bookmark smoke passed. The local database was
backed up before removing 127 listings without readable photos; after rebuilding
the default and existing-account scenarios, a storage audit found zero such
listings. Live Gemini generation was not exercised in this pass; the preceding
agent pass reached the provider quota. The deterministic model/tool tests cover
the new context and clarification behavior.
