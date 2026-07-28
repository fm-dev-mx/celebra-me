# WhatsApp Intake Contract (Preparation)

WhatsApp / conversation material participates in invitation preparation under these rules only.

## Allowed content

Extract and classify:

- client facts;
- event requirements;
- preferences;
- explicit decisions;
- constraints;
- textual content (quotes, messages, dress notes, etc.);
- unresolved ambiguities.

## Forbidden as authoritative

- Invitation photographs
- Managed visual assets
- Derivatives intended for `invitation-assets` / provision asset dirs

If the conversation mentions photos, record the **claim** (e.g. “sent photos”) as a fact, and
require a separate filesystem/repository **source asset path** for inventory.

## Classification

Use exactly:

`verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` | `requires_owner_decision`

| Rule | Detail |
| ---- | ------ |
| `verified` | Requires explicit supporting text/evidence from the supplied material |
| `inferred` | Record basis; never phrase as “the client said” |
| `ambiguous` | Keep competing readings in notes |
| Absence | Never treat as consent, preference, or demo selection |
| Recommendations | Stay in Agent Recommendations until owner approval |

## Process limits

- Operate on **supplied** conversation material only.
- Do not call WhatsApp APIs.
- Do not ingest chat attachments into managed asset storage.
- Do not re-ask the owner for facts already present in the supplied material or canonical Markdown.
