# Dono design

The chosen design of record: 20 static mockup pages, one direction per page, plus the flow states on the donor pages. Open [the board](index.html) in a browser — standalone HTML, no build step (Tailwind CDN and the DM Sans webfont load from the network).

The system spec is [`DESIGN.md`](../../DESIGN.md) at the repo root: tokens, Radix step roles, components, copy rules and the twelve design rules. Shared assets here: [ui.css](ui.css) (component layer), [tokens.js](tokens.js) (Radix scales), [shell.js](shell.js) (console chrome).

## Pages

| # | Page | Direction | # | Page | Direction |
| --- | --- | --- | --- | --- | --- |
| 1 | Landing | B — Focus | 11 | Review | A — Workhorse |
| 2 | Nearby needs | A — Workhorse | 12 | Needs | A — Workhorse |
| 3 | Sign in & sign up | A — Workhorse | 13 | Capacity | A — Workhorse |
| 4 | Scan an item | B — Focus | 14 | Slots | C — Board |
| 5 | AI indicators | B — Focus | 15 | Reception | A — Workhorse |
| 6 | Match & offer | A — Workhorse | 16 | Images | A — Workhorse |
| 7 | My donations | A — Workhorse | 17 | Association approvals | A — Workhorse |
| 8 | Booking & QR | C — Board | 18 | Company offers | B — Focus |
| 9 | Association register | B — Focus | 19 | Offers nearby | A — Workhorse |
| 10 | Dashboard | A — Workhorse | 20 | Stock | A — Workhorse |

Donor pages (4–8) carry their flow states below the main screen: Home with text-to-offer, offer-from-text result, Analysing, Unclear photo, Analysis failed (04); date-correction sheet, chilled-food warning, medicine warning with pharmacies nearby (05); Offer sent, No match with drop-off points (06); Not accepted with staff note and alternatives, No donations yet (07). At phone width every screen renders full-bleed at viewport height.

Static design artifacts: associations, donors, dates, quantities and indicators are fictional; no analysis, matching, auth, storage or reception behavior is claimed.

## Proposed dashboard and review, 2026-10-26

The earlier notes refer to Dashboard and Review proposals at `proposals/2026-10-26-workspace/index.html` and a README in that directory. Those files are absent from this checkout. The proposals do not replace the chosen designs above or establish live application behavior.

## Capacity reference, 2026-10-25

The user's supplied Capacity screenshot is the current layout reference: a bordered category list with long horizontal bars and right-aligned status/actions, plus a bordered opening-hours panel. The connected screen keeps Storage and Daily intake as separate views. Real units remain storage places and items per selected day; the screenshot's weekly kilograms and pairs are illustrative. Admins edit each limit inline. Pause/resume is not added because the capacity API has no category-active flag. Opening hours come from the association and link to the existing site editor.

## Runtime integration note

The chosen mockups remain the layout reference; removing demo records does not remove their screen structure. Runtime authentication uses email/password signup and sign-in; social-login or password-recovery examples in the mockups are not implemented actions. The connected frontend uses the implemented API described in [the current requirements](../requirements.md#connected-frontend--2026-10-25). In particular it supports three uploaded photos, full-lot reception/distribution and separate offers. The partial receipt, sample posted-offer and company-attribution notes below are historical designs, not current backend capabilities.

The 2026-10-25 restoration brings back item/label photo panels and previews, donor indicator and matching layouts, donation rows, the Paris booking calendar and separate QR pass, dashboard previews, the review queue and detail split, reception columns, and inline stock distribution. Empty states use real API results. Runtime sample records and unsupported mockup actions remain absent. See [verification and limits](../readiness.md#design-restoration-2026-10-25).

A second 2026-10-25 pass restores the remaining structures: the My donations table with status filters, search and evidence rows; "N associations need this" with the "Why these associations?" panel and redirect points on the no-match state; dashboard KPI numbers counted on the client, the medicine-flag banner and the active-needs panel; the slots month calendar with day dots and day panel; all-category capacity meters; the images gallery grid with indicator chips, expiry-bucket and FEFO panels; the admin verification table; the needs two-column layout; review offer ages, the donor-corrected-date panel and the reception expected count.

## Confirmed flow rules

A donation contains one product type. It may contain several identical units with the same category, matching attributes and expiry facts. Mixed descriptions create separate donations.

Booking follows a staff approval. Page 08 shows date/time selection and booking confirmation before the distinct QR pass state. If QR retrieval fails after booking, the appointment remains saved and the donor retries QR retrieval. Appointment times use Europe/Paris.

Historical design (mockup 15): at reception, staff adjusted the actual quantity before one confirmation recorded the receipt and stock movement together, with no pending remainder. The connected API records the full offered quantity in one confirmation; see the full-lot rule in [DESIGN.md](../../DESIGN.md).

Page 18 (company offers) remains a future design without company attribution. Page 19 is the layout reference for restored authenticated association browsing, with explicit donor posting, category/radius filters and a selected-item detail panel. Its provisional Claim and Hide actions are not implemented. Public visitor access to donor posts and association claiming are excluded. Addressed offers stay in their review queue. Medicine and chilled-food indicators at medium or high show a red warning on the donor's item details step, with the pharmacies from the redirect points for medicines; the donor can still send the offer for staff review. Staff see the same warning at the top of the offer evidence and the top concern as a chip in the review queue. Staff decide with Approve and Refuse buttons; Approve stays disabled, with the reason shown, until the required checks and reason are complete.
