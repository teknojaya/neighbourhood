---
name: NeighbourHood
description: Simple, readable discovery and sharing for useful things nearby.
colors:
  brand-50: "#f0fdfa"
  brand-100: "#ccfbf1"
  brand-700: "#0f766e"
  brand-800: "#115e59"
  page: "#fafaf9"
  ink: "#1c1917"
  white: "#ffffff"
  stone-50: "oklch(98.5% 0.001 106.423)"
  stone-100: "oklch(97% 0.001 106.424)"
  stone-200: "oklch(92.3% 0.003 48.717)"
  stone-300: "oklch(86.9% 0.005 56.366)"
  stone-500: "oklch(55.3% 0.013 58.071)"
  stone-600: "oklch(44.4% 0.011 73.639)"
  stone-700: "oklch(37.4% 0.01 67.558)"
  stone-800: "oklch(26.8% 0.007 34.298)"
  stone-900: "oklch(21.6% 0.006 56.043)"
  amber-50: "oklch(98.7% 0.022 95.277)"
  amber-100: "oklch(96.2% 0.059 95.617)"
  amber-200: "oklch(92.4% 0.12 95.746)"
  amber-900: "oklch(41.4% 0.112 45.904)"
  sky-50: "oklch(97.7% 0.013 236.62)"
  sky-200: "oklch(90.1% 0.058 230.902)"
  sky-900: "oklch(39.1% 0.09 240.876)"
  red-50: "oklch(97.1% 0.013 17.38)"
  red-200: "oklch(88.5% 0.062 18.334)"
  red-900: "oklch(39.6% 0.141 25.723)"
  emerald-50: "oklch(97.9% 0.021 166.113)"
  emerald-200: "oklch(90.5% 0.093 164.15)"
  emerald-900: "oklch(37.8% 0.077 168.94)"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3333333333
    letterSpacing: "-0.025em"
  item-headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  section-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5555555556
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  support:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4285714286
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4285714286
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3333333333
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  full: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.brand-800}"
  button-primary-disabled:
    backgroundColor: "{colors.stone-300}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.brand-800}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
  button-ghost:
    textColor: "{colors.brand-800}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
  text-field:
    backgroundColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 0.75rem"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.4}"
  mode-control:
    backgroundColor: "{colors.stone-100}"
    rounded: "{rounded.xl}"
    padding: "{spacing.1}"
  offering-free:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-800}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  offering-borrow:
    backgroundColor: "{colors.amber-50}"
    textColor: "{colors.amber-900}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  composer:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.3}"
---

# Design System: NeighbourHood

## Overview

**Creative North Star: "Useful things nearby"**

NeighbourHood uses its incumbent teal identity, warm stone ground, white surfaces and system UI typography to make local inventory and the next action easy to read. This is the implemented visual system for the resident and volunteer web app, recorded after the approved enhancement. It preserves the existing identity rather than introducing a new art direction.

The interface is compact but gives controls and supporting copy room. Actual item photos provide visual detail; absent or broken photos receive an honest outline-icon fallback. Browsing expands on wider screens while forms and conversations retain a readable measure. The approved surface composition remains in `.impeccable/surfaces/src-app-tsx.md`; this document records reusable visual rules rather than prescribing Home's layout for every route.

**Key Characteristics:**

- Teal actions over a quiet stone and white field.
- Clear system typography, sentence-case controls and descriptive supporting copy.
- Restrained borders, rounded surfaces and consistent outline SVG icons.
- Mobile discovery grids, readable conversations and explicit state changes.

## Colors

The palette combines a dark teal action family with warm neutral surfaces; semantic colors explain state rather than add decoration. Frontmatter values preserve authored hex and the imported Tailwind OKLCH source without replacing either with approximate conversions.

### Primary

- **Neighbourhood teal** (`brand-700`): primary buttons, Ask entry, unread badges, focus and card-hover borders.
- **Deep teal** (`brand-800`): links, selected navigation, secondary button text and primary hover.
- **Pale teal** (`brand-50`, `brand-100`): quiet hover/selection, Free labels, user conversation surfaces and owner initials.

### Secondary

- **Warm amber** (`amber-50`, `amber-100`, `amber-200`, `amber-900`): Borrow labels, warning messages and the explicitly local demo indicator. Amber does not imply urgency or verification.

### Tertiary

- **Information sky**, **error red** and **success emerald**: each shared alert uses its light background, dark text and intermediate one-pixel ring. These are functional status families, not alternate brand accents.

### Neutral

