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

Baseline comparison and acceptance require the pinned certification runtime: Linux x64, Node
`v24.14.1`, pnpm `11.23.0`, Chromium through Playwright `1.62.1`, `en-US`, UTC, device scale factor
1, resolved browser metadata, four source/resource hashes, and a verified `sha256:<64-hex>` OS-image
digest. Candidates produced elsewhere remain diagnostic only and cannot be accepted or compared as
the authoritative reference.

The registry-driven certification is designed to cover 158 deterministic comparisons once an
accepted baseline is authorized and wired into CI: 98 variant captures (39 canonical variants plus
10 cross-preset representatives at 390x844 and 1440x900) and 60 complete-page captures (17 managed
invitations plus 13 demos at both viewports). Templates remain covered by schema and structural
contracts only. Until that accepted baseline exists, CI does not run `visual:parity:compare`;
candidate captures remain an explicit, human-reviewed operation. The page matrix is discovered from
the managed invitation registry and `src/content/event-demos`; no manual inventory is maintained.

Current repository status: the map renderer is a repository-owned deterministic schematic and makes
no render-time network request. Remote CARTO tiles are not used. Parisienne is not assumed to be
available; typography must resolve through repository-owned or explicitly authorized local
resources. No accepted 158-capture baseline exists until the post-cutover reference SHA is approved.

Provider evidence:

- Historical provider references (CARTO/OSM) are retained for provenance only; the current runtime
  uses `SchematicVenueMap` and makes no tile requests.
- Historical [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright) —
  visible attribution and ODbL notice are required for OSM-derived data.

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
