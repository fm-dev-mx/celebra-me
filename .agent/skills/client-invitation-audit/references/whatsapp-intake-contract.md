# WhatsApp Intake Contract (Preparation)

WhatsApp / conversation material participates in invitation preparation under these rules only.
Parent policy: [`docs/core/invitation-preparation-contract.md`](../../../../docs/core/invitation-preparation-contract.md)
§1 and §4.1. Conversational script:
[`conversational-phase-script.md`](conversational-phase-script.md).

## Allowed content (evidence)

Extract and classify:

- client facts;
- event requirements;
- preferences;
- explicit decisions;
- constraints;
- textual content (quotes, messages, dress notes, etc.);
- unresolved ambiguities;
- photo/video **claims** and on-screen evidence (who/what is depicted, chrome, quality cues).

Full chat including photos/videos may be used in-session as evidence. That does **not** make chat
attachments managed or production assets.

## Forbidden as authoritative asset source

- Invitation photographs for managed storage
- Managed visual assets / provision asset dirs
- Derivatives intended for `invitation-assets`

If the conversation mentions or attaches photos, record the **claim** (e.g. “sent photos”) as a
fact, and require a separate **high-resolution (HR) photo URL** and/or filesystem/repository asset
root for inventory.

## Classification

Use exactly:

`verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` | `requires_owner_decision`

Helpers: `assertClassificationRules` (`src/lib/invitation-preparation/`).

| Rule | Detail |
| ---- | ------ |
| `verified` | Requires explicit supporting text/evidence from the supplied material |
| `inferred` | Record basis; never phrase as “the client said” |
| `ambiguous` | Keep competing readings in notes; blocking when field is required/conditional |
| Absence | Never treat as consent, preference, or demo selection |
| Recommendations | Stay in Agent Recommendations until owner approval |

## Process limits

- Operate on **supplied** conversation material only.
- Do not call WhatsApp APIs.
- Do not ingest chat attachments into managed asset storage.
- Do not re-ask the owner for facts already present in the supplied material or canonical Markdown.
- Do not commit raw chat exports, absolute chat folder paths, or chat-title dumps into
  `docs/invitations/` (opaque labels only).
