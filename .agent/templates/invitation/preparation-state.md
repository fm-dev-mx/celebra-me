# Canonical Invitation Preparation State — `<slug>`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Workflow: `.agent/workflows/invitation-preparation.md`

Copy to `docs/invitations/<slug>.md` and update in place. Do not create a parallel state tree under
`.agent/`. Respect info-hygiene (contract §4.1): opaque source labels only — no absolute
OneDrive/`Clientes` paths, chat-title dumps, or credential-bearing URLs.

---

## Identity

| Parameter              | Value                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Slug**               | `<slug>` (freeze only with verified orthography)                                    |
| **Host Login Alias**   | `<primer_nombre_primer_apellido>` (see `docs/core/invitation-creation-contract.md`) |
| **Event Type**         | `<eventType>`                                                                       |
| **Preparation Status** | Must match helper: `NOT_READY` / `READY_WITH_PLACEHOLDERS` / `READY_FOR_IMPLEMENTATION` |

**Preparation Readiness (prepReadiness):** `NOT_READY`

Must equal `evaluatePreparationReadiness` for the facts/assets/design recorded below. Provisional-only
assets cannot be `READY_FOR_IMPLEMENTATION`.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                         | Reference                         | Notes                                                      |
| ------------------------------ | --------------------------------- | ---------------------------------------------------------- |
| WhatsApp / conversation        | `source:wa-export` (opaque label) | Evidence only — never photo SoT; no chat-title dumps       |
| High-res photos / assets root  | `source:hr-photos` (opaque label) | Required before photo analysis; real URL/path is session-only |
| Other authoritative references | —                                 | PDFs, emails, prior Markdown — no secrets                  |

---

## Fact Register

Classification must be one of: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable`
| `requires_owner_decision`.

| field           | value | classification          | source | notes                                            |
| --------------- | ----- | ----------------------- | ------ | ------------------------------------------------ |
| celebrantName   |       | missing                 |        | Orthography must be verified before identity freeze |
| eventDate       |       | missing                 |        |                                                  |
| baseDemoId      |       | requires_owner_decision |        | Recommendation lives under Agent Recommendations |
| sourceAssetPath |       | missing                 |        | Opaque label only in this file                   |

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- `ambiguous` must preserve competing interpretations in notes; blocking when required/conditional.
- Absence of information never implies consent or preference.

---

## Event Completeness

Contract maturity for this event type: `evidence-backed` | `partial` | `undefined` (from
`getEventCompletenessContract` — do not invent fields for undefined/partial gaps).

| requirement | fields | status |
| ----------- | ------ | ------ |
| required    |        |        |
| conditional |        |        |
| recommended |        |        |
| optional    |        |        |

### Missing blockers

- …

### Non-blocking gaps

- …

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes` / `no` (from `evaluateEventCompleteness`).

---

## Placeholders

Use only grep-able tokens: `[[PENDIENTE:FIELD_ID]]`.

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |
|       |               | no       |        |                         |

`READY_WITH_PLACEHOLDERS` may contain only documented **non-blocking** placeholders. Blocking
placeholders force `NOT_READY`.

---

## Owner Decisions

Unresolved items requiring human authorization (prefer one consolidated pack via
`buildOwnerDecisionPack`):

| id  | category | issue | evidence | options | recommendation |
| --- | -------- | ----- | -------- | ------- | -------------- |
|     |          |       |          |         |                |

Categories: `missing-client-facts` | `ambiguous-data` | `demo-design-decisions` |
`photograph-acceptance` | `other-blocking`.

---

## Agent Recommendations

Keep strictly separate from Fact Register and Owner Decisions. Never copy these into `verified`
client requirements without explicit approval.

| topic   | recommendation | basis                       | status                 |
| ------- | -------------- | --------------------------- | ---------------------- |
| demo    |                | catalog + sections + assets | pending owner decision |
| palette |                | photos / theme              | pending owner decision |

---

## Sections

| bucket                 | section keys |
| ---------------------- | ------------ |
| requested              |              |
| inferred / recommended |              |
| omitted                |              |
| unresolved             |              |

---

## Design Direction

| decision                          | value | classification          |
| --------------------------------- | ----- | ----------------------- |
| Client-selected demo              |       | verified / missing      |
| Recommended demo alternatives     |       | recommendation only     |
| Selected variant / visual profile |       |                         |
| Client color requirements         |       | verified / missing      |
| Recommended palette               |       | recommendation only     |
| Unresolved visual decisions       |       | requires_owner_decision |

If the client did not select a demo, final selection remains `requires_owner_decision`.

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque)  
Originals must be preserved. WhatsApp-compressed files are `provisional-whatsapp`, never silent
production assets. `summarizeAssetQuality` / `onlyNonProductionImages` caps prepReadiness.

| source filename | dims | format | orientation | weight | quality | role | duplicate | processing | derivative |
| --------------- | ---- | ------ | ----------- | ------ | ------- | ---- | --------- | ---------- | ---------- |
|                 |      |        |             |        |         |      |           |            |            |

### Uniqueness table (required before READY_*)

| role | source | derivative | intentional multi-role? |
| ---- | ------ | ---------- | ----------------------- |
|      |        |            | no                      |

Quality: `production-ready` | `provisional-whatsapp` | `temporary-placeholder` | `missing` |
`unusable`.

Role-aware WebP transfer-weight **targets** (guidance, not hard limits):

| Role               |     Target |
| ------------------ | ---------: |
| Hero desktop       | 250–500 KB |
| Hero mobile        | 180–350 KB |
| Editorial featured | 150–300 KB |
| Standard section   | 100–220 KB |
| Gallery            |  80–180 KB |
| Small/card         |  40–100 KB |
| Thumbnail          |   20–60 KB |

Do not recompress already suitable images solely to satisfy a generic process. Avoid double-encode /
upscale of managed-release WebPs.

---

## Implementation Constraints

- prepReadiness must be `READY_WITH_PLACEHOLDERS` or `READY_FOR_IMPLEMENTATION` (helper-aligned)
  before payload / invitation-specific SCSS work.
- Lane A inheritance resets (list properties to clear from preset):
- Lane B notes (only if client **and** demo benefit):
- Music omit / include:
- Other:

---

## Preparation Readiness History

| date | readiness   | helper basis                         | notes               |
| ---- | ----------- | ------------------------------------ | ------------------- |
|      | `NOT_READY` | `evaluatePreparationReadiness`       | Initial preparation |
