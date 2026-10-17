---
target: "NeighbourHood mobile UI: Ask, Home, Explore and Activity"
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:D:\\playground\\hackathon-AI-Cup-2026\\1_online\\neighbourhood\\apps\\web\\src\\features\\ask\\AskPage.tsx"
target_fingerprint: "sha256:85283f759f806d631357f6c2d9df013f1bfc953dbc0a7a85acd82064285ac607"
target_path: "D:\\playground\\hackathon-AI-Cup-2026\\1_online\\neighbourhood\\apps\\web\\src\\features\\ask\\AskPage.tsx"
timestamp: 2026-10-17T11-36-25Z
slug: apps-web-src-features-ask-askpage-tsx
---
Method: dual-agent (A: ui_design_review · B: ui_evidence_scan).

Keep the teal identity and rebuild the hierarchy around finding, sharing and
collecting useful things. The product has neighbour-specific language, but its
composition currently feels like a directory of modules. The biggest opportunity
is to put the person's next action before chat and account administration.

## What works

- Quiet teal and warm neutral backgrounds suit a practical community product.
- Five labeled bottom destinations provide a recognizable navigation structure.
- Explicit review/confirmation and Free/Borrow language support trust.

## Design health

Provisional heuristic assessment: **23/40**. This is design judgment, not a
formal accessibility or task-success measurement.

| Heuristic | /4 | Main finding |
|---|---:|---|
| System status | 3 | Loading, offline and AI progress states exist |
| Real-world language | 3 | Free/Borrow is clear; some feature labels need explanation |
| User control | 2 | Stop/retry exist; unsent chat drafts lack persistence |
| Consistency | 3 | Shared components; page titles and scope vary |
| Error prevention | 3 | Review cards and constrained inputs are strengths |
| Recognition | 2 | Users must infer where sharing, loans and saved needs belong |
| Efficiency | 1 | Ask requires chat setup before typing |
| Minimalism | 2 | Administration, repeated copy and wrappers compete |
| Error recovery | 2 | Retry exists; failure wording needs a separate check |
| Help | 2 | Capability descriptions replace guidance for the current task |

Ask presents six starters alongside history, New chat and Saved needs. Home
adds six module cards beneath two task cards. Activity stacks listings, loans
and request controls. Cognitive load is highest at those decision points;
the five-item persistent navigation itself is reasonable.

## Fix priorities

1. **P1 — Make Ask immediately usable.** The fresh Ask page has no composer.
   Your screenshot also gives history, repeated New chat headings and deletion
   priority over conversation. Show a usable input immediately, create the
   session on first send, and offer three starters: Find something, Give an
   item, Borrow something. Move history into a compact sheet and deletion into
   the thread menu. Keep saved needs reachable in that secondary navigation.
   Preserve unsent text per thread. Commands: `impeccable distill`, `layout`.
2. **P1 — Correct the chat viewport.** The supplied screenshot shows the privacy
   footer clipped by bottom navigation. A fixed chat-height subtraction is
   brittle when history, titles or banners grow. Use a compact header, a
   scrolling conversation and a composer with explicitly reserved navigation
   and safe-area space. Verify small phones and the software keyboard; keyboard
   overlap has not been reproduced. Command: `impeccable adapt`.
3. **P1 — Organize Home and Activity around immediate tasks.** Home's six module
   cards duplicate navigation. Activity puts listings and loans ahead of
   requests, despite being titled Item requests. Replace the directory with
   real nearby items and relevant pending actions. Show Needs your attention
   first in Activity, then selected Requests / Loans / Shared items views.
   Share an item should open the sharing flow directly. Commands:
   `impeccable shape`, `clarify`.
4. **P2 — Put browsing first in Explore.** The filled AI banner outranks search
   and results. Put full-width search first, compact location/radius and filters
   second, then listings. Make AI help a quieter contextual action. Item cards
   should expose title, Free/Borrow, distance and availability promptly. Missing
   photos need a useful compact fallback rather than a large empty category
   square. Command: `impeccable layout`.
5. **P2 — Reduce repeated copy and improve reading rhythm.** Replace capability
   paragraphs with one invitation and three examples. Remove repeated Open pills
   and unnecessary nested surfaces. Use consistent 24–28px headings, 16px body,
   14px supporting text, comfortable line spacing and generous touch targets.
   Keep the review-before-change promise near consequential actions. Commands:
   `impeccable clarify`, `distill`, `typeset`.

## Proposed page hierarchy

| Page | Recommended structure |
|---|---|
| Home | Neighbourhood context → Ask entry + Share action → nearby items; urgent pickup/return reminders when relevant |
| Explore | Search → location/radius + compact filters → image-led listings → contextual AI or saved-need help |
| Ask | Compact header/history → invitation + three starters → conversation → keyboard-safe composer and result/review cards |
| Activity | Needs attention → Requests / Loans / Shared items → selected list; visible messaging/unread access |
| Saved needs | Short named needs → current match count/results → edit/remove controls; independent of chat deletion |
| Communities | Find a point/join → point details and stock → volunteer controls disclosed by role |

Recommended visual direction: **warm, practical and calm**. Off-white canvas,
charcoal text, white surfaces where grouping helps, teal primary actions and
selected states, consistent outline icons, restrained borders and shadows.
Use actual item photos, local area names and pickup/return facts for character.
AI should be apparent through the easy input and useful actions. Preserve
explicit confirmation and private pickup boundaries.

## People most affected

- First-timers encounter chat management before a place to express their need.
- Distracted mobile users face bottom-edge crowding and can lose unsent text
  when switching threads.
- Low-vision/screen-reader users need readable supporting text, comfortable
  targets and intentional response announcements. Formal focus, contrast,
  screen-reader and zoom testing was not performed in this critique.

The emotional goal is a confident first action and a clear next pickup/return
step. Current capability inventories create hesitation before that first action.
Keep reassurance at review and completion, where it is most useful.

## Technical evidence and limits

The deterministic scan returned **zero findings** across Ask, Home, Explore and
the shared shell. That does not establish usability or accessibility. The
review combines the supplied mobile screenshot, source and fresh IAB inspection
of Home, Ask, Explore and Activity. Explore's real seeded listings were viewed;
their metadata required scrolling rather than being permanently obscured.
The live browser viewport was desktop with a 512px app column. Mobile keyboard
behavior and completed AI turns were not exercised during this critique.
Browser evaluation was read-only, so no detector overlay was injected. No
critique server was started, and both review tabs were closed. No UI code or
marketplace records were changed.

Minor follow-ups: standardize Activity naming and category capitalization;
provide an empty-history message; enlarge secondary text-link hit areas;
give search loading a stable result layout. The emulator badge is valid local
development context and is not a production design issue.

## Decisions before implementation

1. Home emphasis: nearby items with a prominent Ask entry (recommended), a
   chat-first landing, or a balanced task dashboard?
2. First implementation scope: Ask and shared shell (recommended), Home/Explore/
   Ask together, or all screens?
