---
description: Provider-neutral workflow for interactive invitation preparation before implementation.
lifecycle: evergreen
domain: invitations
owner: workflow-governance
---

# Workflow: Invitation Preparation

**Owns:** orchestration of the preparation phase for a new or resumed client invitation until
**prepReadiness** is known (aligned to executable helpers) and the canonical Markdown state is
updated; conversational intake UX checkpoints.

**Does not own:** publication/apply semantics, dashboard intake publish state
(`intake-publishing`), theme token architecture, copywriting voice, or technical
Local/Preview/Production readiness (**envReadiness**). Downstream authorities remain unchanged.

## Authority

Load in this order; do not copy semantics across layers:

1. This workflow — preparation sequence, conversational checkpoints, handoff boundary.
2. `.agent/skills/client-invitation-audit` — reusable analysis + phase script references.
3. `docs/core/invitation-preparation-contract.md` — classification, hygiene, placeholders,
   readiness policy, Markdown schema.
4. Executable helpers — `src/lib/invitation-preparation/` (**SSOT** for completeness, readiness,
   placeholders, owner pack, image plan). Cite helpers when recording prepReadiness; confirm with
   `pnpm validate:invitation-preparation`.
5. Identity / publication chain **only after** prepReadiness allows implementation **and** the task
   authorizes implementation:
   - `docs/core/invitation-creation-contract.md`
   - `docs/domains/intake/production-flow.md`
   - `.agent/workflows/managed-invitation-lifecycle.md`
   - `.agent/rules/invitation-production.md`
   - live `pnpm invitation:update -- --help`

Do **not** load `intake-publishing.md` during preparation.

Conceptual lifecycle:

```text
Preparation → Implementation → Managed lifecycle / publication
```

Durable preparation state lives only at `docs/invitations/<slug>.md`. Do not create a parallel
state tree under `.agent/`.

## Entry conditions

Use this workflow when preparing a **real** client invitation before payload/SCSS implementation,
or when resuming preparation from an existing `docs/invitations/<slug>.md`.

Required inputs:

- event type (`EVENT_TYPES`);
- conversation / WhatsApp evidence (full chat allowed as evidence — facts + media claims);
- explicit high-resolution (HR) photo URL and/or photograph/assets filesystem or repository path.

Optional:

- invitation slug (required before writing the canonical Markdown path);
- existing `docs/invitations/<slug>.md` when resuming.

Hard separations:

- Chat is **evidence**; HR URL / explicit asset root is the **asset source**.
- WhatsApp attachments are **not** managed/production assets without the asset-preparation protocol.
- Agent recommendations are never recorded as client requirements.
- Absence of a preference is never consent.
- Info-hygiene: see contract §4.1 (no committed absolute `Clientes`/OneDrive paths; opaque source
  labels).

## Conversational procedure

Follow
[`.agent/skills/client-invitation-audit/references/conversational-phase-script.md`](../skills/client-invitation-audit/references/conversational-phase-script.md)
phases **C0–C8**. Skill analysis phases **P0–P5** implement the analytical work inside those
checkpoints (do not invent a third phase numbering scheme).

Summary:

1. **C0** — Identify event type; slug or `requires_owner_decision`; baseline git note.
2. **C1** — Receive chat evidence; classify; present classified-facts summary.
3. **C2** — Receive HR URL / asset root; refuse inventory without it; persist opaque Sources only.
4. **C3–C5** — Completeness (`evaluateEventCompleteness`), assets + uniqueness, demo/design,
   identity spelling freeze.
5. **C6** — One consolidated owner decision pack (`buildOwnerDecisionPack`).
6. **C7** — Evaluate **prepReadiness** with `evaluatePreparationReadiness` /
   `summarizeAssetQuality`; update Markdown to **match the helper** (never hand-promote to
   `READY_FOR_IMPLEMENTATION` while only provisional assets remain).
7. **C8** — Handoff by prepReadiness; envReadiness remains out of scope.

## Outputs

- Updated `docs/invitations/<slug>.md` (hygiene-compliant)
- prepReadiness state identical to helper outcome
- Optional owner decision pack (single round when feasible)
- Explicit statement that **envReadiness** is still owned by `invitation-readiness` /
  `pnpm invitation:update --status`

## Non-goals

Do not create a parallel creation stack, change `invitation:update` semantics, ingest WhatsApp
attachments as managed assets, replace dashboard intake, pull `intake-publishing` into prep, or
redesign invitation components. Do not extend the validate CLI beyond prep hygiene/alignment without
owner scope.
