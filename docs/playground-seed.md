# Seed the complete marketplace journey

Run commands from the repository root with Node 24.12+. The script is additive:
stable IDs prevent duplicate scenarios, and rerunning the same arguments keeps
request/loan progress, stock, read markers and existing photos. It creates normal names
and product titles, without demo prefixes on the records.

## Local setup for teammates

Configure each app's ignored `.env` as described in the main README. Start local
PostgreSQL and the Auth/Storage emulators, then:

```sh
npm ci
npm run build:shared
npm run db:deploy -w @neighbourhood/api
npm run seed:playground -w @neighbourhood/api
npm run dev
```

The bundled [product photos](../apps/api/seed-assets/products) are uploaded to your
own configured bucket. No image-generation credentials or download step is
needed. Firebase identifiers must match between the API, web app and emulators.

To also populate an existing signed-in account, find its Firebase UID in Firebase
Auth and use the same UID on subsequent runs:

```sh
npm run seed:playground -w @neighbourhood/api -- --target-uid YOUR_FIREBASE_UID --grant-staff
```

The target's existing location is the scenario centre; if absent, the script
supplies a Jakarta location. Existing personal profile details and other records
remain intact. `--grant-staff` gives that target staff/category-editor access for
testing; it is optional. Target accounts become moderators of the seeded
communities. Each target/scenario combination has its own community/history
records; the photographed catalog and each resident's sample requests/loan are
shared across targets/scenarios, so they do not multiply products.

## Logins and data to explore

Open `http://localhost:5173/login` in separate browsers or private windows. Select
one of these local account buttons; no password is required by the emulator:

| Button | Profile | Main role |
|---|---|---|
| owner | Maya Santoso | Give items, approve incoming requests, lend |
| neighbour | Raka Putra | Request donations and borrow |
| volunteer | Ayu Lestari | Review deposits, inventory and collections |
| moderator | Dimas Pratama | Community membership, points, staff/category access |
| newcomer | Nina Sari | Resident with a pending membership in the second community |

Every account has a complete profile/location, outgoing requests, a sample loan,
conversations, read/unread updates, three saved needs, three bookmarked
items, Ask history, an
image input and deposits. Use Activity to inspect pending, approved, collected,
rejected, cancelled and expired requests. Seeded product owners also receive
incoming requests/loans. Loan states are distributed across the residents rather
than creating a new photographed listing for every status. Sharing points have pending
deposits, accepted stock/audit records and an inventory-backed listing.

The main catalog has 17 products across all six categories, each with its own
matching photo. It includes rice, paracetamol, surplus Nasi Goreng, pantry and
condiment bundles, a cobek, books, clothing, tableware, a rice cooker, tools,
walking frame, wheelchair and community boxed rice meals using the supplied
meal photo. Both community meal boxes and dry pantry parcels have separate
confirmed point inventory. Bundled photos describe the whole pictured set;
there are no standalone oil, noodles or ladder listings with unrelated photos.
Items are placed about 0.5–4.5 km from the initial centre. Open Explore,
enter a distance below the map and try category/offering filters. Map pins group
matching products by rounded public area; exact pickup coordinates remain
private. Requests and loans reference this same catalog instead of creating
repeated copies for Activity. A resident's own listings are excluded from search.
Catalog IDs use semantic product keys rather than array positions, so inserting
new food items cannot turn an existing books listing into a rice listing.

Try Ask: “Find a drill within 3 km”, then “Use 5 km”, or request an
absent item. Cards distinguish the requested radius from the wider check, show
farther matches separately and offer radius replies. No result within 50 km is
not a claim that the item does not exist anywhere.

Saved items is available from Profile or Saved needs. Try saving/removing an
actual product with its bookmark. In a neighbour conversation, use + to send
your own photo; unsent photos remain private to the uploader. Re-running the
seed restores its three sample bookmarks if removed. Surplus cooked food has a
same-day best-before date and ingredient notes; reruns never renew expiry dates.
Medicine listings are illustrative sealed/labelled sample content, not medical
recommendations or proof of actual stock.

For additional community/history fixtures without duplicating the catalog:

```sh
npm run seed:playground -w @neighbourhood/api -- --scenario round-two
```

Keep the target and scenario arguments consistent on reruns. Additional JPEGs
can be supplied with `--photos-dir /absolute/path`; filenames are lowercase
product titles with non-alphanumeric runs replaced by `-`, such as
`electric-rice-cooker.jpg`. Existing listing photos are preserved; if a matching photo's
bucket object is missing after an emulator restart, the script restores it from
the bundled asset. Historical seeded updates appear in the notification feed
without generating push deliveries.

`seed:demo` is now an alias of `seed:playground`, so running both commands cannot
add a second books/tool catalog. `--refresh-photos` explicitly replaces changed
catalog photos by uploading the replacement before removing the old photo.

## Repair older local seed data

Inspect first; equal titles/photos alone never trigger deletion:

```sh
npm run cleanup:duplicates -w @neighbourhood/api
npm run seed:playground -w @neighbourhood/api
npm run cleanup:duplicates -w @neighbourhood/api -- --apply --backup-dir /absolute/path/outside/repo
npm run smoke:seed-catalog
```

Use a Windows absolute path when running PowerShell. Set `PG_DUMP_PATH` if
`pg_dump` is not on PATH. Apply requires a successful full database backup and
backs up affected photo bytes. Cleanup recognizes old deterministic fixture IDs,
preserves resident accounts/profiles/needs and protects listings with real
requests or messages. Bookmarks are merged into the product matching the actual
old photo. Pass `--scenario NAME` to recognize an older named scenario.

Explicit `--merge-listing ID --into ID` supports a reviewed duplicate of the same
photographed product. It requires matching category/offering/photo, preserves
request/loan and conversation IDs, merges bookmarks and recomputes committed
stock. Cross-owner merges are limited to a recognized old seed product into an
unused-or-fixture-only catalog product, retaining the original owner. Never use
this to merge distinct neighbours' real goods just because their titles match.

## Production / hosted MVP later

Run from a trusted checkout or operator job with the production `DATABASE_URL`,
`FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `USE_FIREBASE_EMULATORS=false`
and application-default service-account credentials for Firebase Auth/Storage.
Remove emulator-host variables. Use your normal production provider settings
(including SMTP/OTP if signing into the seeded accounts by email).

Create an ignored local `playground-accounts.local.json` with five email addresses
you control:

```json
{
  "owner": "owner@your-domain.com",
  "neighbour": "neighbour@your-domain.com",
  "volunteer": "volunteer@your-domain.com",
  "moderator": "moderator@your-domain.com",
  "newcomer": "newcomer@your-domain.com"
}
```

After installing dependencies/building shared contracts, apply migrations and
seed using a production env file, for example from `apps/api`:

```sh
node --env-file=/secure/production.env ../../node_modules/prisma/build/index.js migrate deploy
node --env-file=/secure/production.env --import tsx scripts/seed-playground.ts --allow-production --accounts-file /secure/playground-accounts.local.json --target-uid YOUR_PRODUCTION_FIREBASE_UID
```

The target must already have signed in once so its app account exists. The five
seeded Firebase UIDs are stable (`demo-owner`, etc.); normal profile names are
used in the app. A rerun does not change their existing Firebase email addresses.
The moderator account is granted staff/category-editor roles; protect its email
access accordingly. Add `--grant-staff` only if the target also needs those
platform permissions. Production does not expose the emulator's account-switch
buttons: use normal email OTP or linked sign-in. The script does not configure
SMTP, deploy services or send messages to real neighbours.

This hosted path is documented, not executed as part of the local seed run.
