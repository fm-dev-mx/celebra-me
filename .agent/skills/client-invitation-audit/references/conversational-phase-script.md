# Conversational Phase Script — Invitation Preparation

Provider-neutral script for interactive preparation. Orchestration owner:
[`.agent/workflows/invitation-preparation.md`](../../../workflows/invitation-preparation.md).
Semantics SSOT: [`docs/core/invitation-preparation-contract.md`](../../../../docs/core/invitation-preparation-contract.md).
Executable evaluation: `src/lib/invitation-preparation/` (cite helpers; do not invent readiness).

Use with live `EVENT_TYPES` (`cumple`, not `cumpleanos`). Client-specific hard-stops override
generic ones when the owner states them.

---

## Intake channels (session)

| Channel | Role | Persisted how |
| ------- | ---- | ------------- |
| Full chat / WhatsApp export (text + photos/videos) | **Evidence** for facts, preferences, constraints, ambiguities | Opaque source label in Markdown; classified facts only — never raw dump |
| High-resolution (HR) photo URL or approved cloud/folder path | **Authoritative asset source** for inventory | Opaque label or repo-relative path in Sources / Photograph Inventory |
| Chat attachments alone | Evidence that photos exist; **not** managed assets | Claim in Fact Register; still require HR URL / explicit asset root |

Never call WhatsApp APIs. Never treat chat media as `production-ready` without the asset-preparation
protocol and quality labels.

---

## Phase script

### C0 — Open & baseline

**Agent says / does:** Confirm event type, whether this is new or resume, and that preparation (not
publication) is in scope. Run `git status --short` / branch note. Open or create
`docs/invitations/<slug>.md` only when a slug exists or owner authorizes a provisional slug label.

**Checkpoint:** Event type ∈ `EVENT_TYPES`; tree unrelated dirt noted and left alone.

**Hard-stop:** Unknown / unsupported event type → stop and ask owner (do not invent).

---

### C1 — Receive evidence (chat)

**Agent says / does:** Accept full chat as evidence. Extract facts; classify each with
`assertClassificationRules` vocabulary. Summarize classifications in chat (counts + blocking gaps).
Do **not** re-ask facts already in the material or canonical Markdown.

**Checkpoint:** Classified-facts summary presented once before asking new questions.

**Hard-stop:** No conversation material at all → ask for chat or transcript; do not invent facts.

---

### C2 — Receive asset source (HR URL / path)

**Agent says / does:** Require an explicit high-resolution photo URL and/or filesystem/repo asset
root. Refuse photograph inventory without it. Chat “we sent photos” is a claim, not a source path.

**Checkpoint:** Opaque durable Source label recorded (see info-hygiene). Session may hold the real
path/URL; Markdown must not commit absolute OneDrive/`Clientes` paths or chat folder titles.

**Hard-stop:** No asset source → `NOT_READY`; no photo analysis; no implementation.

---

### C3 — Completeness by event type

**Agent says / does:** Run `getEventCompletenessContract` / `evaluateEventCompleteness`. For
`undefined` / `partial` maturity, do not invent fields; record contract gaps. Apply client-specific
requirements from chat (e.g. omit music, legend-only gifts) as verified constraints.

**Checkpoint:** Blocking vs non-blocking gaps listed; ambiguous **required/conditional** fields
called out as blocking.

**Hard-stop:** Blocking completeness gaps → keep `NOT_READY` until resolved or validly N/A.

---

### C4 — Assets & uniqueness

**Agent says / does:** Follow asset-preparation protocol. Build role map; **photo uniqueness table**
(one production role per image unless intentional duplicate is documented). Flag
`provisional-whatsapp`, baked UI chrome, unusable. Note double-encode risk for managed WebP
delivery.

**Checkpoint:** Uniqueness table + quality states present before any READY_* claim.

**Hard-stop:** No assignable images / missing source inventory → `NOT_READY`.

---

### C5 — Demo / design / identity freeze

**Agent says / does:** Separate recommendations from decisions. Before freezing **slug** and
**hostLoginAlias**, require orthography evidence (`verified` spelling of celebrant surnames). Put
unresolved demo/palette choices in the owner pack — never as `verified`.

**Checkpoint:** Identity freeze checklist complete or `requires_owner_decision`.

**Hard-stop:** Unresolved demo when required by completeness → blocks READY_*.

---

### C6 — One owner decision pack

**Agent says / does:** Exhaust material first. Emit **one** consolidated pack via
`buildOwnerDecisionPack` / `formatOwnerDecisionPackMarkdown`. Prefer a single round.

**Checkpoint:** Pack presented; no piecemeal drip of questions when a pack is possible.

**Hard-stop:** If pack has blocking items unanswered → remain `NOT_READY`.

---

### C7 — Readiness (helper SSOT) & Markdown update

**Agent says / does:** Compute readiness with `evaluatePreparationReadiness` (and
`summarizeAssetQuality`). Write the **same** state into Markdown. Cite helper outcome in the
session. Vocabulary: **prepReadiness** (this) vs **envReadiness** (`invitation:release --status` /
`invitation-readiness.ts`) — never conflate.

**Rules:**

- `onlyNonProductionImages` / any assigned role still `provisional-whatsapp` (with no
  `production-ready` set) ⇒ at best `READY_WITH_PLACEHOLDERS`, **never**
  `READY_FOR_IMPLEMENTATION`.
- Markdown that disagrees with the helper is invalid — correct the Markdown.

**Checkpoint:** prepReadiness line + history row match helper; run
`pnpm validate:invitation-preparation` when docs changed.

**Hard-stop:** `NOT_READY` → do not implement payloads or invite-specific SCSS
(`assertImplementationAllowed`).

---

### C8 — Handoff

| prepReadiness | Action |
| ------------- | ------ |
| `NOT_READY` | Stop. Owner pack only. |
| `READY_WITH_PLACEHOLDERS` | Implementation allowed only with documented provisional assets + replacement requirements. |
| `READY_FOR_IMPLEMENTATION` | Implementation allowed when task authorizes; then design-reference / managed lifecycle as authorized. |

Publication, merge conflicts, Preview/Production = **out of scope** for this script.

---

## Classified-facts summary (required shape)

Present before C6 questions:

```text
Verified: <n> | Inferred: <n> | Ambiguous (blocking): <n> | Missing (blocking): <n>
Owner decisions pending: <n> | N/A: <n>
Asset source: present | missing
prepReadiness (helper): NOT_READY | READY_WITH_PLACEHOLDERS | READY_FOR_IMPLEMENTATION
```

---

## Ambiguous-fact discipline

- `ambiguous` on a required/conditional field is **blocking** until resolved or explicitly
  `not_applicable`.
- Do not describe Local work as “done / complete / release-ready” while blocking ambiguity remains
  (e.g. street spelling forks).
- Record competing readings in notes; put resolution in the owner pack.
