# NeighbourHood product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Local residents looking for useful physical items, donating things they no
longer need, or lending and borrowing items temporarily. The same resident can
give, receive, lend and borrow; these are contextual roles rather than separate
accounts. Community volunteers and moderators manage partner collection points,
membership, received deposits and physical stock. Staff have server-controlled
platform permissions.

## Product Purpose

A neighbourhood marketplace that helps people find, donate and borrow nearby
items. Its intended experience is AI-native and mobile-first. Ask lets people
describe what they need or want to share, attach photos, discover live inventory
and prepare marketplace actions. Success means a useful item reaches a neighbour
through an approved, completed pickup, or a borrowed item is returned.

## Positioning

Conversation is an entry point into real neighbourhood inventory and actions.
The agent calls authorized marketplace services and presents review cards for
explicit confirmation. It must not invent listings, availability, successful
actions or neighbours' eligibility. Direct browsing and forms remain available.

## Operating Context

- Hackathon project with an existing React/Vite PWA and Express API, shared
  contracts, PostgreSQL migrations, Firebase Auth/Storage/FCM and server Gemini.
- Local demo accounts and emulator data support demonstrations; they are not
  evidence of real adoption, verification, partnerships or production delivery.
- Residents collect from the owner or a community point. They arrange their own
  transport, helpers, dismantling and installation when relevant.
- Donation requests and single-unit loans have distinct approval, handover and
  completion states. Volunteers confirm physical deposits and stock changes.
- The user requested a complete UI shaping pass, including resident and
  volunteer surfaces. Home should show nearby items with a prominent Ask entry;
  Ask remains its own destination.

## Capabilities and Constraints

- Ordinary product categories cover groceries, clothing, books, household items,
  appliances and mobility aids. The former special assistance terminology was
  explicitly replaced with ordinary product categories.
- Search uses a confirmed location and a manual whole-kilometre radius from
  1–50 km, with 1/3/5/10 km profile presets. A neighbourhood label
  alone does not replace coordinates. Public locations are approximate.
- Explore opens an OpenStreetMap view of the resident's own saved search
  point and selected radius below its title; it can be hidden. Panning does not move the search centre; Profile
  changes it. Tile loading shares the viewed area with the provider; exact
  product pins group rounded public areas, while exact neighbour pickup
  locations are not drawn. No geocoding service is implemented.
- Requests reserve/release/collect stock transactionally. Loans require dates,
  overlap protection, checkout and return. UI changes must preserve these rules.
- Ask has private sessions/history, photos, listing drafts, typed action cards,
  confirmation/cancellation/recovery and streamed progress. Saved needs are
  independent of chat deletion.
- Bottom navigation uses Home, Explore, Start, Activity and Profile. Start opens
  Ask. Activity opens Shared items by default, followed by Requests and Loans;
  explicit request/loan links still open the relevant tab. A permanent sharing
  banner and a navigation bubble open the direct Share form.
- Notifications group loaded updates into Unread and Read updates, with the
  global unread count independent of pagination. Opening an unread destination
  or choosing Mark as read refreshes that count.
- Publication reviews lead with photos and essential facts, with private pickup
  details available in a disclosure. Explicit confirmation remains required.
- Assistant replies stream live. New tasks ask one to four focused questions
  for missing facts, with one question at a time and choices that send immediately. Complete follow-ups
  avoid repeated questions. Photos preview before first send, stay attached to
  their draft, and appear on publication review. Ask can prepare publication
  using the saved Profile pickup area; the resident explicitly confirms it.
- Ask reads a curated product guide for product terminology and workflows. Its
  account tool reads the caller's real roles/membership statuses without home
  coordinates or email. The neighbour label does not imply community membership.
- Search cards state the requested distance, separate farther matches from
  nearby items, and offer editable radius replies. A zero-result search may
  check the same filters up to 50 km; no result means none in that checked area
  at that time, not global unavailability or a promise of future matches.
- Exact pickup details require authorization and stay out of model context.
  Community point addresses become public only with partner consent. QR codes
  identify points and do not grant permissions.
- Every published listing requires at least one uploaded photo. Unfinished listings remain private drafts. Photos use a private bucket with API-controlled reads, normalization and
  cleanup. User images are never evidence of condition, quantity or dimensions
  unless a person confirms those facts.
- Mutations require connectivity; the PWA does not silently queue marketplace
  writes offline. AI unavailability must leave supported direct controls usable.
- Google and email OTP sign-in exist. Real OTP and push delivery depend on
  configured providers. Do not imply that local/emulated operation verifies them.
- AI supports English/Indonesian conversation. The current UI dictionary is
  English; a stored language preference does not yet provide full UI localization.
- Existing saved needs support creation, listing, matching and deletion; an
  in-place edit endpoint is not currently implemented.
- No neighbourhood identity verification, reputation score, sales/payment flow
  or transport booking is established by the current product evidence.

## Brand Commitments

The name is NeighbourHood. The user requested a simple, modern, clear and
readable interface. Existing logo/icon assets and the live interface are design
evidence; the owner approved the new peer-supplied green/blue homes-and-connections identity on 2026-10-18. Aesthetic decisions
belong in the subsequent design brief, not this product record.

## Evidence on Hand

- Repository brief: `../../../NeighbourHood_Tugas_dan_Codebase.pdf` is a
  workspace reference, not a runtime asset.
- Current behavior: `../../README.md`, `../../docs/architecture.md`,
  `../../docs/integration-handoff.md`, shared contracts and API services.
- UI decisions and verification: `../../docs/ui-enhancement-handoff.md` and
  `DESIGN.md`. Local design-session artifacts are excluded from the repository.
- Supplied mobile Ask screenshot and local browser evidence document hierarchy
  and navigation problems. They are not a full accessibility audit.
- Local test evidence is documented in the integration handoff. Real reviews,
  verified-neighbour badges, adoption metrics and partner claims are absent.

## Product Principles

1. Make finding and sharing useful items easy from a phone.
2. Ground live facts and actions in authorized services.
3. Keep consequential changes explicit, reviewable and retry safe.
4. Preserve private information and expose controls by actual role/state.
5. Provide understandable next steps through pickup, return and recovery.

## Open Product Decisions

- Initial launch geography and the default UI language have not been confirmed.
- Full bilingual UI, saved-need editing, geocoding and a production map provider
  capacity plan remain open. The existing map uses public OSM tiles.
- No formal accessibility certification or measured usability target is claimed.
