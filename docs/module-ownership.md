# Module ownership

> Historical ownership split. `feat/marketplace-integration` now combines both
> engineer branches and fills missing services under the user's authorization.
> Use [implementation-status.md](implementation-status.md) and
> [integration-handoff.md](integration-handoff.md) for current dependencies.

> **Updated 2026-10-17: architecture change.** PostgreSQL (Prisma 7 migrations; Cloud SQL in production) has replaced Firestore.
> Sign-in now uses **Google** or a **numeric email OTP** (both via Firebase Auth; there are no passwords).
> Firebase still provides Authentication, FCM and Cloud Storage. Any section below that mentions Firestore collections, rules or the Firestore emulator is out of date.
> For current details, see `docs/implementation-status.md` and `apps/api/prisma/schema.prisma`.


| Area | Owner | Backend | Frontend | Shared contracts |
|---|---|---|---|---|
| Foundation, config, deploy, integration | **Arung** | `apps/api/src/{app,server,config}.ts`, `lib/`, `Dockerfile`, `firebase.json`, rules, indexes | `src/{main,App}.tsx`, `lib/`, `components/`, `pwa/`, `sw.ts`, `i18n/` | `common.ts`, `enums.ts`, `routes.ts` |
| Auth & profiles | **Arung** | `modules/auth`, `modules/profiles`, `scripts/grant-role.ts` | `auth/`, `features/auth`, `features/profile` | `contracts/profiles.ts` |
| Gemini adapter & needs extraction | **Arung** | `modules/ai` | `features/needs` (extraction form) | `ai/contracts.ts` |
| Listings & appliance details | **Engineer 1** | `modules/listings` | `features/listings` | `contracts/listings.ts`, `geo.ts` |
| Lending | **Engineer 1** | `modules/loans` | `features/activity` (loans tab, with E2) | `contracts/requests-loans.ts` (Loan*), `domain/rules.ts` |
| Communities, points, QR, volunteers, stock adjustments | **Engineer 1** | `modules/communities` | `features/communities` | `contracts/communities.ts` |
| Photo-assisted listing drafts | **Engineer 1** (consumer) + Arung (adapter) | `modules/ai` route `listing-draft` | listing create form | `ai/contracts.ts` (ListingDraft*) |
| Needs saving & matching | **Engineer 2** | `modules/needs`, `modules/ai` route `match-explanations` | `features/needs` (save + matches) | `ai/contracts.ts` (Match*) |
| Ask chat agent, sessions, tools and action cards | **Engineer 2** + Arung (Gemini adapter/config) | `modules/ask` | `features/ask`, `features/needs/SavedNeedsPage.tsx` | `contracts/ask.ts` |
| Donation requests & handover | **Engineer 2** | `modules/requests` | `features/activity` | `contracts/requests-loans.ts` (DonationRequest*) |
| Chat | **Engineer 2** | `modules/conversations` | `features/messages` | `contracts/messaging.ts` |
| Notifications & push | **Engineer 2** | `modules/notifications` | `features/notifications`, FCM in `sw.ts` (coordinate with Arung) | `contracts/messaging.ts` |
| Product categories | **Engineer 1** (listing creation/filter) + **Engineer 2** (discovery) | existing listings/needs modules | `features/categories` and listing discovery | `enums.ts` (`ItemCategorySchema`) |
| Domain state machines & stock | shared (review by all) | – | – | `domain/*` |

## Working agreements

1. **Contracts first.** Before implementing an endpoint, confirm or extend its
   schema in `packages/shared` and update `docs/api-contracts.md` in the same
   PR. Flip the status from 🟡 to ✅ only once tests cover it.
2. **Shared package changes need a reviewer from each affected owner.**
   Additive changes (new optional fields, new schemas) are cheap. Renames,
   removals and state-machine changes need agreement first.
3. **Stay inside your module.** If you need something from another module,
   call its service interface or ask for one. Don't read its Firestore
   collections directly. The exception is cross-module transactions (for
   example, request approval touching listing stock): put them in the owning
   service (requests) and agree the listing-side helper with Engineer 1.
4. **Authorization lives in services.** Use `authUser(req)`,
   `assertCommunityRole`, `requirePlatformRole`, `assertTransition`, and never
   take uids or roles from bodies.
5. **Replace planned endpoints in place.** Each module's `*.routes.ts`
   currently registers 501 stubs via `plannedRouter`. Swap entries for real
   handlers and keep the paths stable.
6. **Frontend**: keep features under `features/<module>`, use `api()` with the
   shared response schema, add strings to `i18n/en.ts`, and never show a button
   for an action the backend can't do yet.
7. **Tests**: every new transition or permission rule gets a unit test
   (shared) and an HTTP-level authorization test (api, with fakes from
   `src/test/fakes.ts`).
8. Run `npm run check` (typecheck, lint, test, build) before opening a PR.

## Current integration tasks

- **Engineer 1**: finish `POST /listings` and `GET /listings` with public DTOs,
  then embed `RequestItemForm` on active donation listings and add authorized
  pickup details. Continue communities and lending after the first demo path.
- **Engineer 2**: connect saved needs to eligible active listings for grounded
  matching, then add FCM delivery, token registration and automatic expiry.
  The request, chat, inbox and saved-needs APIs are implemented and documented in
  `docs/engineer2-handoff.md`.