- **Warm page** (`page`) and **ink** (`ink`): the literal HTML background and base foreground.
- **White**: controls, cards, modal and composer surfaces.
- **Stone ground** (`stone-50`, `stone-100`): header, segmented-control track, image fallback and subdued sections.
- **Stone edges** (`stone-200`, `stone-300`): quiet dividers/card borders, stronger input borders and disabled primary buttons.
- **Stone text** (`stone-500` through `stone-900`): captions, support, field labels, strong text and the offline strip. Meaningful support generally uses `stone-600`; existing smaller helper exceptions are not a new baseline.

**The Action Teal Rule.** Use the existing teal family for actions, focus and selected states; retain words alongside semantic status colors.

## Typography

**Display Font:** no separate display family.
**Body Font:** the system sans stack in frontmatter, explicitly retained by the approved direction.
**Label/Mono Font:** labels share the same stack; no distinct mono role is established.

**Character:** familiar, practical and readable. Weight and size distinguish hierarchy; no decorative type treatment is needed to create a new screen.

### Hierarchy

- **Headline:** the shared page heading and Ask invitation use the headline token. Shared page headings have tight tracking; individual section titles can retain normal tracking.
- **Item headline:** the larger item-detail title is an observed variant, not a universal page-title requirement.
- **Title:** Nearby, Ask and dialog headings use the title size; weight varies between semibold and bold where the source establishes it.
- **Section title:** the Ask entry, detail sections and other compact headings use the section-title size.
- **Body:** default prose and shared text input content use the body role. Item-card titles use the same size with semibold weight and a snug line height (1.375).
- **Support / Label:** descriptions, alerts, message bodies and control labels use these roles. Long explanatory text and Ask messages use a relaxed line height (1.625).
- **Caption:** navigation labels, dates and compact offering labels use the caption size. Navigation and offering labels increase weight to semibold.

Headings balance wrapping; titles and user-authored text allow word wrapping. Times and number inputs use tabular numerals. There is no single fixed line-length token; width constraints provide the reading measure.

**The One Type Voice Rule.** Extend the established system sans hierarchy instead of adding a display face to ordinary product screens.

## Layout

The app shell is centered and full width up to 72rem. Main content uses 1rem side padding, increasing to 1.5rem at the 40rem breakpoint. Ordinary pages have a 48rem maximum; discovery deliberately fills the shell. Inline Share forms narrow further to 42rem and sign-in uses a 28rem column.

Home and Explore use two item columns at phone widths, three from 48rem and four from 64rem, with a 0.75rem gap. Skeleton grids use the same columns. Home's Ask and Donate / Share actions stack on phones and become adjacent from 40rem. Explore's main filter groups become two columns from 48rem; Share's basic category/condition fields become two columns from 40rem. Long forms also contain established compact two- and three-column fact groups; these are not a claim that every field has a 44px target.

Most sections use the spacing scale in frontmatter: 0.75rem within groups, 1rem in general cards/forms and 1.25rem between discovery or detail sections. Main non-conversation padding starts at 1.25rem above content and leaves 2rem below it. Nested shared surfaces flatten to transparent, borderless sections with no horizontal padding, avoiding recursive card framing.

Five labeled main tabs remain a bottom navigation on desktop as well as mobile. Their grid is limited to 42rem; items have a 4rem minimum height. The header provides 44px utility targets, safe-area top padding and genuine unread counts. Navigation incorporates the bottom safe-area inset.

Ask and selected neighbour conversations use a flex shell sized to the visual viewport where available, falling back to `100dvh`. A single inner region scrolls while header, composer and tabs occupy their own space. Conversation content is capped at 48rem. The composer does not shrink and is capped at 45dvh with internal overflow. Short-viewport captures demonstrate this layout; they do not certify physical-device keyboard behavior.

## Elevation & Depth

The shared system is flat: white and stone tonal layers, quiet borders and dividers establish depth. Buttons, cards and selected modes stay flat. The requested raised Ask entry is the deliberate exception, with a soft shadow separating its circle from the navigation. Input focus adds a two-pixel translucent teal ring; alerts and incoming message bubbles use thin rings. The native modal uses a black 40% backdrop.

### Shadow Vocabulary

- **Field focus ring** (`0 0 0 2px color-mix(in oklab, #0f766e 20%, transparent)`): the shared input focus treatment, paired with a teal border.
- **Status edge** (`0 0 0 1px <semantic-200>`): the shared alert's corresponding semantic ring.

**The Quiet Surface Rule.** Separate ordinary surfaces with tone and thin edges; preserve the existing flat card and button treatment.

