---
title: Invitation Variant Canonicalization (Goal B)
status: implemented
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

Non-origin portability for `split-cover` / `split-map` is covered by CSS resolver tests that load
those partials under a non-origin theme (`celestial-blue`) without invitation profile identity.

## Out of scope (unchanged from Goal A)

Abril gallery storyboard, jewelry-box-wedding storyboard, Alba Family photo-caption, countdown
units, gifts legend-only, Daniela map-preview, Valentina mobile rail, Luna Hero cleanup, general
profile/legacy cleanup.


## Validation evidence

- pnpm validate:changed: passed
- pnpm type-check, structure, lint, styles, governance, parity, PII, preparation: passed
- Jest full suite: 5067 passed (1 skipped)
- pnpm build:app: passed
- pnpm test:e2e:ci: blocked environmentally — Playwright Chromium missing under sandbox cache path; not a Goal B regression
