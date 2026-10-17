# NeighbourHood UI shaping brief

Status: all-screen planning brief with Home composition confirmed by the user;
not an implementation or a production design approval.
Impeccable skill verified: **4.6.0**. Product authority:
`../apps/web/PRODUCT.md`. Scope confirmed by the user: **all screens**, with
**nearby items and a prominent Ask entry on Home**. The user selected
**Free / Borrow discovery** on 2026-10-17. The existing name, identity and capabilities
remain the starting point; this is not a rebrand.

## 1. Job, people and outcome

Local residents should be able to discover an item, request or borrow it, arrange
pickup, and finish collection/return from a phone. Giving should work from a
photo-assisted Ask draft or a direct form. Volunteers should manage community
points and physical handovers without changing their personal discovery setup.
All surfaces are working product screens in Operate mode.

The interface should make the next useful action clear and minimize typing,
remembered context and repeated setup. A successful flow ends in a concrete
receipt and next step, not an ungrounded assistant success message. No invented
verification, reputation, urgency, partner or availability claims.

## 2. Structural direction

Keep five main destinations: **Home, Explore, Ask, Activity, Profile**. Keep
messages and inbox reachable through stable labeled utility controls with real
unread state. Communities and Saved needs remain recognizable secondary
destinations; they must not be buried solely in an AI conversation.

Home offers nearby inventory and a prominent route into Ask. Explore is the
deliberate search/filter workspace. Ask handles conversation and reviewed
actions. Activity owns follow-through, owned items and approvals. Profile owns
personal setup and preferences. Volunteer controls are role-sensitive, not an
extra application imposed on every resident.

### Home composition decision

Three phone-sized planning sketches share the existing identity and navigation:

- **Nearby list + Ask dock:** compact item rows with a persistent Ask entry above
  the tabs. Strong scanning and thumb access; requires explicit dock clearance.
- **Ask entry + nearby grid:** compact top intent area followed by visual item
  discovery. Closest to the saved critique's recommended structure; the intent
  area must not displace items below the fold.
- **Free / Borrow discovery:** classify nearby items by what can be kept versus
  returned. Clear intent selection; must avoid duplicating Explore's full filters.

**Selected: Free / Borrow discovery.** Use a compact neighbourhood/radius
header, prominent Ask entry, All / Free / Borrow control, nearby item grid and
direct Share action. Keep the five main tabs. Home makes a quick nearby choice;
Explore retains full keyword, category and radius filtering. Selecting View all
should carry the chosen offering mode into Explore.

Free means donated items to keep; Borrow means items to return. Label both in
plain language and do not suggest lending is currently available until dates
are checked. Use actual item photos and a compact, honest no-photo fallback.
The selected planning sketch is
`../apps/web/.impeccable/mocks/decision/home-nearby-mode-grid.html`.
Sketches use synthetic example content and do not claim real stock. This choice
confirms composition, not every illustration, value or control in the sketch.
Concept choice does not authorize app-source implementation by itself.

## 3. Complete surface plan

| Surface | Primary hierarchy and behavior |
|---|---|
| Sign-in | Product purpose in one sentence, Google and email-code options, clear code delivery/resend/error states. Emulator-only demo controls stay visibly local. |
| First setup | Display name and neighbourhood/location explanation, device-location option and clear permission fallback. Explain approximate discovery versus private pickup. |
| Home | Neighbourhood/radius context, prominent Ask entry, All / Free / Borrow control, direct Share action and nearby item grid. Show an actual urgent pickup/return reminder only when applicable. |
| Explore | Full-width item search, location/radius summary, compact category and Free/Borrow filters, results. Preserve filters and scroll on return from details; AI help becomes contextual. |
| Item detail | Photos or compact no-photo fallback, title, Free/Borrow, condition/unknowns, donation quantity or loan date check, approximate area, owner attribution and one contextual primary action. Put access/transport facts before commitment when material. |
| Share/edit item | Photo/draft, basic facts, then conditional expiry/loan/appliance facts, private pickup and review. Keep user-confirmed facts editable, unknowns explicit and cancelled work recoverable. Enter directly from Share and return to its origin on cancel. |
| Ask entry | An immediately usable composer, one invitation and at most three starters: Find something / Give an item / Borrow something. Create the session when needed, not as a separate prerequisite. |
| Ask conversation | Compact header with history/new-thread controls, one scrollable message region and a keyboard-safe composer. Photos attach with visible processing/removal state. History and Saved needs use a compact sheet; delete is a thread-menu action. |
| Ask results/review | Result cards carry actual items and next actions. Review cards group the target, quantity/dates, relevant item/access facts, private pickup visibility and consequences. Confirm/cancel are explicit; a completed receipt replaces a pending action. |
| Activity | Needs your attention first, then selected Requests / Loans / Shared items views. Keep status, deadline and the next allowed action together. Deep links open the relevant record visibly rather than below unrelated modules. |
| Messages | Item/participant context, unread state and latest activity in the list; readable conversation and composer in a thread. Separate neighbour chat clearly from Ask. Preserve unsent drafts by account/thread with a deliberate sign-out lifecycle. |
| Inbox | Actionable unread updates first, followed by read history. Opening an update goes to the relevant item/request/loan/point. Device push preferences live in a secondary section. |
| Saved needs | Named need, preference and timing, supported Find matches / View / Remove controls. Explain AI match loading and empty results; preserve needs when chats are deleted. |
| Communities | Directory/join and nearby point context before management. Show membership state clearly. Keep ordinary member actions separate from moderator/volunteer work. |
| Point detail/QR | Identify the point, partner-consented address or approximate area, opening hours and real stock. QR opens the point without granting privileges. Deposit instructions and permissions are explicit. |
| Volunteer workspace | Received/proposed deposits, accepted quantities and in-person review; confirmed inventory, publication and audited adjustment. Give points their own location input, never require moving the volunteer's personal home location. |
| Moderator/staff controls | Membership review/roles and partner setup grouped behind actual authorization. Show friendly names and consequences, rather than raw IDs. Prevent self-elevation and permission failures without exposing privileged controls. |
| Product categories | Ordinary filter/group vocabulary with consistent readable labels; editor controls only for authorized staff. No special assistance experience. |
| Profile/settings | Name, neighbourhood/radius and language first; account/security, notifications and role information secondary. Put manual coordinates in a clearly explained fallback. Sign-out and destructive controls remain distinct. |

