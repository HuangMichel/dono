---
name: Dono
version: alpha
description: Calm logistics utility — warm sand neutrals, one grass accent for human decisions, hairline borders, no shadows.
colors:
  primary: "#2A7E3B"
  primary-hover: "#203C25"
  on-primary: "#FFFFFF"
  focus: "#2A7E3B"
  background: "#FDFDFC"
  background-subtle: "#F9F9F8"
  background-component: "#F1F0EF"
  text: "#21201C"
  text-muted: "#63635E"
  text-disabled: "#8D8D86"
  neutral-meter: "#82827C"
  success-bg: "#E9F6E9"
  success-bg-subtle: "#F5FBF5"
  success-text: "#2A7E3B"
  caution-bg: "#FFF7C2"
  caution-solid: "#FFC53D"
  caution-text: "#4F3422"
  caution-meter: "#AB6400"
  warning-bg: "#FFEFD6"
  warning-solid: "#F76B15"
  warning-text: "#582D1D"
  warning-meter: "#CC4E00"
  danger-bg: "#FEEBEC"
  danger-solid: "#CE2C31"
  danger-text: "#CE2C31"
  scrim: "#21201C66"
typography:
  meta:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  body-sm:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  body-lg:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  title-sm:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
  title:
    fontFamily: DM Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 30px
  display:
    fontFamily: DM Sans
    fontSize: 44px
    fontWeight: 600
    lineHeight: 48px
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  xxl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-lg}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-lg}"
  button-soft:
    backgroundColor: "{colors.background-component}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
  button-outline:
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
  button-caution:
    backgroundColor: "{colors.caution-solid}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
  button-warning:
    backgroundColor: "{colors.warning-solid}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
  button-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
  chip:
    backgroundColor: "{colors.background-component}"
    textColor: "{colors.text-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: 2px 6px
  chip-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-text}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
  chip-caution:
    backgroundColor: "{colors.caution-bg}"
    textColor: "{colors.caution-text}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
  chip-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-text}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
  chip-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
  field:
    backgroundColor: "{colors.background}"
    height: 36px
    rounded: "{rounded.md}"
    typography: "{typography.body-sm}"
  field-disabled:
    textColor: "{colors.text-disabled}"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
  card-subtle:
    backgroundColor: "{colors.background-subtle}"
    rounded: "{rounded.xl}"
  console-sidebar:
    backgroundColor: "{colors.background-subtle}"
    width: 224px
  row-selected:
    backgroundColor: "{colors.success-bg-subtle}"
  list-meta:
    textColor: "{colors.text-muted}"
    typography: "{typography.meta}"
  focus-ring:
    backgroundColor: "{colors.focus}"
    size: 2px
  sheet-scrim:
    backgroundColor: "{colors.scrim}"
---

## Overview

Dono helps associations receive only usable in-kind donations. The interface is a calm logistics
tool: warm sand neutrals carry everything, a single grass accent marks human decisions and primary
actions, and amber, orange and red are reserved for computed urgency and warnings. Depth comes from
background steps and 0.5 px hairlines, never from shadows. DM Sans is the only typeface.

Sources of truth: `docs/design/` (chosen mockups), `docs/design/ui.css` (shared
components), `docs/design/tokens.js` (full Radix scales). The mockups are the reference for every
screen; this file is the reference for the system behind them.

## Colors

The palette is Radix UI Colors v3, light theme, on five scales: sand (neutral), grass (primary),
amber (caution), orange (warning), red (danger). The full 12-step scales live in
`docs/design/tokens.js`; the frontmatter above is the semantic subset components may reference.

Use steps strictly by role:

| Steps | Role | Example |
| --- | --- | --- |
| 1–2 | Page and subtle backgrounds | app bg, sidebar, lanes |
| 3–5 | Component backgrounds, hover, active | chips, soft buttons, selected rows |
| 6–8 | Borders and focus | hairline borders (6–7), selection and focus (11) |
| 9–10 | Solid surfaces | primary and solid status buttons |
| 11–12 | Text | 11 for low-contrast, 12 for high-contrast |

