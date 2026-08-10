---
title: Invitation Variant Canonicalization (Goal B)
status: validated
created: 2026-08-10
updated: 2026-08-10
type: implementation
autonomy: 2
related_docs:
  - docs/domains/theme/variant-system.md
  - .agent/plans/archived/invitation-variant-discovery-audit.md
supersedes: []
superseded_by: []
---

# Goal B — Canonicalize Discovered Reusable Variants

## Implemented

| Variant        | Section  | Origins / pilot                      | Explicit selectors           |
| -------------- | -------- | ------------------------------------ | ---------------------------- |
| `split-cover`  | Hero     | Romina Ríos                          | `hero.structuralVariant`     |
| `split-groups` | Family   | Daniela y Martín; Victoria y Roberto | `family.structuralVariant`   |
| `split-map`    | Location | Alba Rosa                            | `location.structuralVariant` |

Structural CSS:

- `src/styles/themes/sections/hero/_split-cover.scss`
- `src/styles/themes/sections/family/_split-groups.scss`
- `src/styles/themes/sections/location/_split-map.scss`

## Cleanup

- **Daniela Gallery:** migrated to `single-keepsake`; local flex/grid single-portrait rules removed
  from profile; keepsake frame tokens retained.
- **Alba Thank You:** confirmed dead `.thank-you-editorial*` rules under
  `structuralVariant=standard`; removed. Kept standard-compatible skin under
  `data-variant='editorial-magazine'`. No new Thank You variant.

## Victoria portability pilot

| Variant               | Decision        | Rationale                                                                                                                                     |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Family `split-groups` | **Retained**    | Existing two-group + padrinos content matches the shared contract; intentional mobile stack uses the canonical centered stack (was mirrored). |
| Hero `split-cover`    | **Not applied** | Current full-bleed couple cover is not improved by a lateral contained photo; would require redesign, not a content-compatible fit.           |
| Location `split-map`  | **Not applied** | Two venues with pending map URLs and no coordinates; applying `split-map` would invent media/structure beyond the pilot authorization.        |

## Goal B.1 — Non-origin portability (`split-cover`, `split-map`)

Verification-only checkpoint. No production/demo content created; no Victoria redesign; no
canonical contract changes. No runtime defects found → no canonical SCSS/runtime fixes required.

### Content sources (non-persisted)

| Variant       | Non-origin source                         | Theme         | Media sufficiency                                                                 |
| ------------- | ----------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| `split-cover` | `demo-xv-jewelry-box` (Lucía García)      | `jewelry-box` | Existing hero background image; shared Hero contract only                         |
| `split-map`   | same demo fixture                         | `jewelry-box` | Ceremony + reception with venue copy, coordinates, map URLs, and venue image keys |

Invariant exercised:

```text
compatible non-origin content
+ canonical structuralVariant
+ non-origin semantic theme tokens (jewelry-box)
+ no origin profile
→ complete valid structural rendering
```

### Coverage added

- `tests/unit/structural-variant-portability.test.ts` — adapter/content contract, section render
  descriptors, CSS delivery under jewelry-box without slug/profile, canonical SCSS independence,
  origin profiles do not own structural geometry.
- `tests/e2e/structural-variant-portability.spec.ts` — non-persisted harness: existing jewelry-box
  demo DOM + canonical `data-structural-variant` + compiled canonical structural CSS; desktop/mobile
  geometry asserts; no Romina/Alba stylesheets; targeted screenshots under
  `test-results/structural-variant-portability/`.

### Results

| Check                                              | Result |
| -------------------------------------------------- | ------ |
| Shared contracts need no invitation-specific transform | Pass   |
| Desktop split composition (hero / location)        | Pass   |
| Mobile complete/valid structure                    | Pass   |
| Non-origin theme tokens sufficient                 | Pass   |
| No origin slug / visualProfileId / profile SCSS required | Pass |
| Origin profile geometry ownership removed          | Pass   |
| Romina / Alba designs left unchanged this checkpoint | Pass |
| Portability defect requiring canonical fix         | None   |

### Validation evidence (B.1)

- `pnpm exec jest tests/unit/structural-variant-portability.test.ts` — 6 passed
- related resolver/resolver-map/structural-variant suites — passed
- `pnpm exec playwright test tests/e2e/structural-variant-portability.spec.ts` — 2 passed
  (Chromium installed into the local Playwright cache for this run)
- `pnpm validate:changed` — passed (Prettier advisory only, then formatted)

## Out of scope (unchanged from Goal A)

Abril gallery storyboard, jewelry-box-wedding storyboard, Alba Family photo-caption, countdown
units, gifts legend-only, Daniela map-preview, Valentina mobile rail, Luna Hero cleanup, general
profile/legacy cleanup.

## Validation evidence (Goal B baseline)

- pnpm validate:changed: passed
- pnpm type-check, structure, lint, styles, governance, parity, PII, preparation: passed
- Jest full suite: 5067 passed (1 skipped)
- pnpm build:app: passed
- pnpm test:e2e:ci: previously blocked environmentally by missing Playwright Chromium; B.1
  reinstalled Chromium and ran the focused portability e2e successfully

**Goal B is fully complete** after Goal B.1 non-origin portability validation.
