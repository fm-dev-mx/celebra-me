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
   - `.agent/rules/invitation-production.md`
   - live `pnpm invitation:release -- --help`

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

### Post-implementation creative acceptance handoff

When implementation is authorized and complete, return to the same canonical
`docs/invitations/<slug>.md` record before final acceptance or release. Do not create a second
per-invitation design specification. Complete the existing Creative Direction & Acceptance section
and, when useful, link the existing `creative-qa-report` for detailed evidence.

The review must:

- inspect the rendered invitation as one narrative at representative responsive viewports (default
  pair: 390 × 844 and 1440 × 900; focused evidence is sufficient, not the full screenshot corpus);
- verify section boundaries, intersection intent, rhythm/density, and continuity between sections;
- review typography roles, surfaces, photographic treatment, and documented local exceptions;
- separate mechanical render/capture status from aesthetic acceptance;
- record reviewer, date, evidence, blockers, and one explicit human outcome:
  `PENDING`, `ACCEPTED`, `ACCEPTED_WITH_BLOCKERS`, or `REJECTED`.

Only `ACCEPTED` clears the creative gate. A non-creative owner-data dependency may be recorded as
`ACCEPTED_WITH_BLOCKERS`, but it remains blocking for the applicable Production/release boundary
without preventing unrelated implementation work. Successful rendering alone never clears this
gate.

## Outputs

- Updated `docs/invitations/<slug>.md` (hygiene-compliant)
- prepReadiness state identical to helper outcome
- Optional owner decision pack (single round when feasible)
- Explicit statement that **envReadiness** is still owned by `invitation-readiness` /
  `pnpm invitation:release --status`
- After implementation, an explicit human creative-acceptance outcome in the same canonical Markdown

## Non-goals

Do not create a parallel creation stack, change `invitation:release` semantics, ingest WhatsApp
attachments as managed assets, replace dashboard intake, pull `intake-publishing` into prep, or
redesign invitation components. Do not extend the validate CLI beyond prep hygiene/alignment without
owner scope.
