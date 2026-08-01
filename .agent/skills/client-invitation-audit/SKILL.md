---
name: client-invitation-audit
description: |
  Pre-implementation preparation and audit for a real (non-demo) client invitation: conversational
  intake UX, WhatsApp/chat fact classification, event-completeness evaluation, asset inventory,
  info-hygiene, prepReadiness aligned to invitation-preparation helpers, theme/preset check,
  section audit, demo-counterpart invariants, and a two-lane client-vs-theme spec. Preparation may
  begin before implementation; implementation requires prepReadiness ≠ NOT_READY and task
  authorization.
domain: workflow
version: 2.1.0
when_to_use:
  - Preparing a new real client invitation before implementation
  - Resuming preparation from docs/invitations/<slug>.md
  - Auditing a real client invitation before or during implementation
  - Distinguishing placeholder blockers from real work
  - Linking or verifying a demo counterpart for a real invitation
  - Creating a two-lane (client vs reusable theme) completion spec
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read docs/core/invitation-preparation-contract.md
  - Read .agent/workflows/invitation-preparation.md when running preparation
  - Load src/lib/invitation-preparation/ helpers as evaluation SSOT (cite outcomes; run `pnpm validate:invitation-preparation`)
related_skills:
  - theme-architecture
  - demo-content-consistency
  - production-sql-patches
  - celebra-delegation-patterns
  - frontend-design
  - copywriting-es
related_docs:
  - docs/core/invitation-preparation-contract.md
  - .agent/workflows/invitation-preparation.md
  - .agent/templates/invitation/preparation-state.md
  - docs/domains/content/event-governance.md
  - docs/core/invitation-creation-contract.md
  - .agent/rules/invitation-production.md
  - .agent/workflows/managed-invitation-lifecycle.md
  - .agent/workflows/design-reference-to-build.md
  - docs/domains/intake/production-flow.md
---

# Client Invitation Audit

Structured discovery and preparation analysis for a **real** invitation. Covers:

1. **Preparation** (before payloads / invite SCSS) — conversational intake, classify information,
   evaluate event completeness, inventory assets, separate recommendations from decisions, update
   canonical Markdown, determine **prepReadiness** via helpers.
2. **Implementation audit** — pipeline identification, theme/preset lanes, section and asset audit,
   two-lane spec (only when prepReadiness allows and the task authorizes implementation work).

**Does not own:** apply/publish lifecycle (`managed-invitation-lifecycle`), dashboard intake publish
state (`intake-publishing`), identity field lists beyond preparation completeness
(`invitation-creation-contract` — load post-prep), or production safety hard-stops
(`invitation-production` — load when mutating/publishing).

Orchestration entry point:
[`.agent/workflows/invitation-preparation.md`](../../workflows/invitation-preparation.md).

Conversational UX script:
[`references/conversational-phase-script.md`](references/conversational-phase-script.md).

Do not use for pure demos, performance audits, or staged code review.

## Inputs

| Input | Required for preparation | Notes |
| ----- | ------------------------ | ----- |
| Event type | yes | Live `EVENT_TYPES` (`cumple`, not `cumpleanos`) |
| Chat / WhatsApp material | yes | **Evidence** (text + media claims) — see WhatsApp + hygiene contracts |
| High-resolution (HR) photo URL and/or source asset path | yes | **Asset source** — refuse inventory without it |
| Invitation slug | when writing Markdown | May be `requires_owner_decision` initially; freeze only with verified orthography |
| Existing `docs/invitations/<slug>.md` | when resuming | Canonical state; update in place |

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

Route slug, `_assetSlug`, and `baseDemoId` are distinct concepts — do not collapse them.

## Info-hygiene (prep)

Follow contract §4.1. Summary:

- Persist opaque source labels — not absolute OneDrive/`Clientes` paths or chat folder titles.
- Chat media = evidence in session; do not commit raw exports or photo dumps.
- HR **photo** URL = asset source (session may hold URL; Markdown uses opaque label).
- Never persist payroll / HR-**portal** / credential-bearing / environment URLs.
- WhatsApp attachments never become managed assets without the asset-preparation protocol.

## Procedure

### Phase 0 — Baseline

```bash
git status --short
git branch --show-current
```

Prefer a clean tree for audit clarity; if dirty, note unrelated files and do not touch them.

When the task is preparation, also open or create `docs/invitations/<slug>.md` from
[`.agent/templates/invitation/preparation-state.md`](../../templates/invitation/preparation-state.md)
and follow conversational script **C0**.

For reference-driven visual work after prepReadiness allows implementation, complete
[`design-reference-brief`](../../templates/creative/design-reference-brief.md).

### Phase P0 — Chat / conversation extraction (script C1)

Follow [`references/whatsapp-intake-contract.md`](references/whatsapp-intake-contract.md).

Classify every material datum as:

`verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` | `requires_owner_decision`

Executable helpers: `assertClassificationRules` from `src/lib/invitation-preparation/`.

Present the **classified-facts summary** (script) before new owner questions. Never treat
conversation attachments as managed assets. Never re-ask facts already present in the supplied
material or canonical Markdown.

### Phase P1 — Event completeness (script C3)

Use `getEventCompletenessContract` / `evaluateEventCompleteness` for the event type.

- Prefer evidence-backed contracts (`xv`).
- For `partial` / `undefined` contracts, do not invent fields; record contract gaps. `cumple` and
  `baby-shower` are already `partial` in `event-completeness.ts`; do not invent beyond that list.
- Distinguish blocking vs non-blocking gaps; ambiguous required/conditional fields stay blocking.

### Phase P2 — Asset inventory (script C2 + C4)