Motion is limited to state feedback: shared controls use the imported 150ms standard transition; listing-card border color uses 150ms ease-out. Pending skeletons pulse. Reduced-motion preference removes animations and transitions throughout the app.

## Shapes

Small selected segments use the `lg` radius, shared buttons/fields use `xl`, and cards/dialogs/composers use `2xl`. Offering/status pills, unread counts and initials use fully rounded edges. Borders are normally one pixel. Listing photos and no-photo fallbacks share a clipped 4:3 frame; item-detail media uses a larger contained image rather than cropping every image identically.

Reusable navigation and utility icons are inline 24px outline SVGs with a 1.8px stroke, round caps and round joins. The incumbent logo and provider-specific Google mark remain their own assets rather than being forced into the outline-icon vocabulary.

## Components

### Buttons

Direct, compact controls with comfortable shared touch targets. The canonical button has a 44px minimum height, semibold label and `xl` corners. Primary is teal/white and deepens on hover; its disabled state is stone. Secondary is white with a stone border, deep-teal text and a pale-teal hover with teal border. Ghost retains teal text and a pale hover. Disabled controls use a not-allowed cursor; secondary disabled text turns stone. Global focus-visible outlines are teal, with a three-pixel offset; the shared button explicitly uses a two-pixel offset. There is no bespoke pressed translation or raised shadow.

### Chips

Offering labels say **Free to keep** or **Borrow & return**, so color never bears the meaning alone. Compact cards use the frontmatter chip padding and caption type; detail pages use larger support-size labels with 0.25rem by 0.75rem padding. Mode and activity controls are segmented groups: three equal buttons on stone, a white selected segment and deep-teal selected text, exposed through `aria-pressed`. Each shared mode segment has a 44px minimum height.

Utility actions use the shared `ActionPill` or equivalent link class: a fully rounded white control, stone edge, deep-teal label, 44px minimum height and 18px outline icon. History, Saved needs, New chat and Home utilities keep visible words beside their icons. Status labels remain static; action pills remain buttons or links.

Home places Community points and Saved needs above the Nearby items heading. Below that heading, All / Free / Borrow remain segmented offering controls; the category filter sits beneath them as a native select styled as a pill, with the box icon and selected category. Selecting All categories clears the filter. View all carries category and offering into Explore. Category administration remains accessible from Profile.

### Cards / Containers

General cards are white with a stone edge, `2xl` corners and the card padding token. Listing cards clip their media and use 0.75rem detail padding; the whole card links to item details and its border turns teal on hover. Title and public area/distance wrap. Images load lazily; missing and broken photos show the outline box and **No photo yet** rather than synthetic product imagery. Nested general cards flatten through the global surface rule.

### Inputs / Fields

The shared field has a visible associated label, optional described hint, white ground, stone border, `xl` corners and 44px minimum height. Text content uses the body role. Focus changes the border to teal and adds the translucent ring. Labels are support-size medium weight. Errors are usually shared alerts adjacent to the form; a field-level invalid color token is not implemented. Existing bespoke select/textarea fact controls have source-specific sizing and focus behavior; the shared field specification does not claim they are all identical.

### Navigation

Five labeled outline-icon tabs retain their order: Home, Explore, Ask, Activity, Profile. Active text/icons are deep teal; inactive content is stone and turns teal on hover. The white navigation is separated by a top border. Header Messages and Updates utilities expose accessible names containing actual global unread counts; badges appear only for positive counts and cap visual text at **99+**. Read operations refresh those counts. The local-demo pill is environment-specific and hidden below 360px.

Ask uses a 48px teal circle raised 16px above the tab row, with its label below and a soft shadow. It remains a normal link to the Ask route. This gives the agent a clear focal point without introducing another conversation modal.

### Conversation composer and dialog

Ask starts with a usable composer, one invitation and three starters; opening it does not create a blank server session. The white composer has a stone border that turns teal on focus within. Its textarea is visually integrated, with its own border and outline removed inside the composer. User Ask messages use pale teal; neighbour messages sent by the resident use solid teal, while incoming messages use white with a stone ring. Message text preserves line breaks.

The composer places a 44px round attachment `+` before the two-row textarea and a named round Send icon after it. The attachment control opens a native auto popover with Take photo and Photo library, plus file limits and an explicit close control. Escape and outside dismissal preserve native behavior. Session deletion is a named trash icon with confirmation. At short heights, the history region scrolls while the composer and navigation retain their own space.

