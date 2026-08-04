# Invitation Preparation Contract — Celebra-me

**Owns:** preparation-phase information semantics, canonical Markdown schema, placeholder policy,
preparation readiness states (aligned to executable helpers), intake channels, info-hygiene for
durable prep state, WhatsApp-vs-assets separation, and the link to executable evaluation.

**Does not own:** publication/apply runbook, managed lifecycle CLI flags, theme tokens, dashboard
intake status machine (`intake-publishing`), or technical Local/Preview/Production readiness
(`invitation-readiness.ts` / **envReadiness**).

Related authorities:

- Workflow — [`.agent/workflows/invitation-preparation.md`](../../.agent/workflows/invitation-preparation.md)
- Analysis skill — [`.agent/skills/client-invitation-audit/SKILL.md`](../../.agent/skills/client-invitation-audit/SKILL.md)
- Executable SSOT — [`src/lib/invitation-preparation/`](../../src/lib/invitation-preparation/)
- Markdown template —
  [`.agent/templates/invitation/preparation-state.md`](../../.agent/templates/invitation/preparation-state.md)
- Durable per-invite state — `docs/invitations/<slug>.md`
- Post-prep identity — [`invitation-creation-contract.md`](./invitation-creation-contract.md)
  (load only after preparation readiness allows implementation, or when freezing identity fields
  that the creation contract defines)

Conceptual lifecycle: **Preparation → Implementation → Managed lifecycle / publication**.

---

## 1. Intake channels

| Channel | Role | Notes |
| ------- | ---- | ----- |
| Full chat / WhatsApp (text, photos, videos) | **Evidence** | Facts, preferences, constraints, ambiguities; media proves claims, not managed assets |
| High-resolution (HR) photo URL or approved folder/repo path | **Asset source** | Required before photograph inventory |
| Dashboard intake / editor publish state | **Out of scope** | Owned by intake-publishing + publication chain — not this contract |

WhatsApp / conversation material is a source of client facts, event requirements, preferences,
explicit decisions, constraints, textual content, and unresolved ambiguities.

It is **not** the authoritative source of invitation photographs or managed visual assets. Chat
attachments must not be ingested into managed asset storage. Photos for production inventory must
come from an explicit high-resolution URL and/or filesystem/repository path supplied for the
invitation, then processed under the asset-preparation protocol.

Do not implement WhatsApp API synchronization in this contract. The workflow operates on supplied
conversation material only.

---

## 2. Information classifications

Canonical states (executable: `InfoClassification` in
`src/lib/invitation-preparation/classification.ts`):

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

**Ambiguous-fact discipline:** `ambiguous` on a required or conditional completeness field is
**blocking** until resolved or validly marked `not_applicable`. Do not describe the invitation as
complete, done, or release-ready while such ambiguity remains.

**Identity spelling freeze:** Before freezing `slug` and `hostLoginAlias`, celebrant/honoree name
orthography must be `verified` (or an explicit owner override recorded). Do not lock identity on
inferred spelling.

**Slug vs route:** Never include `eventType` in the slug. The public path is already
`/{eventType}/{slug}` — see
[`invitation-creation-contract.md`](./invitation-creation-contract.md) (Canonical Slug).

---

## 3. Event-type completeness

Executable contracts live in `src/lib/invitation-preparation/event-completeness.ts` (**SSOT**).

Each field supports: `required` | `conditional` | `recommended` | `optional`.

Contract maturity:

| Maturity | Meaning |
| -------- | ------- |
| `evidence-backed` | Sufficient verified practice to evaluate preparation completeness |
| `partial` | Some fields evidenced; gaps documented |
| `undefined` | Only global identity minima; do not invent a full matrix |

Current posture:

- `xv` — evidence-backed
- `boda`, `cumple`, `baby-shower` — partial (evidenced field lists in
  `event-completeness.ts`)
- `bautizo`, `primera-comunion` — undefined (minima only)

**Process for undefined / partial:** Evaluate only defined fields; record maturity gaps in Markdown;
apply client-specific constraints from chat as classified facts. Do not invent XV-scale matrices for
under-evidenced event types.

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
Recommendations, Sections, Design Direction, Photograph Inventory (including uniqueness),
Implementation Constraints, Preparation Readiness.

### 4.1 Info-hygiene — persist vs session-only

