# CSS Visual Parity Gate

**Status:** The accepted reference is `b68f378b75c7004922cb32ae54b26fe5f348b21d`, approved with the
public pinned CI runtime and the corrected Ximena mobile hero. The remaining captures passed the
existing pixel comparison. Exact approval identity is recorded in the accepted manifest. Acceptance
does not replace comparison or final CI. **Related:**
[`architecture.md`](architecture.md#invitation-css-ownership-normative)

## Rule

Deleting or moving **LAYOUT** rules from `src/styles/invitation-profiles/**` is forbidden unless the
CSS visual parity harness passes for that invitation (or demo profile).

LAYOUT means direct geometry/paint on section element classes (padding, margin, grid, flex,
`background` / `font-family` on section DOM, decorative pseudo-elements), not palette token remaps
or `data-intersection` rhythm tokens.

Corpus render-contract tests (`local-render-corpus-regression`) validate **section data**, not CSS
pixels. They do **not** satisfy this gate.

## Harness

The durable canonical gate reuses the existing Playwright suite and provides three explicit
operations:

```bash
pnpm visual:parity:candidate
pnpm visual:parity:compare
pnpm visual:parity:accept -- --reference-sha=<approved-commit-sha> --matrix-hash=<candidate-matrix-hash> --candidate-manifest-sha256=<candidate-manifest-hash>
```

`candidate` writes ignored files under `.tmp/visual-parity/candidate/`. `compare` never updates
accepted files and fails when the accepted manifest is missing or a case differs. `accept` is a
human-only operation and is rejected in CI. Accepted PNGs live under `tests/e2e/visual-baselines/`
and use Git LFS. The manifest records the reference commit, runtime, viewport, case identity, and
hashes. Baselines may not contain database payloads, guest personalization, cookies, credentials,
signed URLs, or external requests.

Only the browser validation job downloads Git LFS references, through its checkout step. Other
validation jobs keep LFS pointers and must not download image objects. Do not add a second
`git lfs pull` after an LFS-enabled checkout. Keep Vercel's project Git LFS support disabled while
these test references are the only LFS assets; revisit that setting before adding runtime assets to
LFS. `.vercelignore` excludes references from CLI uploads; it does not replace the Git integration's
LFS setting. Accepted references must remain outside deployed static and function outputs. Temporary
candidates and differences stay ignored.

Viewport and complete-page captures require two consecutive visually stable PNGs before baseline
comparison. Stabilization requires identical dimensions and zero perceptually changed pixels using
Playwright's default YIQ color threshold (0.2), without a changed-pixel allowance. Byte identity is
unsuitable for Chromium's repeated rasterization of rotated rounded corners. The final baseline
comparison tolerances remain unchanged. Stabilization is bounded to five seconds for viewports and
twenty seconds for complete pages: large desktop PNGs can require 4–5 seconds each, and an initial
height adjustment requires a third frame. The loop returns immediately once stable; continuously
changing pages still fail. It does not retry a failed comparison, widen pixel tolerances, or update
accepted images. This prevents a single transitional frame from becoming candidate evidence.

Complete-page tests allow sixty seconds for navigation, deferred media, PNG encoding and audits on
shared CI runners; the stabilization loop retains its separate bounded timeout. Each
manifest-producing suite runs serially without retries. A failed capture stops that suite;
continuing it in a replacement worker would discard the earlier in-memory manifest entries. CI
retains only actual/diff PNGs on failure for three days, without traces or credential artifacts.

GitHub CI runs static/build, unit, browser, and disposable database checks independently. The
required `Application Suite` status succeeds only when every application tier succeeds; cancelled,
failed, or skipped tiers cannot authorize release. New runs cancel superseded runs for the same
branch or pull request. Browser CI uses two workers across files and stops after five failed tests,
remaining failed overall. Each capture suite remains sequential so its manifest stays complete.

Visual suites do not retry individual captures: worker restarts lose the accumulated complete-matrix
manifest and can hide the first failure behind incomplete-capture errors. An explicitly reviewed
whole-suite rerun remains possible without updating references or changing tolerances.

Browser CI checks the accepted runtime and registry-derived route availability before starting
capture workers. `PLAYWRIGHT_USE_CANONICAL_FIXTURES=true` starts a loopback-only, read-only
transport from versioned invitation definitions and the existing media preparation pipeline.
Explicit source directories prevent fallback to persisted provider assets. Unknown endpoints and all
writes fail; this fixture is rendering evidence, not a substitute for the separate disposable
database contracts or hosted Preview checks. Playwright must own both servers and may not reuse a
persistent service.

The browser job pins the public Playwright image by digest and installs the required Node and pnpm
versions. Changing from the previously accepted local image requires a clean-source candidate and
explicit acceptance of its new runtime fingerprint before CI can certify it. Do not point CI at
Production, inject personal Local credentials, or downgrade comparison to diagnostic mode to obtain
a green status. The accepted image must be available to the runner; a local image ID alone is not a
portable CI setup. Passing local comparison does not establish hosted CI readiness.

For regenerated candidates, the per-suite `manifest.json` and `pages-manifest.json` are the source
of truth. A retained `combined-manifest.json` must not override those fresh captures or mask
incomplete coverage. An accepted primary manifest remains authoritative for comparison.

Synthetic section fixtures must apply the production box-sizing reset across Astro component
boundaries. Long-name checks must include optional foreground portraits: title and details need
independent flow space, while background-only covers retain their reviewed composition. Set the
motion preference before navigation and await settled hydration/fonts before geometry assertions;
transient transforms must not conceal overlaps. The mobile premiere standard hero with a foreground
portrait reserves separate flow rows for the portrait, information and full name.

Baseline comparison and acceptance require the pinned certification runtime: Linux x64, Node
`v24.14.1`, pnpm `11.23.0`, Chromium through Playwright `1.62.1`, `en-US`, UTC, device scale factor
1, resolved browser metadata, four source/resource hashes, and a verified `sha256:<64-hex>` OS-image
digest. The browser runner may connect to a separately hosted local Astro server through a read-only
HTTP bridge; keep database credentials on the server and record both runtime identities and the
matching source revision. Never expose the development server beyond the required local boundary.
Candidates produced elsewhere remain diagnostic only and cannot be accepted or compared as the
authoritative reference.

Capture totals must be derived from `buildVisualPageCases`, `VISUAL_VIEWPORTS` and the canonical
variant registry in `scripts/screenshot/visual-coverage-contract.ts`. Published invitations and
active demos form the public matrix; structural fixtures cover every registered variant
independently of publication lifecycle. Do not maintain separate numeric inventories or hardcoded
invitation exclusions. A lifecycle change to `published` adds the invitation to the next candidate
and requires new coverage and acceptance; an older matrix cannot certify the added route.

### Release-time visual confirmation

Visual acceptance is part of the owner's decision to release a candidate for deployment. It is not
an automatic consequence of a push, a green partial CI run, or a Vercel build starting. Before the
owner sends the exact candidate revision through the release/promotion path, the owner reviews the
candidate captures generated with the pinned runtime and explicitly confirms its source SHA, matrix
hash, and candidate-manifest SHA-256. Only then may the owner run `visual:parity:accept`, land the
accepted references on `develop` through the standard pull-request and checks flow, and require the
resulting `Application Suite` to pass before deployment.

This ordering is intentional: browser CI consumes the accepted reference before it can become green,
so acceptance cannot be deferred until after the deployment has started. A missing or rejected
confirmation keeps the release candidate blocked; it must never be bypassed by shrinking the matrix,
changing tolerances, or downgrading compare mode.

## Complete-page evidence and acceptance

- Initialize the existing audit screenshot mode before application scripts run, so demo countdowns
  do not randomize. Wait for rendered Astro islands to finish hydration, fonts to settle, and RSVP
  fields and their ancestors to finish appearing before capture. Elapsed delays and disabled CSS
  animations alone do not settle React motion. Do not force opacity to hide an unfinished render.

- Prepare deferred images and fonts, scroll the actual document through every section, individual
  image and footer, await image decoding, and return to the top before capture. A body scroll
  container must be handled explicitly. Gallery bytes being loaded is not proof that every image has
  painted; a multi-viewport gallery fixture taller than the viewport must verify image pixels
  throughout its length.
- If screenshot preparation changes document height through motion or responsive layout, discard
  that image and capture once more. Reject a still-truncated retry; never widen truncation
  thresholds. Verify the last painted footer pixels and bounded failure behavior in regression
  fixtures.
- Verify physical PNG height against both the measured document and the last content boundary. DOM
  presence, test counts and viewport-only images cannot establish complete-page coverage. Inspect
  the complete vertical sequence for blank tails and missing painted content.
- Hide only selectors returned by `getOperationalToolbarSelectors`. Visible Astro or Vercel tooling
  invalidates evidence. Music, credits, navigation and other product controls remain visible and
  must be tested before scrolling changes their state.
- Record exact clean source SHA, content versions, configuration identity, runtime/browser metadata,
  matrix hash and candidate artifact hashes. Any relevant change invalidates affected evidence.
  Diagnostic captures from a dirty checkout are not an acceptable reference.
- Geometry checks use text ranges for critical names and explicit title/details and prompt/content
  intersections. Different stacking levels do not exempt meaningful text. Keep existing pixel
  tolerances unchanged.
- Verify multiline accented names against the rendered font ink height; horizontal containment alone
  cannot detect a diacritic touching the preceding line.
- Geometry cannot establish photographic contrast, ornamental glyph quality or aesthetic acceptance.
  Human review must inspect the complete pages and representative long-content fixtures.
- Exceptions identify route, viewport, element, reason and owner approval; they cannot bypass other
  checks. Valentina's complete surname is intentional and must remain readable; it does not exempt
  her first name from containment checks.
- The viewport-only candidate at `39d527de` is withdrawn and must not be accepted. After the owner
  commits corrections, regenerate the complete candidate with the pinned runtime. Register
  acceptance only after explicit approval of its exact SHA, matrix hash and candidate-manifest hash.
  Then compare and run complete CI on the final revision.

Venue previews use `StaticVenueMap`, preserving the public Production CARTO Voyager tile URLs and
geographic framing without introducing an API key. Appearance follows the explicit map style and
inherited color tokens; the shared renderer owns the tile grid and marker. Google Maps, Apple Maps
and Waze navigation links remain independent. Remote tile changes or failures must be reported by
visual diagnostics, not silently replaced or accepted as parity.

## Current asset evidence

`buildNormalizedInvitationRelease` and the invitation package remain the only per-asset metadata
contract: they derive dimensions, MIME type, file size, normalized SHA-256, `assetManifestHash`, and
`sourceHash` from each registered definition. Do not maintain a second asset manifest.

- Ximena's `hero.webp` and `gallery-01.webp` were restored from their exact historical Git objects.
  SHA-256: `1e960bdc490b3daed64aa95ad5f6f1984e0c55c88f5106cb533d4e921a3a51ee` and
  `7c183313fb79f5116eb4ce06005bebc9af9e92860919c3b5b124db7b346a2274`.
- Ayrin's declared local set is byte-identical to the repository-owned enchanted-rose source set.

```bash
# 1. Capture baseline (before LAYOUT deletion)
pnpm screenshot:css-parity -- --slug=<slug> --phase=baseline

# 2. Apply the profile LAYOUT change

# 3. Capture candidate and compare
pnpm screenshot:css-parity -- --slug=<slug> --phase=compare
```

Requirements:

- Dev server for the current lane must be reachable (same base URL rules as `pnpm screenshot`).
- Baseline and compare captures use identical viewport (`mobile-standard` by default) and `audit`
  screenshot mode.
- Compare fails if any required PNG is missing or its SHA-256 differs from baseline.
- On failure: restore the profile change; do not delete LAYOUT.

## Artifact layout

```
.tmp/css-visual-parity/<slug>/
  baseline/
    manifest.json
    *.png
  compare/
    manifest.json
    *.png
```

`manifest.json` lists relative PNG paths and SHA-256 digests.

## Scope of this gate

| Change                                               | Gate                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| Profile palette / rhythm token-only edits            | Not required                                      |
| Profile DEAD selector removal with zero paint effect | Not required (prefer corpus + `validate:changed`) |
| Profile LAYOUT deletion or move                      | **Required**                                      |
| Preset token thinning without profile LAYOUT deletes | Not required                                      |

## Stop rule

If this harness cannot run (no server, no Playwright), do not delete profile LAYOUT. Document the
blocker and leave the rules in place.

## Recovery vs gate baselines

Baselines under `.tmp/css-visual-parity/**` are **local gate artifacts**, not recovery goldens.

- Capture them **before** an intentional LAYOUT deletion you are about to make.
- Do **not** treat baselines captured **after** a suspected ownership/CSS regression as the
  authority for “restore identical look.” Those digests can freeze the damaged paint.
- For visual recovery, prefer Production (`remoteParity: required`) and/or pre-damage SCSS
  (`git show <ownership-commit>^:…`) plus computed-style contracts in
  `tests/e2e/invitation-visual-contracts.spec.ts`.
- After P0 recovery fixes, new baselines may be captured only as an owner-approved gate for future
  LAYOUT deletes — still do not commit `.tmp/` PNGs.

### Scoped presentation decision

For `/xv/valentina-hernandez` at 390×844, 414×896 and 1440×900, retain the complete text in
`.invitation-hero__last-name`, as explicitly requested by the owner in the current task. This
permits the necessary surname wrapping; it does not permit clipping, ellipsis, overlap, or an
unreadable first name. This content decision is not approval of a screenshot baseline.