## 4. Interaction and layout principles

- Use the current warm teal identity, dark readable text and quiet neutral
  canvas. Let actual items and local context provide character. Avoid adding
  gradients, badges, nested cards or decorative icons to compensate for hierarchy.
- Proposed reading scale: 24–28px page titles, 16px body, 14px meaningful support
  copy, comfortable line-height and at least 44px primary touch targets. These
  are planning recommendations, not a committed token contract.
- One strong primary action per decision. Reveal category-dependent facts and
  expert controls as needed without hiding information required for safe pickup.
- Give Ask and neighbour messaging route-aware viewport layouts: compact header,
  scrollable content and composer, with explicit navigation/safe-area clearance.
  Do not stack arbitrary viewport-height subtraction with variable headers.
- Preserve filters, position, drafts and the selected activity across navigation.
  Returning from a sheet should restore focus to its trigger. Dialogs need focus
  management, dismissal and a visible cancel path.
- Communicate state through words as well as color. Announce progress, completion
  and errors without reading every streamed token or stealing the user's scroll.
- Keep selected-item identity and meaningful dates/quantities visible at review.
  A sent request is not an approved pickup; a listing draft is not publication.
- On wider screens, expand browsing and management workspaces where useful.
  Keep conversations at a readable measure. Mobile-first does not require a
  full desktop page to remain a 512px column.

## 5. Material states and data ranges

Plan for no items, one item and dense paged lists; long names and mixed-language
titles; absent photos and up to six listing photos; up to two Ask photos per
message and the existing 4MB upload limit. Respect existing date, quantity and
permission bounds from shared contracts rather than inventing UI-only limits.

Required state matrix: first run, missing location, denied location/camera,
loading, empty results, offline, AI unavailable, upload processing/failure,
changed stock, unavailable/closed listing, expired review, interrupted execution,
permission lost, sign-in expired, keyboard open, long conversation and completion.

Do not equate a lending listing's donation-style stock counter with date
availability: show Borrow / Check dates until actual dates are evaluated.
Do not show uncomputed live match counts or label stale results as current.

## 6. Feasibility and boundaries

Existing authenticated routes, authorization, transactional stock/loan rules,
private pickup, idempotency, bucket normalization and AI review/confirmation
remain intact. This shaping task does not deploy, change data or create a PR.

Most hierarchy, copy, component and route-entry changes can reuse existing
services. The builder must separately scope:

- server-derived eligibility metadata for state-aware pickup actions;
- any in-place saved-need edit or automatic match-count feature;
- complete UI dictionaries and date/number formatting for bilingual UI;
- geocoding/maps if desired beyond current device/manual coordinate support.

There is no basis for verified-neighbour badges, reputation scores or real
adoption metrics. No new payment, sale, delivery or transport-booking flow.

## 7. Proposed implementation order

1. Shared layout/readability, Ask entry/composer and draft persistence, accurate
   trust wording and direct Share routing.
2. Home, Explore and item details; review/camera/upload states and clear pickup
   eligibility, donation stock and loan-date presentation.
3. Activity, messages, inbox, saved needs and profile/onboarding; state-aware
   recovery, unread access and locale behavior.
4. Communities, points/QR, volunteer/moderator tools and category management.
5. One batched mobile/desktop visual and interaction pass, one correction batch
   and a confirmatory pass. Include the supplied 440px mobile width, a smaller
   phone, keyboard, focus/zoom and representative role/state coverage. Reuse
   domain tests and add verification only where behavior changes.

## Current decision and next boundary

The user selected Free / Borrow discovery; the Home composition decision is
complete. This brief carries that structure across the full requested UI scope.
`shape` ends with the brief; app implementation is a subsequent step. Launch
geography and default UI language remain open product facts rather than
assumptions a mockup can settle.
