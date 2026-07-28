# Invitation Preparation Contract — Celebra-me

**Owns:** preparation-phase information semantics, canonical Markdown schema, placeholder policy,
preparation readiness states, WhatsApp-vs-assets separation, and the link to executable evaluation.

**Does not own:** publication/apply runbook, managed lifecycle CLI flags, theme tokens, or technical
Local/Preview/Production readiness (`invitation-readiness.ts`).

Related authorities:

- Workflow — [`.agent/workflows/invitation-preparation.md`](../../.agent/workflows/invitation-preparation.md)
- Analysis skill — [`.agent/skills/client-invitation-audit/SKILL.md`](../../.agent/skills/client-invitation-audit/SKILL.md)
- Executable SSOT — [`src/lib/invitation-preparation/`](../../src/lib/invitation-preparation/)
- Markdown template —
  [`.agent/templates/invitation/preparation-state.md`](../../.agent/templates/invitation/preparation-state.md)
- Durable per-invite state — `docs/invitations/<slug>.md`
- Post-prep identity — [`invitation-creation-contract.md`](./invitation-creation-contract.md)

Conceptual lifecycle: **Preparation → Implementation → Managed lifecycle / publication**.

---

## 1. WhatsApp intake

WhatsApp / conversation material is a source of:

- client facts;
- event requirements;
- preferences;
- explicit decisions;
- constraints;
- textual content;
- unresolved ambiguities.

It is **not** the authoritative source of invitation photographs or managed visual assets. Photos
must come from an explicit filesystem/repository path supplied for the invitation.

Do not implement WhatsApp API synchronization or attachment ingestion in this contract. The workflow
operates on supplied conversation material only.

---

## 2. Information classifications

Canonical states (executable: `InfoClassification`):

| State | Meaning |
| ----- | ------- |
| `verified` | Explicit supporting client/source evidence exists |
| `inferred` | Agent-derived; must include basis; never presented as a client statement |
| `ambiguous` | Competing interpretations preserved in notes |
| `missing` | Not present; absence is not consent |
| `not_applicable` | Event contract or invitation scope excludes the field |
| `requires_owner_decision` | Subjective/commercial choice; recommendation must not auto-apply |

Creative recommendations must be stored under **Agent Recommendations**, never as `verified`
client requirements until explicitly approved.

---

## 3. Event-type completeness

Executable contracts live in `src/lib/invitation-preparation/event-completeness.ts`.

Each field supports: `required` | `conditional` | `recommended` | `optional`.

Contract maturity:

| Maturity | Meaning |
| -------- | ------- |
| `evidence-backed` | Sufficient verified practice to evaluate preparation completeness |
| `partial` | Some fields evidenced; gaps documented |
| `undefined` | Only global identity minima; do not invent a full matrix |

Current posture:

- `xv` — evidence-backed
- `boda` — partial
- `bautizo`, `cumple`, `baby-shower`, `primera-comunion` — undefined (minima only)

Live event-type identifiers use `cumple` (not `cumpleanos`).

`evaluateEventCompleteness(eventType, facts)` answers deterministically whether available
information is sufficient to prepare (no blocking unresolved required/conditional fields).

---

## 4. Canonical invitation Markdown

Path: `docs/invitations/<slug>.md`

This file is the durable preparation source of truth. Update it in place. Conversation context and
tracked plans must not replace it.

Required sections match `.agent/templates/invitation/preparation-state.md`:

Identity, Sources, Fact Register, Event Completeness, Placeholders, Owner Decisions, Agent
Recommendations, Sections, Design Direction, Photograph Inventory, Implementation Constraints,
Preparation Readiness.

---

## 5. Missing-information semantics

| Kind | Effect |
| ---- | ------ |
| Blocking missing data | Prevents `READY_*`; implementation forbidden |
| Non-blocking missing data | May use a controlled placeholder; preparation may continue |
| Ambiguous data | Requires resolution; blocking when the field is required/conditional |
| Owner decision | Cannot be inferred |
| Not applicable | Valid closed state |

Do not fabricate plausible client content as a substitute for missing information.

---

## 6. Placeholder policy

Tokens: `[[PENDIENTE:FIELD_ID]]` (grep-able).

- Register every placeholder in the Markdown.
- Identify the real missing datum and replacement requirement.
- Never treat a placeholder as verified production content.
- Blocking placeholders ⇒ `NOT_READY`.
- `READY_WITH_PLACEHOLDERS` may contain only documented non-blocking placeholders.

Helpers: `createPlaceholderToken`, `findPlaceholderTokens`, `validatePlaceholderRecords`.

---

## 7. Asset preparation

1. Require an explicit source asset path.
2. Inventory images; preserve originals.
3. Record dimensions, format, orientation, weight, quality, role, duplicates, processing.
4. Classify WhatsApp-compressed material as `provisional-whatsapp`.
5. Produce a role-aware optimization **plan** using transfer-weight targets in
   `image-optimization.ts` (targets, not hard limits).
6. Do not recompress already suitable images solely for process theater.
7. Generate derivatives only when crop/DPR/role weight justifies it.

Existing `normalizeInvitationImage` and publish dimension gates remain the runtime enforcers.

---

## 8. Demo and visual decisions

- Client-selected demo ⇒ `verified`.
- No selection ⇒ recommend options; final choice `requires_owner_decision`.
- Client colors preserved when stated; otherwise recommend separately until approved.

---

## 9. Preparation readiness

Independent from technical publication readiness.

| State | Meaning |
| ----- | ------- |
| `NOT_READY` | Blocking gaps/assets/decisions remain; **no** payload/SCSS implementation |
| `READY_WITH_PLACEHOLDERS` | Structure resolved; only documented non-blocking placeholders / provisional replacements |
| `READY_FOR_IMPLEMENTATION` | Required facts/assets/decisions resolved; no placeholders remain |

Executable: `evaluatePreparationReadiness`, `canBeginImplementation`, `assertImplementationAllowed`.

---

## 10. Owner interaction

Before asking the owner anything, exhaust conversation material, canonical Markdown, event contract,
assets, repository conventions, compatible demos, and deterministic project knowledge.

Then emit one consolidated owner decision pack (`buildOwnerDecisionPack`) whenever feasible.
