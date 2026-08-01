---
title: Invitation Preparation — Goal 2 Handoff & Goal 3 Automation List
status: active
created: 2026-07-31
updated: 2026-07-31
related_skills:
  - client-invitation-audit
related_docs:
  - .agent/plans/active/invitation-preparation-authority-baseline.md
  - docs/core/invitation-preparation-contract.md
  - .agent/workflows/invitation-preparation.md
  - .agent/skills/client-invitation-audit/SKILL.md
  - .agent/skills/client-invitation-audit/references/conversational-phase-script.md
  - src/lib/invitation-preparation/
  - scripts/validate-invitation-preparation.ts
supersedes: []
superseded_by: []
---

# Invitation Preparation — Goal 2 Handoff & Goal 3 Automation List

Goals 1–2 diagnosis/process closed; **Goal 3 automation landed** (see §6).

Diagnosis SSOT: [invitation-preparation-authority-baseline.md](./invitation-preparation-authority-baseline.md).

---

## 1. What Goal 2 closed (process / docs)

| Finding | Closure |
| ------- | ------- |
| **F01 / F02** | Contract §9.1 + skill/workflow/template: Markdown prepReadiness must mirror `evaluatePreparationReadiness`; provisional-only ⇒ ceiling `READY_WITH_PLACEHOLDERS` |
| **F03 / F15** | Contract §4.1 info-hygiene; template Sources opaque labels; WhatsApp + asset refs updated; chat = evidence, HR photo URL = asset source; portal/payroll URLs forbidden |
| **F10** | `intake-publishing.md` removed from `invitation_preparation` route; skill preconditions no longer pull creation/production early |
| **F04** | Asset protocol + contract §7 double-encode note |
| **F05** | Identity spelling freeze in contract §2, skill P3, template, conversational C5 |
| **F06** | Ambiguous-fact discipline in contract + conversational script |
| **F07** | Lane A inheritance-reset checklist in skill Phase 2 + `two-lane-spec-structure.md` |
| **F08** | Process: do not invent fields; maturity promotion deferred to Goal 3 library |
| **F09** | Uniqueness table required in protocol, template, script C4 |
| **F13 / F14** | prepReadiness vs envReadiness vocabulary; C0–C8 script + P0–P5 analysis (no P0–P6 drift) |
| **F17 (prose)** | Explicit cite-helpers bridge; validate CLI named as Goal 3 |
| **UX** | `references/conversational-phase-script.md` — phases, checkpoints, one owner pack, hard-stops |

Still **publication**-owned (not prep): F11 Lane B demo catalog gaps, F12 merge conflicts.

---

## 2. Goal 3 automation list (prose-only → helpers / tests / CLI)

Implement only these items. Prefer extending `src/lib/invitation-preparation/` + `package.json`
validate scripts; do not invent parallel readiness semantics.