Pairings that always hold: a step-3 background takes step-11 text for grass and red, and step-12
text for amber and orange (their step-11 pairs miss WCAG AA); solids pair with white where the
ratio allows it and with `{colors.text}` otherwise. Two solids are pinned a step darker than the
mockups so white text passes AA (5.1:1): `{colors.primary}` is grass-11 and
`{colors.danger-solid}` is red-11 — the brighter step-9 values the mockups render
(#46A758 grass, #E5484D red, 3.0–3.9:1 with white) remain accent colors for icons and selection
marks, not for text-bearing surfaces. Hairlines have no component sub-token, so they are
documented here: every border is 0.5 px — sand-6 `#DAD9D6` subtle, sand-7 `#CFCECA` UI,
sand-8 `#BCBBB5` strong — and selection and keyboard focus use grass-11, `{colors.focus}`, pinned
up from the mockups' grass-8 so the ring passes 3:1 against the page. Text fields are the one
hairline pinned higher: their boundary is sand-9 `#8D8D86`, so the input area passes 3:1 against
the page. Native checkboxes, radios and the text caret take `{colors.primary}`.
Disabled controls use `{colors.text-disabled}` on `{colors.background-component}`
(sand-9 on sand-3), which WCAG exempts as inactive UI. Meter and probability-bar fills sit on a
`{colors.background-component}` track and use `{colors.primary}`, `{colors.caution-meter}`
(amber-11), `{colors.warning-meter}` (orange-11), `{colors.danger-solid}` or
`{colors.neutral-meter}` (sand-10), so every fill passes 3:1 against the track.
Status color encodes **who speaks**, not just severity:

| Color | Says | Set by |
| --- | --- | --- |
| Grass | Approved, Booked, Over 90 days | Staff action or code bucket |
| Amber | Waiting for review, unreadable date | Pending state, manual check |
| Orange | Stains likely 61%, 5 days left | AI indicator or code bucket |
| Red | Refused, Expired, Medicine 34% | Staff action, code, or AI warning |
| Sand | Full, Paused category | Hidden from matching |

AI indicators speak by key and level: medium or high condition concerns are orange, medium or high
medicine and chilled-food concerns are red, a medium or high unreadable label is amber, and low or
unassessed estimates stay sand. Grass never marks an AI indicator.

No decorative color: no gradients, no glows, and never a colored bar on a card's left edge.

## Typography

Six tokens, but **at most four sizes appear on any one interface — three is the target**. The
floor is 12 px. When the scale feels tight, adjust weight (400 / 500 / 600), color step
(`{colors.text-muted}` vs `{colors.text}`) and spacing instead of adding a size. Donor surfaces run
on body-lg, meta and title; console surfaces run on body-sm, meta and title-sm. The display size is
for the landing hero and one metric number per page at most.

## Layout

Four surfaces, each with its own container:

- **Association console** — 224 px sidebar (`{components.console-sidebar}`), content max-width
  1280 px, padding 24 px.
- **Public pages** — centered, max-width 1120 px (landing, nearby needs, auth).
- **Donor app** — mobile-first: full-viewport screens at phone width; desktop-adapted layouts at
  768 px and above. Flow states (loading, errors, empty, warnings) render as phone-sized frames on
  desktop and full-bleed screens on mobile.
- **Company portal** — desktop-first, max-width 1120 px. Future design: the
  backend has no company attribution, so the connected frontend shows an
  explicit unavailable state instead of this surface.

Spacing runs on the 4 px base: gaps 8 / 12 / 16 inside components, 24 / 32 between sections.
Alignment is optical: connector lines center on their markers (a 0.5 px line through a 20 px dot
sits at 9.75 px), labels align to the object they describe, and nested corners are concentric —
inner radius = outer radius − padding (32 px outer with 12 px padding gives a 20 px inner radius).

## Elevation & Depth

None. No shadows, glows or gradients anywhere, at any elevation. Depth is a background-step change
(sand-1 content on sand-2 canvas) plus a hairline border. Modals use the scrim
(`{colors.scrim}` — sand-12 at 40%) and a sheet on `{colors.background}` with a 24 px top radius;
nothing floats, nothing is lifted.

## Shapes

Radius is functional, never decorative: `{rounded.sm}` for status chips, `{rounded.md}` for
controls and console buttons, `{rounded.lg}` for fields inside cards, `{rounded.xl}` for cards and
list groups, `{rounded.xxl}` for feature cards and phone frames. Pill buttons use a radius of
half their height. Every border and every line — card borders, dividers, timeline connectors,
segmented separators — is a **0.5 px hairline**. No element carries a colored left-edge bar.

## Components

Components come first: before inventing a new pattern, reuse one from `docs/design/ui.css` or the
exact class strings in the selected mockups.

- **Chip** (`{components.chip}`) and its status variants — chip-success, chip-caution,
  chip-warning, chip-danger. Inline status, colored by the table above, text is
  `{typography.meta}`, radius `{rounded.sm}`, padding 2px 6px.
- **Buttons** — solid (`{components.button-primary}`, hover uses `{components.button-primary-hover}`,
  one step darker), soft (`{components.button-soft}`), outline (`{components.button-outline}`) and
  the solid status buttons (`button-caution`, `button-warning` with `{colors.text}`,
  `button-danger` with `{colors.on-primary}`). All are flex-centered with an 8 px gap and
  transition colors over 250 ms with an ease-out curve. Console buttons are compact pills of
  height 36 px; app buttons are full-width pills of height 48 px.
- **Field** (`{components.field}`) — 36 px input; the 2 px `{components.focus-ring}` shows on
  focus, disabled inputs use `{components.field-disabled}`.
- **Card** (`{components.card}`) and **card-subtle** (`{components.card-subtle}`) — the only two
  surface treatments; list rows inside use 0.5 px dividers, not extra cards, selected rows use
  `{components.row-selected}`, meta lines use `{components.list-meta}`.
- **Console shell** — `{components.console-sidebar}` with the section nav; one chrome across
  Dashboard, Review, Reception, Stock, Needs, Capacity, Slots and Photos. Offers nearby uses the page 19 gallery and detail layout for explicitly posted items, with category and approximate-distance filters. Claiming is unavailable.
- **Lists** — one row per entity: primary text, muted meta line, status chip on the right. No
  nested cards. Overlays sit on `{components.sheet-scrim}`.
- **Action notifications** appear in a fixed stack at the top right, with safe screen-edge spacing and a maximum width of 384 px. Use the page background, a hairline border, a semantic icon and a dismiss button. Show at most three popups. Success and information messages close after six seconds; pause the timer on hover or keyboard focus. Errors do not expire automatically. Keep field validation and resource-loading errors beside the affected controls. Notifications survive client navigation and clear when the signed-in account changes. Do not move focus when a notification appears.

## Do's and Don'ts

1. **No middle dots as copy separators.** Use commas, dashes, parentheses or layout. Never "A · B".
2. **No redundant explanatory text.** If a label, chip or empty state already says it, do not add a
   caption. Don't add copy that dirties the UI or spends the user's attention.
3. **Write for the surface's audience.** Donors get plain, warm, short sentences; staff get precise,
   professional wording; companies get businesslike wording; platform admins get exact wording.
   Understandable, never chatty, no invented words, length fits the scenario.
4. **Radix colors only, used by step role.** Every color comes from the five scales, applied with
   the table in Colors. No ad-hoc hex values in markup.
5. **Optical alignment and concentric corners.** Align what the eye aligns; nested radii stay
   concentric (inner = outer − padding).
6. **0.5 px for every line and border.** There are no 1 px or 2 px borders in this system.
7. **Minimal motion, always ease-out 250 ms.** Color transitions only; nothing moves, bounces or
   fades in. Respect `prefers-reduced-motion`.
8. **At most four text sizes per interface, three preferred, 12 px floor.** Build hierarchy with
   weight, color and spacing, not extra sizes.
9. **Fewer decisions for the user.** No confirm-style questions where a flow can simply continue;
   when a choice is unavoidable, put it where the user is already choosing. Order content by
   priority instead of offering parallel options.
10. **No casual radii or shadows, no left-edge accent bars.** Radius values follow the Shapes
    mapping; shadows do not exist.
11. **No decorative eyebrows or overlines.** A small label above a title earns its place only when
    it adds category, context or key information the title does not carry. Build hierarchy with
    type, weight and space.
12. **Use the components.** One chip, one field, three buttons, two card surfaces. A new pattern
    needs a reason, then a home in `ui.css`.

## Voice & Tone

Terminology is fixed; do not improvise synonyms:

| Term | Used for | Notes |
| --- | --- | --- |
| Approved / Refused | Staff decisions only | Never attributed to AI |
| Waiting for review | Offers after sending | Amber pending state |
| Item | Physical goods offered by a donor | One item record may contain several identical units |
| Donation | The donor's reusable item record | Distinguish donation counts from item quantities |
| Offer | One attempt to give an item to one association | One active offer per item |
| Drop-off / Appointment | The donor's booked visit | Do not imply a collection or transport service |
| Received | Items handed over to the association | Do not use "Transferred" or "No show" as donor status labels |
| In stock | Received items still held by the association | Staff term |
| Given out | Items distributed by the association | Staff term |
| Best before / Use by | Printed date types | Preserve the original label as evidence |
| Distribute first | Stock ordered by earliest expiry | FEFO is an internal term |
| Needs | What associations ask for | "Nearby needs" for public browsing |
| Storage space | Capacity for received items and reservations | Separate from daily intake and appointment places |
| Daily intake limit | Quantity the association can receive on one day | Separate from storage space |
| Category confidence | Confidence in the AI's item classification | Never describe this as a suitability score |
| Indicators | AI observations about an item | Keep probability and human decisions distinct |

Rules of thumb: one sentence per empty state; one action per screen; numbers carry units
("412 kg", "142 days left"); dates in "15 Mar 2027" form; the AI never approves, refuses or
decides anything. Describe AI output as extracted facts, indicators and estimates. Code computes
days left, expiry buckets, distances and totals. Use factual headings such as "Check your item
details" instead of claiming that an item is ready or suitable to donate. Use British English,
sentence case and "association" throughout the app, including validation errors and generated
indicator descriptions and need-draft warnings, regardless of the browser or input language.
Format known category values as readable
labels, such as "T-shirt" and "Room temperature". Preserve names, brands, printed labels and
other free text exactly as entered. Explain failed actions in user terms, with an available next
step. Do not expose internal codes, revision numbers, JSON or deployment settings in errors.
After an uncertain save, ask the user to check the current status before trying again.

An empty matching list means that no matching association is available; it does not prove that
no association needs the item. Staff review is required after every new offer. A photo-request
action remains a design proposal until the API supports it.


## Donation and appointment states

One donation contains one product type and may contain several identical units. All units share the category, matching attributes and expiry facts. Different products or dates require separate donations.

Use Europe/Paris for appointment times. Show staff approval before slot selection. Confirm the booking before generating its QR. A failed QR request leaves the appointment booked and offers a QR retrieval retry.

Reception has one confirmation that records reception and stock together. The current API requires the full offered quantity at reception and the full remaining quantity when giving items out. Describe that limit beside each action. The earlier design proposal to receive a smaller quantity is not implemented. Do not show a received state followed by a separate add-to-stock action or a pending remainder.

Company offers are future design: the backend has no company attribution. The
current app keeps the food rules (unopened, non-perishable, room temperature)
on its explicit unavailable state and does not imply company verification, tax
receipts or chilled-food support.
