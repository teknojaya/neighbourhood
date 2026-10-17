---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/features/home/HomePage.tsx","src/features/ask/AskPage.tsx"]
---

# Resident and volunteer UI

Scope: all authenticated routes and sign-in. Mode: Operate. Residents discover, donate, borrow and arrange handovers on phones; volunteers manage physical stock. Preserve all authorization, confirmation and privacy boundaries. Approved composition: `mocks/decision/home-nearby-mode-grid.html`. Latest amendments: prominent Donate / Share on Home; public area/city/region alongside distance; implementation on `feat/mobile-first-ui`.

## Direction contract

THESIS: useful things nearby lead the experience, with Ask and Donate / Share immediately reachable; replace the module-directory Home.

OWN-WORLD: existing teal identity, stone ground, white surfaces, system UI type, restrained borders, 12–16px corners and consistent outline icons.

STORY: choose Free or Borrow, see an item and its public area, review facts, then explicitly request or share. Exact pickup stays private. Ask assists all actions and requires confirmation.

FIRST VIEWPORT: compact brand and utilities; area and radius; prominent Ask entry and full-width Donate / Share action; Nearby heading, All/Free/Borrow selector, two-column photo grid. Five-tab navigation anchors mobile. Desktop expands browsing, with conversations kept readable.

FORM: Free / Borrow discovery, third dealt structure; `seed:c52a40e5c7f0d48f`. Signature interaction: the segmented control changes real nearby inventory and carries that mode into Explore. Ask begins with an immediately usable composer, history in a sheet, one scrolling conversation and a keyboard-aware dock.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: launch geography and complete UI translation. Use existing public area labels, never infer a city or invent verification, match counts or loan availability.

## Follow-up refinement — 2026-10-17

User-supplied four phone screenshots at 440×956 establish the current controls and missing-location state. Preserve the selected world and composition. Requested extensions: icon-and-label pill actions for History, New chat and Saved needs; one + beside the composer to choose Camera/Photo library; readable loading skeletons, with a real setup state when location is absent; an optional Explore map showing only the caller’s saved location and selected radius. Opening the map loads OpenStreetMap tiles, with visible attribution and provider disclosure; exact neighbour locations remain private. Map panning does not change the search centre. Ask must explain product concepts from implemented rules and read current account roles before making personal membership claims. Verify phone, short conversation and desktop sizes, photo choices, delayed queries, map/radius changes and product guide/account authorization.

The next two user screenshots refine discovery order: show the map open immediately below Explore's title, with search and filters below it. On Home, move Community points and Saved needs above Nearby items. Categories becomes a real native dropdown filter below All / Free / Borrow, reused in Explore, and View all carries both filters. Retain Hide map, radius controls, attribution, location disclosure and the missing-location setup state. This explicit request supersedes the prior map opt-in default.

The next refinement raises the Ask tab in a labelled teal circle. Place manual Search distance immediately below Explore's map and above Find an item. Public product pins group rounded areas with counts and link to product details; exact pickup addresses remain private. Ask must state the checked radius, distinguish farther results and offer editable radius replies without implying availability outside the checked area. Bundle authorized seed photos and complete accounts so teammates can inspect real populated, pending and empty states locally.

Ask streams real reply text and tool progress. Marketplace tasks clarify the next missing fact with one casual question per turn, answered through the ordinary composer. Optional reply pills remain shortcuts. Known intent, radius and corrections are preserved. Do not show a competing draft form during a clarification. Older product results collapse, can be reopened and retain photos/bookmarks without stale radius prompts. Show the first image before sending, carry it through the draft, and preview it before publication. Publication uses explicit approval. Messages add a back chevron, related product thumbnail and private photo attachments. Saved items bookmark actual listings, separate from Saved needs. Preserve history, Stop, secure pickup forms and all existing actions. Verify real two-turn Q&A, streamed text, draft/review/published photos, two-browser attachment privacy, bookmarks and narrow phone/desktop layouts.

Latest refinement: reply and radius options send normal messages in one tap. Setup options open actual photo/location controls instead of posting their labels. Clear the composer at Send and preserve the next draft through response completion. Ask for a photo early when giving/lending, allowing the user to decline. Coordinates and public area are distinct; Profile setup preserves an existing point when adding a city label, resumes the chat, and keeps precise coordinates out of model context. Message-list titles align beside their photos. No visual identity change.
