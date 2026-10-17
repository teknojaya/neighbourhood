# Seed the complete marketplace journey

Run commands from the repository root with Node 24.12+. The script is additive:
stable IDs prevent duplicate scenarios, and rerunning the same arguments keeps
request/loan progress, read markers and existing photos. It creates normal names
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
communities. Each target/scenario combination has its own stable record IDs.

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

Every account has a complete profile/location, incoming and outgoing requests,
loans, conversations, read/unread updates, three saved needs, three bookmarked
items, Ask history, an
image input and deposits. Use Activity to inspect pending, approved, collected,
rejected, cancelled and expired requests. Loans cover pending, approved,
checked-out, returned, rejected and cancelled states. Sharing points have pending
deposits, accepted stock/audit records and an inventory-backed listing.

The main catalog covers all six categories. Items are placed about 0.5, 1.2, 1.8,
2.2, 2.6, 2.8, 4.5, 6.5, 9, 16, 28, 44 and 65 km from the centre. Open Explore,
enter a distance below the map and try category/offering filters. Map pins group
matching products by rounded public area; exact pickup coordinates remain
private. The 65 km item intentionally falls outside the supported 1–50 km search.
Workflow-specific listings live farther out so the nearby feed starts with a
varied catalog. A resident's own listings are excluded from their search.

Try Ask: “Find a sewing machine within 3 km”, then “Use 20 km”, or request an
absent item. Cards distinguish the requested radius from the wider check, show
farther matches separately and offer radius replies. No result within 50 km is
not a claim that the item does not exist anywhere.

Saved items is available from Profile or Saved needs. Try saving/removing an
actual product with its bookmark. In a neighbour conversation, use + to send
your own photo; unsent photos remain private to the uploader. Re-running the
seed restores its three sample bookmarks if removed.

For a fresh independent scenario without resetting existing work:

```sh
npm run seed:playground -w @neighbourhood/api -- --scenario round-two
```

Keep the target and scenario arguments consistent on reruns. Additional JPEGs
can be supplied with `--photos-dir /absolute/path`; filenames are lowercase
product titles with non-alphanumeric runs replaced by `-`, such as
`sewing-machine.jpg`. Existing listing photos are preserved; if a matching photo's
bucket object is missing after an emulator restart, the script restores it from
the bundled asset. Historical seeded updates appear in the notification feed
without generating push deliveries.

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