| ID | Automation | Justified by | Suggested shape |
| -- | ---------- | ------------ | --------------- |
| **A1** | **Validate CLI / `validate:` script** that parses `docs/invitations/<slug>.md` and asserts documented prepReadiness equals `evaluatePreparationReadiness` for reconstructed inputs (facts, placeholders, asset quality summary, design summary) | F01, F02, F17 | `pnpm validate:invitation-preparation` (or scoped under `validate:changed`); fail on Markdown/helper drift |
| **A2** | Parser helpers for Photograph Inventory quality column + uniqueness table → `summarizeAssetQuality` / `onlyNonProductionImages` | F01, F09 | Extend `markdown-state.ts`; unit tests |
| **A3** | Hygiene lints on `docs/invitations/**/*.md`: forbid absolute `OneDrive`, `Clientes\`, `C:\Users\`, chat-title patterns (`WhatsApp Chat -`), credential-like URLs | F03, F15 | Structure or dedicated validate rule; unit fixtures |
| **A4** | Assert no `READY_FOR_IMPLEMENTATION` when any assigned role quality ∈ `NON_PRODUCTION_IMAGE_STATES` (or inventory-only provisional) | F01, F02 | Part of A1 or readiness unit cases from real Markdown fixtures |
| **A5** | Promote `cumple` and `baby-shower` event-completeness contracts from `undefined` → `partial` with evidenced fields (Alba / Leah corpus) | F08 | `event-completeness.ts` + unit tests only — no invented XV-scale matrices |
| **A6** | Optional: uniqueness-table presence gate before READY_* in Markdown validate | F09 | A1 companion check |
| **A7** | No-leak / demo invariants in validate surface: durable Markdown must not embed demo `_assetSlug` equality claims against real dirs; keep existing `validate:no-pii` for content collections | F15, demo crossover | Cross-check skill invariants where parseable; do not strip legitimate celebrant event facts from prep Markdown |
| **A8** | Optional regression fixture: Alba-like Markdown with provisional inventory must evaluate to `READY_WITH_PLACEHOLDERS`, not `READY_FOR_IMPLEMENTATION` | F01 corpus | Fixture under `tests/fixtures/invitation-preparation/` |

### Explicitly out of Goal 3 (unless owner expands scope)

- Rewriting managed merge / promote tooling (F12)
- Building missing theme demo JSON (F11) — theme catalog work
- Creating or publishing the next client invitation
- Preview/Production mutations

---

## 3. Approved intake / UX contract (for Goal 3 assertions)

| Topic | Rule |
| ----- | ---- |
| Channels | Full chat = evidence; HR **photo** URL / asset root = asset source |
| Persist in `docs/invitations/` | Opaque labels, classified facts, uniqueness/quality tables, helper-aligned prepReadiness |
| Session-only | Absolute paths, raw URLs secrets, chat dumps, media binaries |
| Phases | Conversational C0–C8; analysis P0–P5 inside them |
| Owner interaction | One consolidated `buildOwnerDecisionPack` when feasible |
| Hard-stops | No event type; no asset source; `NOT_READY`; ambiguous required fields; identity freeze without verified spelling |
| WA attachments | Never managed assets without asset-preparation protocol + quality labels |

---

## 4. No-leak invariants Goal 3 must assert in code

1. No absolute client FS paths / OneDrive / `Clientes` in committed `docs/invitations/**`.
2. No WhatsApp chat-folder title dumps as durable Sources identity.
3. No payroll / HR-portal / credential-bearing URLs in those docs.
4. prepReadiness never `READY_FOR_IMPLEMENTATION` under provisional-only inventories.
5. Demo crossover: where parseable, real vs demo `_assetSlug` must remain distinct (reinforce
   existing demo/content guards; prep validate may only check Markdown claims).
6. Preserve `validate:no-pii` for content collections (prep Markdown may still hold event identity
   facts by design — do not conflate with path/chat hygiene).

---

## 5. Short handoff (historical Goal 2 → 3)

- **G2 closed:** readiness binding prose, info-hygiene, routing/preconditions, conversational script,
  P1 process controls, F17 prose bridge.
- **G3 remains:** A1–A8 above — especially **validate CLI (F17)** and Markdown↔helper alignment
  (F01). Start with A1 + A3 + A4/A8.

---

## 6. Goal 3 closure (2026-07-31)

### Executable controls delivered

| ID | Status | Location |
| -- | ------ | -------- |
| **A1** | Done | `pnpm validate:invitation-preparation` → `scripts/validate-invitation-preparation.ts` + `evaluateDocumentedPreparationAlignment` |
| **A2** | Done | `markdown-state.ts` parsers (inventory quality column, uniqueness, placeholders, design, assets) |
| **A3** | Done | `hygiene.ts` + validate script (skips meta README) |
| **A4** | Done | Embedded in alignment (forbids `READY_FOR_IMPLEMENTATION` with non-production qualities) |
| **A5** | Done | `cumple` + `baby-shower` → `partial` in `event-completeness.ts` |
| **A6** | Done | Uniqueness / photo-role map required before READY_* in alignment |
| **A7** | Done | Demo `_assetSlug` crossover lint + existing `validate:no-pii` unchanged for content collections |
| **A8** | Done | `tests/fixtures/invitation-preparation/alba-like-provisional/` + `invitation-preparation.goal3.test.ts` |

Waived: none.

### Exit answers

- **P0–P1 traceability:** F01/F02/F17 → A1+A4+A8; F03/F15 → A3+A7; F08 → A5; F09 → A2+A6; F04–F07 remain documented process (G2) without separate CLI (acceptable).
- **Chat vs HR URL:** Hygiene forbids absolute client paths / chat titles; readiness reconstruction requires `sourceAssetPath` + inventory qualities — WA attachments alone cannot clear production readiness.
- **No parallel readiness SSOT:** Validate path calls `evaluatePreparationReadiness` only.
- **Ready for next invitation creation:** Yes — use workflow + skill + `pnpm validate:invitation-preparation` after updating `docs/invitations/<slug>.md`. Creation itself not executed in Goals 1–3.

### Verify

```bash
pnpm validate:invitation-preparation
pnpm test -- tests/unit/invitation-preparation.goal3.test.ts tests/unit/invitation-preparation.test.ts
```
