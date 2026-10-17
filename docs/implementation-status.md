# Implementation status

Last updated: 2026-10-17 (Engineer 2 requests, communication, saved needs and Ask agent foundation).

**Legend**: ✅ working and covered by tests · ⚙️ implemented, not yet tested live · 📄 contract only (endpoint returns 501) · ❌ not done

## Architecture now
- **Database:** PostgreSQL 17 via Prisma 7 (`apps/api/prisma/schema.prisma`, five migrations). Local Docker: `docker-compose.yml`, port **55432**, because another PostgreSQL already uses 5432 on the dev machine. Production target: Cloud SQL.
- **Firebase:** Authentication (Google + custom tokens), FCM and Cloud Storage only. Firestore and its rules, indexes and emulator have been removed.
- **Login:** "Continue with Google", or a 6-digit email code. The server verifies the code and then issues a Firebase custom token, so both methods produce a Firebase ID token for **the same Firebase user per email**.

## Checks run (2026-10-17)
| Check | Result |
|---|---|
| `npm run typecheck` / `lint` / `build` | ✅ pass |
| `npm test` | ✅ 90 tests: shared 32, api 54, web 4 |
| Prisma migrations against isolated local PostgreSQL 17 | ✅ five migrations applied (domain constraints, legacy category flow archival, Ask sessions/history/images/actions and upload retries) |
| **PostgreSQL integration tests** | ✅ 35 tests cover Engineer 2 requests, stock, idempotency, private chat, inbox, saved needs and Ask sessions/tools/actions against isolated local PostgreSQL 17. Radius search and loan conflicts still need their own integration tests. |
| **Live Google sign-in** | **NOT RUN.** |
| **Live email OTP** | **NOT RUN.** SMTP is not configured, so the endpoint correctly reports "not configured". |
| **Backend token verification against the real Firebase project** | **NOT RUN.** This machine has no Admin credentials (ADC); the server will answer `503 AUTH_NOT_CONFIGURED`. |
| Developer PostgreSQL migration deployment | ✅ all five migrations applied; schema up to date on the local database at port 5432 |
| Live Gemini + local Auth/Storage emulators | ✅ real tool calls, edited need confirmation/replay, private photo upload/read/retry, image understanding, separate sessions, chat deletion preserving saved needs; disposable fixtures removed |
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
- Engineer 2 donation request API: create, incoming/outgoing, detail and transitions, with atomic stock accounting, conversation creation, generic inbox events and 24-hour idempotency replay.
- Participant-only chat endpoints, stable message paging and unread counts; read acknowledgements use a message the user has loaded.
- In-app notification inbox and read acknowledgement.
- Reviewed AI drafts can be saved as private needs and deleted; caller-only access and retry safety are covered by PostgreSQL tests.
- Ask is now a conversational UI with private sessions/history, bounded Gemini function calls, private image attachments, persisted listing drafts and editable action cards. Tools reuse request/chat/inbox/needs services. See `docs/ask-agent-handoff.md` for exact capabilities and limits.
- Photo decoding, metadata stripping, dimension limits, upload replay and authenticated image reads. Firebase Storage emulator verified; production Storage credentials remain unverified.
- Separate saved-needs page, chat deletion independent of saved needs, and retryable deletion/orphan cleanup with the `cleanup:ask` maintenance command.
- Web Activity, Messages and Notifications pages, plus an embeddable donation request form. Mobile-width browser smoke check passed at 390 px using mocked API responses.
- Product categories replace the special assistance feature in the active UI, AI contracts and routes; historical case data is archived by migration.
- Web: Google button with popup → redirect fallback; email code form, which shows an "unavailable" notice when OTP isn't configured; explicit "Link Google account" on the profile page.

## Implemented, not tested live (⚙️)
- `listings.repository.ts`: geohash candidate ranges (`COLLATE "C"` index) + haversine filter in SQL.
- `requests.store.ts`: approve/cancel/expire/collect with `FOR UPDATE` + conditional stock `UPDATE`.
- `loans.store.ts`: approval locks the listing row, then `assertNoConflictingLoan`; the exclusion constraint maps to `CONFLICT`.
- `conversations.store.ts`: participants copied from the request/loan; participant check; keyset pagination.
- `FcmPushSender` (FCM) and `FirebaseObjectStorage` (V4 signed URLs). Not wired to routes yet.
- SMTP sender and the Firebase custom-token flow.

## Not done (❌)
- PostgreSQL integration tests for radius search and loan conflicts.
- Listing and loan HTTP endpoints. They still return 501; Engineer 1 owns them.
- Grounded matching, FCM token registration/delivery, and automatic request expiry. These remain Engineer 2 follow-up work.
- Ask listing search/publication, loan and community tools wait for Engineer 1's services; token streaming and the remaining marketplace tool groups are not implemented. Gemini is configured in the ignored local API environment file.
- `docs/architecture.md` and `docs/api-contracts.md` still describe Firestore in places (marked with a banner).
- Cloud Run + Cloud SQL configuration is in the Dockerfile (`migrate` target) and `.env.example` only. No cloud resources were created.

## Needed before email OTP works
`OTP_SECRET` (≥ 32 random characters), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`. These come from an SMTP relay you choose (for example Google Workspace SMTP relay or a transactional email provider), with SPF/DKIM set up for the sender domain.
Firebase Admin must also be able to mint custom tokens:
- locally: `gcloud auth application-default login --impersonate-service-account=<SA>`;
- on Cloud Run: give the service account `roles/iam.serviceAccountTokenCreator` on itself.

## Known issues
- The `nh-emu` container (Firestore emulator) is obsolete. Remove it with `docker rm -f nh-emu`.
