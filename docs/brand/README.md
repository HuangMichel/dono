# Dono visual identity

**Selected direction: Reciprocal (the middle concept).** Two rotated receiving forms create a balanced exchange between donors and associations. This is the user-selected direction; the main logo, reversed versions and favicon now use it.

Open the [interactive comparison](comparison.html) to compare all three concepts on light, monochrome, dark and green backgrounds. The [colour overview](previews/concept-overview-color.png) and [black-first overview](previews/concept-overview.png) are available as static images. The existing landing page and DESIGN.md have not been edited.

## Three concepts

| Concept | Symbol | Lockup | Idea and tradeoff |
|---|---|---|---|
| 01 Right fit | [SVG](concepts/01-right-fit.svg) | [SVG](concepts/01-right-fit-lockup.svg) | A matching segment completes the D. Strongest connection to the name; the two openings need to stay intact at small sizes. |
| **02 Reciprocal — selected** | [SVG](concepts/02-reciprocal.svg) | [SVG](concepts/02-reciprocal-lockup.svg) | Two rotated receiving forms describe exchange. Balanced and compact, but can initially read as an S. |
| 03 Converge | [SVG](concepts/03-converge.svg) | [SVG](concepts/03-converge-lockup.svg) | Two geometric sides share a diagonal opening. Simplest silhouette, but more generic and less connected to the name. |

All three are original filled-vector constructions, paired with an original lowercase **dono** wordmark. They are different forms, rather than colour or rotation variations of one idea. The brief, exploratory longlist and refinement decisions are in [design notes](design-notes.md).

## Final exports

| File | Use |
|---|---|
| [logo.svg](logo.svg) | Main horizontal logo: grass-green mark with sand-black wordmark, transparent background. |
| [logo-mark.svg](logo-mark.svg) | Standalone grass-green symbol, transparent background. |
| [logo-dark.svg](logo-dark.svg) | White horizontal logo for dark or solid green backgrounds. Transparent background; preview it on a dark surface. |
| [favicon.svg](favicon.svg) | White mark on a grass-green rounded square, drawn for 16 px and above. |
| [wordmark.svg](wordmark.svg) | Standalone lowercase wordmark in sand black. |
| [logo-black.svg](logo-black.svg) | One-colour sand-black horizontal logo. |
| [logo-white.svg](logo-white.svg) | One-colour white horizontal logo, same artwork as the dark-surface export. |

SVG masters contain no live text, embedded images, gradients, shadows, filters, masks or strokes. All letterforms are filled outlines; an installed font is not needed. The comparison page uses DM Sans, as specified by DESIGN.md, with the same Google Fonts stylesheet as the landing page. Only the presentation typography uses that optional network resource; the actual logo artwork is independent of it.

## Geometry and optical refinements

- Symbol: a 256 × 256 viewBox with visible bounds x=32…224 and y=32…224; 32 units of internal breathing room.
- Two identical filled forms rotated through 180 degrees around (128,128). Outer bend radius 72 and inner radius 24 give a consistent 48-unit weight.
- The open seams are 24 units at their narrowest horizontal interface, approximately 1.5 px at a 16 px icon size. No arrows, effects or fragile detail.
- Rotational symmetry balances the ink mass without the D concept's optical translation. The selected drawing is preserved in [02-reciprocal-selected.svg](iterations/02-reciprocal-selected.svg).
- Wordmark: original lowercase outlines with circular bowls, 14-unit main stems, a 2-unit round overshoot and optical spacing. The name and its kerning remain unchanged.
- Lockup: fixed symbol/wordmark relationship on a 768 × 256 viewBox. Do not retype the wordmark or adjust its kerning.

The three earlier Right fit iterations remain as exploration history, not selected production artwork. All root-level logo exports now use Reciprocal. The alternatives in concepts/ remain available for reference.

## Colour and usage

| Role | Colour | Source |
|---|---|---|
| Brand mark | `#2A7E3B` | DESIGN.md primary, grass-11. |
| Wordmark and dark surface | `#21201C` | DESIGN.md text, sand-12. |
| Reversed artwork | `#FFFFFF` | DESIGN.md on-primary. |
| Presentation canvas | `#FDFDFC` | DESIGN.md background. |

Use green + sand on light backgrounds, sand alone for single-colour work, and white on dark or solid green backgrounds. Keep backgrounds quiet. Do not recolour individual pieces, close the seams, use the dark export on white, distort proportions or add outlines/effects.

Reserve at least 32 drawing units of clear space from the symbol's visible ink (two-thirds of the principal 48-unit weight). Most of that space is included in the square artboard; adjacent content must still respect the clear-space boundary. Suggested minimums: symbol/favicon **16 px**, horizontal logo **96 px wide**, wordmark **64 px wide**. Prefer the symbol alone when the full name becomes too small. These are screen usage recommendations based on the rendered samples, not print-process guarantees.

## Verification and evidence

- SVG audits performed before and after refinement: [round 1](validation/svg-audit-round-1.json), [final](validation/svg-audit-final.json). No warning/error findings in the final artwork. The selected standalone mark has no audit finding; the favicon has an intentional coloured-tile informational finding. The alternative Right fit mark retains its documented optical-centre informational note.
- Rasterized and inspected the black-first and colour concepts, final logo, dark version, and actual-size 16/24/32 px marks/icons. See [small-size checks](previews/small-size-checks.png).
- Native SVG PNG renders use librsvg. The skill's default Chrome raster path could not run in the restricted environment; the supplied concept-sheet workflow was retained and its renderer adapted to installed librsvg. Chrome was subsequently used directly for browser screenshots and interactive checks.
- Browser preview inspected at [desktop](previews/comparison-desktop.png) and [390 px mobile](previews/comparison-mobile.png), plus [dark](previews/comparison-dark.png) and [green](previews/comparison-green.png) surfaces.
- The [browser check record](validation/browser-checks.json) confirms a 390 px page with no horizontal overflow and real clicks on all four theme buttons, each with exactly one aria-pressed state.
- [Additional skill-generated test sheet](validation/size-and-background-tests.html) supports further visual inspection. Its extra treatments are diagnostic previews, not approved brand artwork.

Library marks were studied for construction and differentiation only. No source paths or font outlines were copied. Reciprocal is the selected direction; trademark clearance has not been performed.
