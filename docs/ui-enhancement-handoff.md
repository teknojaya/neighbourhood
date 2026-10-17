# Mobile-first UI enhancement

Branch: `feat/mobile-first-ui`, starting at integration commit `78930d6`. No PR or deployment. This pass preserves the integrated marketplace write and storage contracts and adds one authorized unread-count endpoint; it requires no new migration or environment variable.

## What changed

- Home shows nearby inventory with All / Free / Borrow, a prominent Ask entry, and an explicit Donate / Share action opening `/share`. View all carries the selected offering into Explore.
- Explore keeps search, category, radius and offering in the URL. Item cards show the existing public area label alongside distance. Profile lets residents include neighbourhood, city and region in that label; there is no inferred city or reverse geocoding.
- Ask has an immediately usable composer. Opening the tab, choosing a starter or pressing New chat does not create an empty server session. The first send or photo creates it. History is a native modal dialog; the conversation scrolls independently of its composer and navigation.
- Activity separates requests, loans and shared items and respects record deep links. Supporting pages share the same type, controls, spacing, loading and empty states.
- Messages use a conversation dock. Unsent Ask and neighbour-message text lives only in memory, scoped to the authenticated identity and thread, and is cleared on identity change or sign-out. Attachments and private API payloads are not persisted by this mechanism.
- Direct Share drafts retain entered facts, private notes and the selected photo in account-scoped browser memory through navigation. Cancel returns to the launch page; deliberate discard, successful publication and sign-out clear the draft. Refreshing clears it too. No form draft is written to disk or uploaded until publication.
- Header Messages and Updates utilities show genuine unread counts and accessible names. `GET /notifications/unread` counts authorized messages and updates across all pages; read operations invalidate the counts.
- Item details use factual owner attribution and explain the approved-pickup restriction. Loan availability depends on dates, rather than a donation-style stock counter. Appliance and access facts are visible in item details and AI confirmation previews.
- Community points use their own coordinates in the secure form. Creating one does not change the volunteer’s home location. QR, deposits and volunteer controls remain authorized by the server.
- Skeletons represent pending requests. Empty results explain the next available action. Reduced-motion settings disable pulsing and transitions.

## Verification

`npm run check` covers type checking, lint, 92 existing unit tests and the production/PWA build. `npm run smoke:marketplace` was updated for the new routes and controls and passed against the real local PostgreSQL database, Auth/Storage emulators and Gemini: first-send session creation, first-photo session creation, reviewed AI publication, donation request/approval/private pickup/chat/collection, single-unit loans, point creation with independent coordinates, deposits and inventory-backed publication. One earlier Gemini search returned `AI_INVALID_OUTPUT`; the later complete run passed. Test fixtures were removed, including two users left by an interrupted loopback connection attempt.

`npm run smoke:ui` is a read-only navigation/capture harness using the local seeded demo and Edge. It checks Home's direct sharing action, the Home-to-Explore offering, Share facts/private notes/photo recovery after a Profile round trip, origin-aware cancellation, discard, chat draft retention, Escape behavior for history, sign-out isolation, an actual delayed-request skeleton, real empty results, composer bounds at 390×520, and horizontal overflow. The settled capture manifest contains 40 screenshots: the main routes at 390×844 and 1440×900, Home/Ask at 320/440/533 pixels wide, loading/empty states, restored Share drafts and sign-in. The in-app browser has no viewport resize API; the repository's browser test harness supplies these dimensions. Captures are local and ignored by Git. The manual Impeccable 4.6.0 detector returned no findings before the review-fix batch; it was not rerun.

`npm run smoke:unread` passed against the real local services with disposable fixtures: accessible header counts, 26 global unread updates despite a 20-entry inbox page, message-read clearing, update-read decrementing, and a newer message raising the count again. `npm run test:db` passed 45 integration tests against a separate PostgreSQL test database, including authorization isolation and message read-watermark behavior for the new endpoint. All nine existing migrations were current; the temporary test database server was stopped afterward.

The final full marketplace smoke also passed after the review fixes, including successful-publication draft cleanup and Activity-origin cancellation. The final `npm run check` passed all 92 unit tests, type checking, lint and production/PWA builds.

## Impeccable finish review

An independent reviewer loaded the installed Impeccable 4.6.0 role in a fresh agent context and reviewed the approved structure, captures and source. Its initial disposition was `fix` for two workflow omissions: Share draft/origin recovery and genuine unread signaling. The verdict pass scored both fixes **resolved** and returned `ship` for those two fixes; this is not a certification of every device, permission state or role combination. The detailed review/capture evidence is retained locally under `apps/web/.impeccable/review/` and ignored by Git. The documented system is in `apps/web/DESIGN.md` and `apps/web/.impeccable/design.json`.

## Limits

- A shortened browser viewport tests dock layout; it does not certify physical iOS/Android keyboard behavior or replace device and screen-reader testing.
- App menus remain English. Ask supports English and Indonesian; Profile labels the stored preference honestly.
- City/region is the resident's public area label, not independently verified location metadata. Exact coordinates and pickup instructions retain their existing private server boundaries.
- The existing production bundle size and PWA tooling deprecation warnings remain. Real bucket credentials, SMTP and web-push configuration still follow `integration-handoff.md`; this UI pass does not claim those external release checks are complete.
- Finish-review disposition and design-system evidence are recorded under the web app's Impeccable artifacts and `DESIGN.md`.
