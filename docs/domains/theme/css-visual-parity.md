# CSS Visual Parity Gate

**Status:** Blocked pending an exact committed reference SHA and explicit human approval of the
complete visual candidate. The runtime map renderer is already repository-owned and deterministic.
**Related:** [`architecture.md`](architecture.md#invitation-css-ownership-normative)

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

For regenerated candidates, the per-suite `manifest.json` and `pages-manifest.json` are the source
of truth. A retained `combined-manifest.json` must not override those fresh captures or mask
incomplete coverage. An accepted primary manifest remains authoritative for comparison.

Synthetic section fixtures must apply the production box-sizing reset across Astro component
boundaries. Long-name checks must include optional foreground portraits: title and details need
independent flow space, while background-only covers retain their reviewed composition.

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

## Complete-page evidence and acceptance

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
