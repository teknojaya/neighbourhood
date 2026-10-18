# Marketplace integration handoff

Updated 2026-10-17 on `feat/marketplace-integration`. Source parents are
Engineer 2 `5e5b59e` and Engineer 1 `484c482` (`items-community`). No PR requested.

## Delivered behavior

Donation and single-unit lending, radius/keyword discovery, saved needs/matching,
private pickup/chat, community membership and points, volunteer deposit review,
audited physical stock and inventory-backed point listings are connected.
Appliance forms capture dimensions, power, weight and pickup access. Recipients
arrange their own transport.

Ask reaches these services through typed tools and cards: private sessions and
history, camera/file input, streamed progress, photo-assisted drafts, secure
publication review, confirm/cancel and interrupted-action recovery. Direct
mobile controls remain available. Exact home/pickup details stay out of model
context. The former special assistance feature is ordinary product categories.

Engineer 1 integration fixes include real loan/community services, transactional
stock and permissions, bucket-backed photo upload/removal, removal of public
upload access, and untracking a local image while preserving the original file.

## Local demo

Use Node **24.12+**, PostgreSQL 17, Java **21+**, and `npm ci`. Preserve existing
ignored env files. Current native PostgreSQL uses **5432/neighbourhood**; Docker
Compose offers **55432/neighbourhood**. Set `DATABASE_URL` accordingly, with a
separate disposable `TEST_DATABASE_URL`.

For local Firebase use project `demo-neighbourhood`, a matching demo bucket,
`USE_FIREBASE_EMULATORS=true`, Auth `127.0.0.1:9099`, Storage `127.0.0.1:9199`,
and matching web demo configuration. Production refuses emulator variables.

```sh
npm run db:deploy -w @neighbourhood/api
npm run emulators
# Another terminal, after emulators are ready:
npm run seed:demo -w @neighbourhood/api
npm run dev
```

Open http://localhost:5173. Emulator-only sign-in offers Owner, Neighbour and
Volunteer. Seed data includes donation books, a lendable tool set and a community
point; volunteer has local staff/moderator permissions. Seeding refuses real
Firebase/non-local DBs and does not reset existing profiles.

Set API `GEMINI_API_KEY` and `GEMINI_MODEL` for live AI. Ignored workspace `env/`
credentials were used locally without staging them. No server secret belongs
in a `VITE_` variable. Without Gemini, the UI reports AI unavailable.

## Migrations and maintenance

Nine migrations are applied to the actual local DB and isolated test DB. Four
integration migrations add notification delivery, bounded action recovery, Ask
progress and inventory-backed point listings. Do not rewrite applied migrations.
Check with `npm run db:status -w @neighbourhood/api`.

`npm run migrate:photos -w @neighbourhood/api` imports only database-referenced
legacy disk photos, normalizes them into the bucket and preserves original
files. Local execution found zero referenced photos. The inventory migration
pauses unbacked legacy point listings; volunteers publish confirmed stock.

```sh
npm run maintenance -w @neighbourhood/api
# Built runtime / Cloud Run Job:
node apps/api/dist/maintenance.js
```

Maintenance expires donation reservations, processes leased push outbox work,
purges deleted sessions and removes unreferenced photos older than 24 hours.
Domain writes remain transactional and retry safe. Push is at least once, so a
rare duplicate alert is possible. Local API timers are convenient; production
requires a scheduled job because Cloud Run request-based CPU may stop between
requests. Schedule every minute using the same DB/bucket/secrets; see official
[Cloud Run scheduling](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule).

## Production prerequisites

1. Provision Cloud SQL, Firebase/private Storage bucket, Artifact Registry and
   a runtime service account. Grant the needed Cloud SQL, bucket object, Auth
   verification/custom-token and Secret Manager permissions.
2. Store `DATABASE_URL`, `GEMINI_API_KEY`, `OTP_SECRET`, SMTP credentials and
   **`STORAGE_SIGNING_SECRET`** in Secret Manager. Signing secret must be at
   least 32 random characters and shared across instances. Local random signing
   secrets reset listing photo URLs on restart.
3. Enable Google sign-in and authorize the deployed domain. Email OTP requires
   a configured SMTP sender. Passwords are not an application sign-in flow.
4. Build Docker `migrate` target and run `prisma migrate deploy` against Cloud
   SQL before rolling out `runtime`. Supply public Firebase web build args;
   keep emulator mode off. Configure project, bucket, Gemini model and Cloud
   SQL connection. `/healthz` is the service health check.
5. Deploy deny-all direct Storage rules. Authorized API/Admin operations access
   objects. For opt-in push, build with public `VITE_FIREBASE_VAPID_KEY` and set
   API `PUSH_ENABLED=true` only with working real FCM credentials. The existing
   PWA worker handles generic alerts; no FCM emulator exists.
6. Schedule maintenance, then verify HTTPS sign-in, real bucket operations,
   OTP delivery, push opt-in/delivery/revoke and mobile installation.

No cloud resources/deployment were created. Existing ADC needs reauthentication
(`invalid_grant`), so real bucket verification is blocked until the intended
Google account is reauthenticated. SMTP sender settings and VAPID key are absent.

## Verification record

- `npm run check`: typecheck, lint, **92 unit tests**, API and PWA builds.
- `npm run test:db`: **44 PostgreSQL integration tests**, covering permissions,
  stock/overlap concurrency, physical inventory, action recovery and cancellation.
- All **nine migrations** deployed locally and to the isolated test DB.
- Real Gemini discovery, structured extraction, grounded matching, private
  image understanding, saved-need confirmation and persisted history.
- Two-account **390×844 mobile** donation journey using the real local API,
  DB and Storage emulator; Ask photo/draft/review/publication and request,
  approval, private pickup/chat, collection; mobile borrowing through return;
  secure Ask point creation, membership, deposit review and inventory publication.
  Major routes checked for browser
  runtime errors and horizontal overflow.
- `npm audit --omit=dev`: **zero production vulnerabilities**. Development
  Firebase CLI dependencies retain seven advisories; no forced breaking
  dependency replacement was applied.

Real SMTP, FCM and cloud bucket delivery remain unverified. Docker CLI cannot
reach the installed Linux engine, so container execution remains unverified.
These provider/runtime checks do not depend on Engineer 1 work.
