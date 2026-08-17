# CSS Visual Parity Gate

**Status:** Required before profile LAYOUT deletion  
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
