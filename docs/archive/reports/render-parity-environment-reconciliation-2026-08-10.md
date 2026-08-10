# P1.1 Render Parity Environment Reconciliation

**Date:** 2026-08-10  
**Mode:** diagnostic-only; no runtime, Astro, SCSS, invitation content/config, variant,
presentation, schema, or compatibility changes were made.

## Decision summary

The current Local and Production environments are not the same render revision or effective
content snapshot. The three mandatory comparisons are therefore `EXPLAINED_DIFFERENCE`, not
`RUNTIME_REGRESSION`:

| Invitation / section | Local result | Production result | Status | Primary cause |
| --- | --- | --- | --- | --- |
| `cumple/alba-rosa-quinonez` / Countdown | Four rendered units; `data-unit-count="4"`; `data-visible-units="days,hours,minutes,seconds"` | Days rendered; the other three units are `display:none`; no current `data-unit-count` or `data-visible-units` attributes | `EXPLAINED_DIFFERENCE` | Local published row is v2 and has no countdown presentation options, so the current adapter falls back to all units. Production serves an older identity/profile renderer that hides three units. |
| `cumple/alba-rosa-quinonez` / Location | `data-structural-variant="standard"`; one map card using the current standard composition | No structural-variant attribute; desktop card is a split content/map grid and mobile card is the stacked split composition | `EXPLAINED_DIFFERENCE` | Local v2 row has no explicit location structural variant or presentation options, so the current adapter falls back to `standard`. Production CSS contains the older slug-specific split-map rules. |
| `xv/romina-rios-chaparro` / Hero | `data-structural-variant="standard"`; full-cover image at both checked viewports | No structural-variant attribute; desktop has the split botanical plane with a contained right image, while mobile is full-cover | `EXPLAINED_DIFFERENCE` | Local v2 row has no explicit hero structural variant, so the current adapter falls back to `standard`. Production CSS contains the older slug-specific split-cover rules. |

The remaining 11 comparable invitations matched on the bounded browser signatures below (section
presence/order, media-mode/card count, and responsive hero composition). No `RUNTIME_REGRESSION`
was established. `boda/victoria-y-roberto` returned Production HTTP 404, so its sections are
`INSUFFICIENT_EVIDENCE`; no parity conclusion was inferred from the missing reference.

## Environment identity and method

The browser was Chromium driven through the installed Playwright package. Each route was opened
with `?skipEnvelope=true` at 390×844 and 1440×900. The checks read HTTP status, DOM attributes,
loaded CSS links, computed display/grid/flex values, and bounding rectangles; no screenshot was
used as a pixel baseline. Countdown values were treated as time-varying and were not compared as
content.

| Environment | Identity captured | Revision evidence |
| --- | --- | --- |
| Local | `http://127.0.0.1:4322`, Astro 7.1.3, repository HEAD `4c5ff780cdaabcf93c583311f2846a1006535db4` | Local clean dev process; effective content came from the local published repository/database path. |
| Production reference | `https://www.celebra-me.com` | Vercel response headers exposed request IDs and hashed asset names, but no Git SHA or deployment revision. Sample mandatory-route request IDs: Alba `sfo1::iad1::gg5x5-1786381715455-2a676b46f33f`, Romina `sfo1::iad1::tc5p5-1786381719891-1c15181f6c78`. |

The Production reference was used as the strongest available deployed comparison, not as an
assumed source-of-truth for the current contracts. Its relevant CSS assets were hashed
`alba-rosa-quinonez.BaJngEmi.css` and `romina-rios-chaparro.lBT7xDWp.css`. Those assets contain
identity-specific structural selectors, whereas the current source centralizes structural
geometry on explicit `data-structural-variant` attributes.

## Source-to-render trace for the mandatory differences

### Alba Countdown

The canonical Alba definition requests `visibleUnits: ['days']`. The local published database row
is version 2 (`updatedAt`/`publishedAt` `2026-08-01T22:56:44.439943+00:00`) and its `countdown`
object contains only `title`. The current adapter therefore resolves the documented default of
all four units. The Local DOM confirms four segments and the current data attributes. Production
has the days segment visible and the other segments suppressed by delivered profile/global CSS,
but its timer lacks the current data attributes. This is a content-snapshot plus deployed-renderer
drift, not evidence that the current adapter regressed.

### Alba Location

The canonical Alba definition requests `structuralVariant: 'split-map'` and
`showFlourishes: false`. The local published row is the same older v2 shape without those fields,
so the current adapter resolves `standard`; Local DOM and CSS follow the explicit standard path.
Production has no structural-variant attribute, but its deployed Alba profile CSS explicitly
provides the split-map card geometry (`content`/`map` grid areas on desktop and stacked content/map
on mobile). The observed Production geometry is therefore explained by the older CSS delivery and
cannot be used as proof that the current Local standard path is wrong.

### Romina Hero

The canonical Romina definition requests `structuralVariant: 'split-cover'`. The local published
row is version 2 and has no explicit hero structural-variant field, so Local resolves `standard`.
Production has no structural-variant attribute, but its deployed Romina profile CSS explicitly
sets the desktop botanical split plane, a contained right image (`width: min(58vw, 760px)`), and a
left content plane (`width: min(42vw, 560px)`). Mobile remains full-cover in both environments,
which is the expected responsive form of this composition.

## Corpus-wide bounded scan

The same 15-row P1 corpus was checked in Local and Production at both viewports. Production was
available for 14 rows; `boda/victoria-y-roberto` was 404. Across the 14 comparable rows, the scan
found matching section presence/order, media mode/card count, and responsive hero composition apart
from the three mandatory differences above. Production also omitted the current explicit
`data-structural-variant` metadata throughout the sampled DOM; this is recorded as deployment/revision
drift and not counted as a separate visual regression where the delivered legacy CSS preserved the
same composition.

| Result | Count (invitation-level comparison) | Interpretation |
| --- | ---: | --- |
| `MATCH` | 11 | Bounded DOM/media/geometry signatures matched at desktop and mobile. |
| `EXPLAINED_DIFFERENCE` | 3 | Alba Countdown, Alba Location, Romina Hero; causes are separated above. |
| `RUNTIME_REGRESSION` | 0 | No current Local-only break was isolated. |
| `INSUFFICIENT_EVIDENCE` | 1 | Victoria Production route unavailable (404). |

## Follow-up boundary

The evidence supports two separately bounded future actions, neither authorized or implemented by
P1.1:

1. Reconcile the Local published rows for Alba and Romina with the intended managed release so the
   effective content carries the explicit presentation/structural fields required by the current
   adapter.
2. Deploy or otherwise identify the current renderer/profile CSS revision before treating Production
   as a current-contract baseline. A future browser regression should assert the canonical-to-route
   DOM contract for Alba Countdown (`data-visible-units="days"`), Alba Location
   (`data-structural-variant="split-map"`), and Romina Hero
   (`data-structural-variant="split-cover"`), plus the corresponding desktop geometry.

The Production 404 for Victoria must be resolved or an accepted reference supplied before that row
can be compared. No content invention, visual redesign, CSS rewrite, or runtime fix is part of this
diagnostic result.

## Limitations and cleanliness

- No Production Git SHA was exposed; Vercel request IDs and asset hashes are the available identity
  evidence.
- Production database content was not mutated or directly queried; the effective deployed output was
  observed through the browser.
- The checks establish contract/DOM/CSS/computed-geometry parity for the stated viewports, not a
  universal screenshot-pixel guarantee.
- Temporary diagnostic output was not added to the repository. Git staging, commits, and unrelated
  user changes were left untouched.