Follow [`references/asset-preparation-protocol.md`](references/asset-preparation-protocol.md) and
reuse quality labels from
[`references/asset-classification-template.md`](references/asset-classification-template.md).

Require HR URL / explicit asset root first. Produce role assignments, **photo uniqueness table**,
and a role-aware optimization plan (`planImageOptimization`). Preserve originals. Note double-encode
risk for managed WebP delivery.

### Phase P3 — Demo / design / identity freeze (script C5)

- Client-selected demo → `verified`.
- No selection → recommend from `DEMO_PRESET_CATALOG` + sections/assets; leave final selection as
  `requires_owner_decision`.
- Colors: preserve client colors; otherwise recommend separately.
- **Identity spelling freeze:** slug + `hostLoginAlias` only after verified orthography (or
  recorded owner override).

Record recommendations only under Agent Recommendations.

### Phase P4 — Placeholders, owner pack, prepReadiness (script C6–C7)

- Controlled tokens via `createPlaceholderToken` / `[[PENDIENTE:FIELD]]`.
- Build **one** consolidated pack with `buildOwnerDecisionPack` /
  `formatOwnerDecisionPackMarkdown`.
- Evaluate `evaluatePreparationReadiness` + `summarizeAssetQuality`.
- Write Markdown prepReadiness to **match the helper**. Provisional-only assets ⇒ ceiling
  `READY_WITH_PLACEHOLDERS`, never `READY_FOR_IMPLEMENTATION`.
- **Hard stop:** if prepReadiness is `NOT_READY`, do not begin payload or invitation-specific SCSS
  (`assertImplementationAllowed`).
- **F17:** Cite helper outcomes in session; confirm with `pnpm validate:invitation-preparation`.

### Phase P5 — Update canonical Markdown (script C7–C8)

Update `docs/invitations/<slug>.md` so a new session can resume without conversational memory.
Respect info-hygiene. Do not claim envReadiness here.

### Phase 1 — Pipeline identification (implementation audit)

Load creation/production authorities only in this implementation-audit segment (or later), not as
preparation preconditions.

Resolve how content reaches the browser (see live `content-resolver`):

1. DB `published_invitation_content` (real)
2. Legacy invitations fallback (migration window)
3. Static `event-demos` (`isDemo: true` only)

Inventory for `<slug>`:

- `src/content/events`, `src/content/event-demos`
- `scripts/manual/production-patches`
- `.agent/plans/active` payloads/specs
- `src/assets/images/events` / `src/assets/invitations`
- slug-scoped SCSS under `src/styles`

Complete this table: route slug, `_assetSlug`, base demo, theme preset, DB published?, static JSON?,
SQL patch?, assets?, SCSS override?, current 404 risk.

### Phase 2 — Theme and preset

Read target preset tokens and section variants. For each visual gap, classify:

- **Lane A** — client-scoped override (`.event--<slug>` / profile SCSS / client data/assets)
- **Lane B** — reusable theme change (benefits real **and** matching demo)

**Lane A inheritance reset:** When overriding a shared preset, list inherited properties that must
be reset (e.g. absolute positioning, frosted bands, café/sepia filters, mix-blend) so profile SCSS
does not fight the preset. Prefer face-safe hero composition guidance in `frontend-design`.

### Phase 3 — Section audit

For each section in `sectionOrder` (or payload keys), report: content real vs placeholder, assets,
variant alignment, Spanish copy, focal points, what works / weak, fix type, risk, priority (P0–P3).
Templates: [`references/section-audit-template.md`](references/section-audit-template.md).

### Phase 4 — Asset audit (implementation)

Classify assets (cover/hero/family/gallery/venue/closing/do-not-use). Note quality, dimensions,
focal issues. Template:
[`references/asset-classification-template.md`](references/asset-classification-template.md).

### Phase 5 — Two-lane spec

Record a conversation-scoped or task-handoff spec with:

- **Lane A** — client-specific completion (data, assets, scoped SCSS) + inheritance-reset list
- **Lane B** — reusable theme refinements only when both client and demo benefit

Structure: [`references/two-lane-spec-structure.md`](references/two-lane-spec-structure.md). Create
`.agent/plans/active/<slug>-*.spec.md` only when the tracked-plan threshold in
`.agent/plans/README.md` is met or the repository owner explicitly requests it; then follow that
file's frontmatter/status contract. Do not implement until prepReadiness allows it **and** the
current task authorizes implementation; a second approval is not required when the user's current
request already authorizes the bounded implementation.

Merge conflicts / promote / Preview-Production apply remain **publication** scope — not this skill.

## Parallelism

For large inventories, group phases with
[`celebra-delegation-patterns`](../celebra-delegation-patterns/SKILL.md). Otherwise stay sequential.

## Pitfalls

- SQL/payload existence ≠ live invitation (placeholders → 404)
- Using a real client slug as `templateId`
- Assuming preset equality means visual parity under custom SCSS
- Starting implementation while prepReadiness is `NOT_READY`
- Hand-writing `READY_FOR_IMPLEMENTATION` while assets are still provisional
- Treating WhatsApp images as production-ready assets
- Recording agent recommendations as `verified` client facts
- Committing absolute client paths or chat-title dumps into `docs/invitations/`
- Loading `intake-publishing` or publication runbooks during preparation
- Starting implementation before the two-lane spec exists (when doing implementation audit)
- Freezing slug/alias on inferred surname spelling

## Hard constraints

- Preparation Markdown updates are allowed when the task authorizes preparation work.
- Implementation code changes remain blocked while prepReadiness is `NOT_READY`.
- Markdown prepReadiness must match `evaluatePreparationReadiness`.
- No Preview/Production mutation, staging, or commits from this skill without explicit authorization.
- Visible copy stays Spanish; identifiers/comments English.
