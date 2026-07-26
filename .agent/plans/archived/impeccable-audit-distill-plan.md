---
title: Impeccable Audit Distill Plan
status: validated
type: implementation
autonomy: 2
created: 2026-07-26
updated: 2026-07-26
related_skills:
  - frontend-design
  - accessibility
  - animation-motion
related_docs:
  - .agent/load-skills.md
  - .agent/briefs/celebra-me.md
  - .agent/skills/frontend-design/SKILL.md
supersedes: []
superseded_by: []
---

# Impeccable Audit → Distill → Implement

## Objective

Capture Impeccable anti–AI-slop value without making it a design SSOT. Durable deliverable: rules
absorbed into `.agent/skills/frontend-design/SKILL.md` + QA checklist, plus a bounded marketing and
dashboard UI pilot. Temporary install must be removed before merge.

## Defaults

- Branch: `audit/impeccable-distill`
- Mode: temp install → evidence → distill → uninstall/cleanup
- Pilot: 1 marketing surface + 1 dashboard screen
- Exclude from detector/pilot: `src/styles/themes/**`, `src/styles/invitation-profiles/**`

## Non-goals

- Merge Impeccable, Cursor hooks, root PRODUCT/DESIGN.md, or CI `impeccable detect`
- Rewrite Jewelry Box / invitation profiles for cream/glass/serif bans
- Theme token architecture changes

## Phase status

| Phase       | Status   | Notes                                                |
| ----------- | -------- | ---------------------------------------------------- |
| 0 Repo gate | complete | Branch `audit/impeccable-distill`                    |
| A Audit     | complete | `npx impeccable detect` allowlisted; matrix below    |
| B Distill   | complete | frontend-design v1.3 + QA/load-skills/index          |
| C Pilot     | complete | how-it-works transform; share-messages tint border   |
| D Cleanup   | complete | Install artifacts removed; themes/profiles untouched |

## Evidence

Command (allowlisted):

```text
npx impeccable detect --json --no-design-system \
  src/pages/index.astro src/styles/home src/components/home \
  src/pages/dashboard/invitados.astro src/styles/dashboard
```

Detector hits on allowlist: `side-tab` (6, dashboard), `layout-transition` (2: home how-it-works +
dashboard shell). Invitation themes/profiles were not scanned.

Post-pilot re-detect on changed files: **0 findings**.

## Adopt / Adapt / Reject matrix

| Finding ID | Rule / tell                                  | Example path                                          | Surface             | Verdict | Rationale                                                           | Celebra home                       |
| ---------- | -------------------------------------------- | ----------------------------------------------------- | ------------------- | ------- | ------------------------------------------------------------------- | ---------------------------------- |
| I-01       | side-tab accent border                       | `src/styles/dashboard/_share-messages-modal.scss:213` | dashboard           | Adopt   | Classic AI tell; use equal border + tint                            | frontend-design structural bans    |
| I-02       | side-tab (editor/outbox alerts)              | `_intake-editor.scss`, `_commercial-outbox.scss`      | dashboard           | Adopt   | Same ban; out of pilot scope                                        | frontend-design                    |
| I-03       | layout-transition (`padding`)                | `src/styles/home/_how-it-works.scss:239`              | marketing           | Adopt   | Prefer transform/opacity                                            | frontend-design + animation-motion |
| I-04       | layout-transition (`width`)                  | `src/styles/dashboard/_shell.scss:79`                 | dashboard           | Adapt   | Sidebar collapse often needs width; defer rewrite                   | note in skill; not pilot           |
| I-05       | gradient text                                | invitation hero themes (excluded scan)                | invitation          | Adapt   | Banned as decorative default; solid on-dark for mobile hero already | hero contract                      |
| I-06       | cream/ivory/glass body                       | Jewelry Box / presets                                 | invitation          | Adapt   | Allowed only when preset/profile owns it; banned as default new UI  | frontend-design Adapt              |
| I-07       | section eyebrow scaffolding                  | home how-it-works eyebrows                            | marketing           | Adapt   | One deliberate kicker OK; every-section eyebrows = AI grammar       | frontend-design                    |
| I-08       | nested cards / ghost-cards / over-rounding   | general                                               | marketing+dashboard | Adopt   | Structural quality bans                                             | frontend-design                    |
| I-09       | register persuade vs operate                 | n/a (method)                                          | all                 | Adopt   | Split invitation/marketing vs dashboard                             | frontend-design                    |
| I-10       | slop test 1st/2nd order                      | n/a (method)                                          | all                 | Adopt   | Ties to hero essence / anti-clone                                   | frontend-design                    |
| I-11       | reveal gating visibility                     | motion patterns                                       | all                 | Adopt   | SSR/a11y: content visible by default                                | frontend-design + animation-motion |
| I-12       | absolute cream ban / dice worlds             | n/a                                                   | invitation          | Reject  | Conflicts with brand presets and Lane A                             | —                                  |
| I-13       | PRODUCT.md / DESIGN.md SSOT / CI detect gate | install artifacts                                     | governance          | Reject  | Forbidden parallel design authority                                 | load-skills                        |

## Pilot notes

| Surface   | Target                    | Before                                       | After                                          |
| --------- | ------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Marketing | `how-it-works` step hover | `transition: padding-inline` + padding hover | `transform: translateX` + reduced-motion       |
| Dashboard | share-messages preview    | `border-left: 3px` side-tab                  | equal border + `color-mix` accent surface tint |

## Durable knowledge migrated

- `.agent/skills/frontend-design/SKILL.md` v1.3.0 — registers, slop test, intervention loop, hard
  floors, structural bans, Adapt/Reject rules, Operate checklist extras
- `.agent/load-skills.md` — ban retained; absorption pointed at frontend-design
- `.agent/index.md` — polish routing row updated
- `.agent/agents/celebra-qa.yaml` + creative QA template — Operate/structural checks

## Cleanup checklist

- [x] Impeccable uninstalled (manual removal; no CLI uninstall)
- [x] No root PRODUCT.md / DESIGN.md tracked
- [x] No provider hook artifacts left as authority (`.cursor/`, `.github/skills/impeccable`, etc.)
- [x] `pnpm validate:structure` passed
- [x] Invitation theme/profile globs untouched in pilot diff

## Final report

- **branch:** `audit/impeccable-distill`
- **Impeccable runtime:** not present after cleanup
- **human approval needed for commit:** yes (not staged/committed by agent unless asked)