Selected photos preview while uploading and remain visible in the first sent message. Failed uploads retain retry/remove controls and block sending an incomplete attachment. Assistant text streams in the conversation with a concise status label and Stop control. Status updates do not announce every token. One to four clarification questions use fieldsets, labelled free-text answers and wrapping choice pills with visible selected states. Use these answers drafts an editable message. Draft and publication cards show their attached photos; publishing remains an explicit Confirm action after reviewing the actual fields.

History and modal forms use the native dialog: centered, up to 36rem wide, one-rem viewport clearance, maximum height `calc(100dvh - 2rem)`, scrollable content and `2xl` corners. Opening locks body scroll; Escape triggers dismissal, and unmount restores prior focus. Inline Share preserves facts and the selected File in account-scoped memory through navigation, with explicit discard and origin-aware cancel; successful publication, refresh and sign-out clear the draft.

### Loading, empty and feedback

Skeletons represent pending requests using stone blocks inside the same surface/grid geometry, with an accessible Loading status and decorative blocks hidden from assistive technology. Settled empty states use readable text and the next available action, never skeleton geometry. Error, information, warning and success alerts use the semantic palette, `xl` corners and compact support type. Errors have alert semantics; other tones use status semantics. Offline uses a dark stone strip and explicit text; unsupported mutations remain disabled according to connectivity and action state.

Home and Explore show item-shaped skeletons while the profile or enabled item query is pending. A loaded profile without coordinates shows a dashed setup surface with **Choose your search area** and **Set location**; a paused query does not imply loading.

### Search area map

Explore opens the map directly below its title using the resident's saved search point. The white, stone-edged section retains `2xl` corners, a labelled Show/Hide map action and a Map & location disclosure. The lazy map reserves 256px on phones and 288px on wider screens. A teal circle shows the selected kilometre radius; a small teal dot with a white edge marks the resident's saved point. Public product areas use 36×44px teal teardrop pins with a white count centre, grouping listings with the same rounded coordinates. Keyboard-accessible popups link to products and explain that the area is approximate, not the pickup address. Popup content scrolls within 180px. Fit radius restores the extent; Change location opens Profile. Attribution stays visible, and tile failure keeps the search usable with a Retry map action. Automated screenshot tiles are labelled synthetic and are not evidence of provider availability.

The Search distance disclosure sits directly below the map, before Find an item. Its labelled numeric field accepts whole kilometres from 1 to 50, with an Apply radius action and validation. Profile retains presets and adds the same manual range. Ask results state the searched radius, separate farther matches and offer labelled radius reply pills that draft editable chat messages. Widening a chat search does not change the saved Profile preference.

Seeded products may use the repository's generated household photos as authorized test content. Unmatched products and missing uploads keep the existing honest no-photo fallback. Real resident listings use their own uploaded photos.

## Do's and Don'ts

### Do:

- **Do** reuse the existing teal, stone, white and system sans vocabulary.
- **Do** keep meaningful supporting copy readable and use words alongside colored states.
- **Do** match pending skeleton geometry to its eventual content and give empty results a concrete next step.
- **Do** retain public area and distance together, while keeping exact pickup information behind its authorized flow.
- **Do** keep the conversation scroll region, composer and bottom tabs structurally separate.
- **Do** use actual item photos and honest no-photo fallbacks.

### Don't:

- **Don't** introduce a new visual identity, display family or decorative elevation for ordinary product screens.
- **Don't** turn nested content into repeated bordered cards; preserve the implemented flattening rule.
- **Don't** imply that Borrow is date-available, that a public area is verified, or that an unconfirmed action has completed.
- **Don't** use synthetic item imagery or invented counts as evidence of live inventory or unread activity.

Not canonized: isolated 10–11px badge/helper text, legacy uppercase planned-module badges and bespoke compact form controls are carried implementation exceptions, not new global type or control standards. This record does not repair source or expand the finish verdict into full-app accessibility certification; physical keyboard and screen-reader testing remain unverified.

## Conversational clarification and personal items

Ask asks one casual question at a time through normal chat; reply pills send
the chosen answer directly. Setup actions open actual photo or location controls.
The composer clears on Send and preserves a next draft during streaming.
Sharing requests a photo early, with an explicit option to continue without one.
Profile location setup preserves existing coordinates when only the public area
label is missing and resumes the chat after saving. Draft/review forms do not compete with a clarification in the
same turn. Older product results collapse and can be reopened, retaining photos
and bookmarks while hiding stale radius prompts. Counts and availability come
from the product cards. Messages use the existing dock with a back chevron,
related product thumbnail and the shared attachment +. Pending photos preview
with Remove; failures retain retry/remove. Saved items bookmark real listings
and have a separate page from Saved needs. These refinements retain existing
tokens, palette, type and mobile navigation.
