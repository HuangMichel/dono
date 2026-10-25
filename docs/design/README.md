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

## Confirmed flow rules

A donation contains one product type. It may contain several identical units with the same category, matching attributes and expiry facts. Mixed descriptions create separate donations.

Booking follows a staff approval. Page 08 shows date/time selection and booking confirmation before the distinct QR pass state. If QR retrieval fails after booking, the appointment remains saved and the donor retries QR retrieval. Appointment times use Europe/Paris.

At reception, staff adjust the actual quantity before one confirmation records the receipt and stock movement together. The quantity must be positive and cannot exceed the original offered quantity. Keep both quantities in the receipt history. No remainder stays pending and there is no second receipt. Zero quantities and no-shows remain on standby.

Page 18 lets an authenticated donor offer on behalf of a named company. The same unopened, non-perishable, room-temperature food rules apply. Cold/frozen donations, cold storage, tax receipts and company verification are deferred.

The current frontend uses page 19 for explicitly posted unmatched items that associations can browse. The donor chooses Post offer. Only those posts appear, with item facts and labelled sample illustrations. Uploaded photo previews remain temporary. Public visitor discovery and claiming remain unresolved. Addressed offers stay in their review queue. Medicine-specific workflow changes remain on standby; existing warning references are unchanged.
