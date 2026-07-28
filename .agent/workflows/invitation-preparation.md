---
description: Provider-neutral workflow for interactive invitation preparation before implementation.
lifecycle: evergreen
domain: invitations
owner: workflow-governance
---

# Workflow: Invitation Preparation

**Owns:** orchestration of the preparation phase for a new or resumed client invitation until
preparation readiness is known and the canonical Markdown state is updated.

**Does not own:** publication/apply semantics, theme token architecture, copywriting voice, or
technical Local/Preview/Production readiness. Downstream authorities remain unchanged.

## Authority

Load in this order; do not copy semantics across layers:

1. This workflow — preparation sequence and handoff boundary.
2. `.agent/skills/client-invitation-audit` — reusable analysis (WhatsApp classification, assets,
   completeness, two-lane implementation audit).
3. `docs/core/invitation-preparation-contract.md` — classification, placeholders, readiness, and
   Markdown schema.
4. Executable completeness/readiness helpers —
   `src/lib/invitation-preparation/` (SSOT for deterministic evaluation).
5. Identity / publication chain after preparation is ready:
   - `docs/core/invitation-creation-contract.md`
   - `docs/domains/intake/production-flow.md`
   - `.agent/workflows/managed-invitation-lifecycle.md`
   - `.agent/rules/invitation-production.md`
   - live `pnpm invitation:update -- --help`

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
- WhatsApp/conversation source material (path or pasted transcript — facts only);
- explicit photograph/assets filesystem or repository path.

Optional:

- invitation slug (required before writing the canonical Markdown path);
- existing `docs/invitations/<slug>.md` when resuming.

Hard separations:

- WhatsApp is **not** an authoritative photo/asset source.
- Agent recommendations are never recorded as client requirements.
- Absence of a preference is never consent.

## Procedure

1. **Identify** slug (or mark `requires_owner_decision`) and event type.
2. **Receive** WhatsApp/conversation source reference; record it under Sources in the Markdown.
3. **Receive and validate** the photograph/assets source path; refuse photo analysis without it.
4. **Load** `client-invitation-audit` and run preparation analysis (skill Phase P0–P6):
   extract/classify facts; evaluate event completeness; inventory assets; separate demo/design
   recommendations from decisions.
5. **Distinguish** blocking vs non-blocking gaps, ambiguity, owner decisions, and N/A fields.
6. **Register** controlled placeholders (`[[PENDIENTE:FIELD]]`) only for allowed non-blocking gaps.
7. **Build one consolidated owner decision pack** whenever unresolved human input remains.
8. **Update** `docs/invitations/<slug>.md` from the preparation-state template (update in place;
   do not scatter state across plans or chat memory).
9. **Evaluate preparation readiness** via `evaluatePreparationReadiness` semantics:
   `NOT_READY` | `READY_WITH_PLACEHOLDERS` | `READY_FOR_IMPLEMENTATION`.
10. **Handoff**
    - If `NOT_READY`: stop. Present the owner pack. Do not implement payloads or invite SCSS.
    - If ready: hand off to implementation using the Markdown as SoT, then
      `design-reference-to-build` when visual references apply, then
      `managed-invitation-lifecycle` for Local/Preview/Production apply.

## Outputs

- Updated `docs/invitations/<slug>.md`
- Preparation readiness state
- Optional owner decision pack (single round when feasible)
- Explicit statement that technical publication readiness is still owned by
  `invitation-readiness` / `pnpm invitation:update --status`

## Non-goals

Do not create a parallel creation stack, change `invitation:update` semantics, ingest WhatsApp
attachments as managed assets, replace dashboard intake, or redesign invitation components.
