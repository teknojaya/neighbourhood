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
