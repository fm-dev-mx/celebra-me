---
name: client-invitation-audit
description: |
  Pre-implementation audit for a real (non-demo) client invitation: pipeline identification,
  theme/preset check, section and asset audit, demo-counterpart invariants, and a two-lane
  client-vs-theme spec. Discovery only — no implementation until the user authorizes next work.
domain: workflow
version: 1.0.0
when_to_use:
  - Auditing a real client invitation before implementation
  - Distinguishing placeholder blockers from real work
  - Linking or verifying a demo counterpart for a real invitation
  - Creating a two-lane (client vs reusable theme) completion spec
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/invitation-production.md
  - Read docs/core/invitation-creation-contract.md
related_skills:
  - theme-architecture
  - demo-content-consistency
  - production-sql-patches
  - celebra-delegation-patterns
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/domains/intake/production-flow.md
  - .agent/workflows/managed-invitation-lifecycle.md
  - docs/domains/content/event-governance.md
---

# Client Invitation Audit

Structured discovery before writing implementation code for a **real** invitation. Answers: what
exists, what is placeholder, what blocks production, and whether fixes belong in client data/assets
or in the shared theme.

**Does not own:** apply/publish lifecycle (see `managed-invitation-lifecycle`), identity field
definitions (creation contract), or production safety hard-stops (`invitation-production`).

Do not use for pure demos, performance audits, or staged code review.

## Content profiles (demo counterpart)

Real and demo share visual identity; data and media stay separate.

| Concept      | Rule                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `templateId` | Template SKU `{eventType}-{themePreset}`, **not** a FK to a real invitation |
| Theme preset | Same on real and demo                                                       |
| `_assetSlug` | **Different** — never point a demo at a real asset directory                |
| `isDemo`     | `false` on real; `true` on demo                                             |

Invariants:

```
real.templateId === demo.templateId
real.theme.preset === demo.theme.preset
real._assetSlug !== demo._assetSlug
```

`theme.preset` alone does not guarantee visual parity if the real invite has slug-scoped SCSS.
Document either matching demo overrides or an explicit “demo = base template” decision.

## Procedure

### Phase 0 — Baseline

```bash
git status --short
git branch --show-current
```

Prefer a clean tree for audit clarity; if dirty, note unrelated files and do not touch them.

### Phase 1 — Pipeline identification

Resolve how content reaches the browser (see live `content-resolver`):

1. DB `published_invitation_content` (real)
2. Legacy invitations fallback (migration window)
3. Static `event-demos` (`isDemo: true` only)

Inventory for `<slug>`:

- `src/content/events`, `src/content/event-demos`
- `scripts/manual/production-patches`
- `.agent/plans/active` payloads/specs
- `src/assets/images/events`
- slug-scoped SCSS under `src/styles`

Complete this table: route slug, `_assetSlug`, base demo, theme preset, DB published?, static JSON?,
SQL patch?, assets?, SCSS override?, current 404 risk.

### Phase 2 — Theme and preset

Read target preset tokens and section variants. For each visual gap, classify:

- **Lane A** — client-scoped override (`.event--<slug>` / client data/assets)
- **Lane B** — reusable theme change (benefits real **and** matching demo)

### Phase 3 — Section audit

For each section in `sectionOrder` (or payload keys), report: content real vs placeholder, assets,
variant alignment, Spanish copy, focal points, what works / weak, fix type, risk, priority (P0–P3).
Templates: [`references/section-audit-template.md`](references/section-audit-template.md).

### Phase 4 — Asset audit

Classify assets (cover/hero/family/gallery/venue/closing/do-not-use). Note quality, dimensions,
focal issues. Template:
[`references/asset-classification-template.md`](references/asset-classification-template.md).

### Phase 5 — Two-lane spec

Write `.agent/plans/active/<slug>-*.spec.md` with:

- **Lane A** — client-specific completion (data, assets, scoped SCSS)
- **Lane B** — reusable theme refinements only when both client and demo benefit

Structure: [`references/two-lane-spec-structure.md`](references/two-lane-spec-structure.md). Follow
`.agent/plans/README.md` for frontmatter/status. Do not implement until the user authorizes.

## Parallelism

For large inventories, group phases with
[`celebra-delegation-patterns`](../celebra-delegation-patterns/SKILL.md). Otherwise stay sequential.

## Pitfalls

- SQL/payload existence ≠ live invitation (placeholders → 404)
- Using a real client slug as `templateId`
- Assuming preset equality means visual parity under custom SCSS
- Starting implementation before the two-lane spec exists

## Hard constraints

- Audit is read-only unless the user authorizes creating/updating the plan spec file.
- No Preview/Production mutation, staging, or commits from this skill.
- Visible copy stays Spanish; identifiers/comments English.
