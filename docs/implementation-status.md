# Implementation status

Last updated: 2026-10-17 (PostgreSQL + Google/email-OTP migration).

**Legend**: ✅ working and covered by tests · ⚙️ implemented, not yet tested live · 📄 contract only (endpoint returns 501) · ❌ not done

## Architecture now
- **Database:** PostgreSQL 17 via Prisma 7 (`apps/api/prisma/schema.prisma`, two migrations). Local Docker: `docker-compose.yml`, port **55432**, because another PostgreSQL already uses 5432 on the dev machine. Production target: Cloud SQL.
- **Firebase:** Authentication (Google + custom tokens), FCM and Cloud Storage only. Firestore and its rules, indexes and emulator have been removed.
- **Login:** "Continue with Google", or a 6-digit email code. The server verifies the code and then issues a Firebase custom token, so both methods produce a Firebase ID token for **the same Firebase user per email**.

## Checks run (2026-10-17)
| Check | Result |
|---|---|
| `npm run typecheck` / `lint` / `build` | ✅ pass |
| `npm test` | ✅ 81 tests: shared 33, api 45, web 3 |
| Prisma migrations against local Docker Postgres | ✅ applied (CHECK constraints, partial unique index, `btree_gist` exclusion constraint) |
| **PostgreSQL integration tests** (radius search, stock, loan conflicts, chat) | **NOT WRITTEN / NOT RUN.** `npm run test:db` config exists; `src/test/db-global-setup.ts` and `*.db.test.ts` still need writing. |
| **Live Google sign-in** | **NOT RUN.** |
| **Live email OTP** | **NOT RUN.** SMTP is not configured, so the endpoint correctly reports "not configured". |
| **Backend token verification against the real Firebase project** | **NOT RUN.** This machine has no Admin credentials (ADC); the server will answer `503 AUTH_NOT_CONFIGURED`. |
| Live Gemini call | **NOT RUN.** |
| Docker image after this change | **NOT RUN** (last built before the PostgreSQL change). |

## What works (✅)
- Token verification (revocation check). Only `google.com` and `custom` sign-in providers are accepted.
- Firebase UID → PostgreSQL `users` row, created only for a verified email. Email is unique, so a duplicate email returns `409 ACCOUNT_LINK_REQUIRED` and is never auto-merged. Disabled accounts are blocked.
- Server-controlled roles (`user_roles`, `community_memberships`); `grant-role` script by email.
- `GET /me`, `PUT /me/profile` (Postgres).
- Email OTP API (unit-tested with fakes):
  - code stored only as an HMAC;
  - 10-minute TTL and 5 attempts per code;
  - 60 s resend cooldown and 5 requests/hour per email, plus per-IP limits;
  - single use; delivery failures are reported honestly;
  - `GET /auth/methods` reports `email_delivery_not_configured` when SMTP is missing.
- Gemini needs extraction (unchanged).
- Web: Google button with popup → redirect fallback; email code form, which shows an "unavailable" notice when OTP isn't configured; explicit "Link Google account" on the profile page.

## Implemented, not tested live (⚙️)
- `listings.repository.ts`: geohash candidate ranges (`COLLATE "C"` index) + haversine filter in SQL.
- `requests.store.ts`: approve/cancel/expire/collect with `FOR UPDATE` + conditional stock `UPDATE`.
- `loans.store.ts`: approval locks the listing row, then `assertNoConflictingLoan`; the exclusion constraint maps to `CONFLICT`.
- `conversations.store.ts`: participants copied from the request/loan; participant check; keyset pagination.
- `FcmPushSender` (FCM) and `FirebaseObjectStorage` (V4 signed URLs). Not wired to routes yet.
- SMTP sender and the Firebase custom-token flow.

## Not done (❌)
- PostgreSQL integration tests (highest priority).
- Idempotency-Key middleware (the `idempotency_keys` table exists).
- Listing/request/loan/chat/notification HTTP endpoints. They still return 501 and should be built on the stores above.
- `docs/architecture.md` and `docs/api-contracts.md` still describe Firestore in places (marked with a banner).
- Cloud Run + Cloud SQL configuration is in the Dockerfile (`migrate` target) and `.env.example` only. No cloud resources were created.

## Needed before email OTP works
`OTP_SECRET` (≥ 32 random characters), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`. These come from an SMTP relay you choose (for example Google Workspace SMTP relay or a transactional email provider), with SPF/DKIM set up for the sender domain.
Firebase Admin must also be able to mint custom tokens:
- locally: `gcloud auth application-default login --impersonate-service-account=<SA>`;
- on Cloud Run: give the service account `roles/iam.serviceAccountTokenCreator` on itself.

## Known issues
- `npm audit`: high findings via the firebase web SDK's Firestore dependency (`@grpc/grpc-js`). The app doesn't import Firestore.
- The `nh-emu` container (Firestore emulator) is obsolete. Remove it with `docker rm -f nh-emu`.