| May persist in `docs/invitations/<slug>.md` | Session-only / never commit |
| ------------------------------------------- | --------------------------- |
| Opaque source labels (e.g. `source:wa-export`, `source:hr-photos`) | Absolute OneDrive / `Clientes\` / user-profile paths |
| Classified facts needed to build the invite (names, dates, venues as event content) | Full chat exports, raw transcripts, photo/video dumps |
| Repo-relative asset paths under the repository | Chat folder titles that embed contact names (`WhatsApp Chat - …`) |
| High-level “HR photo URL on file (session)” without the secret URL | Paste of payroll / HR-portal / credential-bearing / environment URLs |
| Quality labels, role map, uniqueness table | Screenshots of private chats committed as binaries |

**Forbidden in durable prep docs and agent commits:** absolute machine paths to client folders;
chat-title dumps as durable identity; human-resources/payroll/internal portal URLs; secrets;
credential-bearing links.

**Demo crossover:** never point a demo `_assetSlug` at a real client asset directory (see skill
content-profile invariants).

---

## 5. Missing-information semantics

| Kind | Effect |
| ---- | ------ |
| Blocking missing data | Prevents READY_*; implementation forbidden when `NOT_READY` |
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

1. Require an explicit high-resolution URL and/or source asset path (opaque label in Markdown).
2. Inventory images; preserve originals.
3. Record dimensions, format, orientation, weight, quality, role, duplicates, processing.
4. Classify WhatsApp-compressed material as `provisional-whatsapp`.
5. Produce a **photo uniqueness** map: each production role has a distinct source unless intentional
   multi-role reuse is documented.
6. Produce a role-aware optimization **plan** using transfer-weight targets in
   `image-optimization.ts` (targets, not hard limits).
7. Do not recompress already suitable images solely for process theater.
8. Generate derivatives only when crop/DPR/role weight justifies it.
9. **Double-encode note:** Prefer delivering already-normalized managed-release WebPs without a
   second Astro/`getImage` encode that upscales or re-compresses past native width (see Hero
   managed-URL direct delivery). Record the risk when sources are provisional.

Existing `normalizeInvitationImage` and publish dimension gates remain the runtime enforcers.
WhatsApp attachments never become managed assets without this protocol and explicit quality labels.

Helpers: `planImageOptimization`, `summarizeAssetQuality`, `isProductionAuthoritativeImage`.

---

## 8. Demo and visual decisions

- Client-selected demo ⇒ `verified`.
- No selection ⇒ recommend options; final choice `requires_owner_decision`.
- Client colors preserved when stated; otherwise recommend separately until approved.

---

## 9. Preparation readiness (**prepReadiness**)

Independent from technical publication readiness (**envReadiness** —
`invitation-readiness.ts` / `pnpm invitation:update --status`).

| State | Meaning |
| ----- | ------- |
| `NOT_READY` | Blocking gaps/assets/decisions remain; **no** payload/SCSS implementation |
| `READY_WITH_PLACEHOLDERS` | Structure resolved; only documented non-blocking placeholders and/or provisional asset replacements |
| `READY_FOR_IMPLEMENTATION` | Required facts/assets/decisions resolved; production-authoritative assets; no placeholders remain |

### 9.1 Helper is SSOT (F01 / F17)

Executable evaluation in `src/lib/invitation-preparation/readiness.ts` is the **only** authority for
prepReadiness:

- `evaluatePreparationReadiness`
- `summarizeAssetQuality` / `onlyNonProductionImages`
- `canBeginImplementation` / `assertImplementationAllowed`

**Markdown must mirror the helper.** Hand-editing `READY_FOR_IMPLEMENTATION` while assigned
production roles remain `provisional-whatsapp` (or `summarizeAssetQuality` reports
`onlyNonProductionImages: true`) is **invalid**. The correct ceiling is
`READY_WITH_PLACEHOLDERS` until production-ready assets exist.

Agents must **cite** the helper outcome when updating Preparation Readiness (session note + history
row). Repository gate: `pnpm validate:invitation-preparation` (Markdown prepReadiness ↔ helpers +
hygiene). Prose alignment to the helpers remains mandatory between runs.

---

## 10. Owner interaction

Before asking the owner anything, exhaust conversation material, canonical Markdown, event contract,
assets, repository conventions, compatible demos, and deterministic project knowledge.

Then emit one consolidated owner decision pack (`buildOwnerDecisionPack`) whenever feasible.

Conversational phase script (checkpoints and hard-stops):
[`.agent/skills/client-invitation-audit/references/conversational-phase-script.md`](../../.agent/skills/client-invitation-audit/references/conversational-phase-script.md).
