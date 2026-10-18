# Additional UI research — 2026-10-17

This supplements the saved independent critique. It is a source-based review,
not a new scored critique, a runtime reproduction or a completed accessibility
audit. Scope confirmed by the user: all screens, Home centred on nearby items
with a prominent Ask entry. No UI implementation is included in this research.

## Additional findings

| Priority | Evidence | Consequence | Design requirement |
|---|---|---|---|
| P1 | `ListingDetailPage.tsx` labels all item owners "Verified Neighbour" | Firebase identity does not establish residence/identity verification | Use factual owner attribution; show a verification claim only with explicit supporting product data |
| P1 | Home's sharing link passes `tab=giving`, while Activity only reads a focused `request` | A sharing intent lands on a mixed dashboard without opening the form | A share entry should enter the listing draft/create flow and return to its source on cancel |
| P1 | Item details expose an approved-pickup button to every non-owner | Unapproved visitors encounter a control whose intended response is denial | Show a clear locked explanation before approval; reveal the action from server-authorized eligibility |
| P1 | Listing publication review lists basic fields but omits appliance/logistics details | A person can confirm publication without seeing consequential facts they supplied | A grouped review should expose condition/unknowns, expiry, loan dates/limits, pickup visibility and appliance/access facts when applicable |
| P1 | Point creation reuses the user's profile home coordinates | A volunteer is instructed to move their personal search location to create a point | Give points their own location input; preserve the resident's personal discovery location |
| P2 | `i18n/index.ts` always uses the English dictionary | Selecting Bahasa Indonesia does not localize the interface | Clearly separate AI language support from UI language; plan a real locale dictionary or label the limitation honestly |
| P2 | `NotificationsPage.tsx` puts PushPreferences ahead of inbox entries | Notification setup interrupts the task of reading updates | Put actionable unread updates first and device preferences in a secondary settings section |
| P2 | Profile shows raw coordinates and membership IDs in the main form | Technical implementation details dominate everyday account tasks | Prioritize name, neighbourhood, radius and language; disclose coordinate fallback and role details only where needed |
| P2 | Saved needs have no edit endpoint; matches load only after a user request | A polished mockup could imply unsupported editing or live match counts | Use supported find/remove actions; identify refinement/edit and background counts as separate API/data work |

## Cross-surface behavior to preserve

- Keep browsing filters, position and the selected item when returning from
  details. Home intent must arrive in Ask as a draft, not send automatically.
- Keep each Ask draft independent and preserve it on navigation without
  persisting private image bytes or authenticated API payloads in app-shell cache.
  Device-local text retention needs a deliberate lifecycle on sign-out/account
  switching; it must not leak into another account.
- After approval, show the concrete next pickup step; after checkout, the return
  date; after completion, a receipt linking to the relevant conversation/activity.
- Handle expired review cards, changed stock, unavailable items, interrupted
  uploads and provider unavailability without invented success.
- Use role-sensitive controls for owner, recipient, borrower, volunteer,
  moderator and staff. A compact UI never replaces backend permission checks.
- Plan empty, loading, offline, denied-location, denied-camera, expired-session,
  long-content, no-photo and keyboard-open states rather than only ideal screens.

## Implementation feasibility boundaries

Most hierarchy, copy, spacing, route entry and role grouping changes can reuse
existing services. Server-derived pickup eligibility metadata, saved-need
editing, verified identity, automatic match counts and new geocoding must not
appear as completed features merely because a design shows controls for them.
Full bilingual UI requires dictionaries and formatting work; existing Gemini
language behavior is not a substitute.
