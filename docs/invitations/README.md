# Invitation documentation

Per-client invitation evidence and **canonical preparation state** live here:

```text
docs/invitations/<slug>.md
```

Slug must **not** repeat `eventType` (public URL is already `/{eventType}/{slug}`). Canonical rule:
[`docs/core/invitation-creation-contract.md`](../core/invitation-creation-contract.md).

Supported Production clients that must remain Local-renderable for regression are listed in the
[Local Render Corpus](../core/local-render-corpus.md)
(`scripts/provision/local-render-corpus/registry.ts`), which is distinct from the canonical managed
registry and from demos.

## Authority

| Concern                                        | Owner                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| Preparation schema & semantics                 | `docs/core/invitation-preparation-contract.md`      |
| Markdown template                              | `.agent/templates/invitation/preparation-state.md`  |
| Preparation orchestration                      | `.agent/workflows/invitation-preparation.md`        |
| Analysis skill                                 | `.agent/skills/client-invitation-audit`             |
| Executable evaluation (**prepReadiness SSOT**) | `src/lib/invitation-preparation/`                   |
| Human creative acceptance outcome              | `docs/invitations/<slug>.md` Creative Direction & Acceptance section |
| Cross-cutting architecture / runbooks          | `docs/core/`, `docs/domains/` — **not** these files |

Invitation-specific notes may guide their named invitation but must not redefine system contracts.
**prepReadiness** in each file must match `evaluatePreparationReadiness` — never hand-promote to
`READY_FOR_IMPLEMENTATION` while assets remain provisional.

Creative acceptance is a separate post-implementation human decision. Record the responsive whole-
invitation review and outcome in the same canonical file; do not treat screenshot mechanics or
`prepReadiness` as aesthetic acceptance. Detailed evidence may use the existing
`.agent/templates/creative/creative-qa-report.md` template.

## Info-hygiene

Persist opaque source labels and classified event facts only. Do **not** commit absolute
machine/`Clientes` paths, WhatsApp chat-folder titles, raw chat exports, photo dumps, or
credential-bearing / payroll / portal URLs. See preparation-contract §4.1.

Automated gate: `pnpm validate:invitation-preparation` (Markdown prepReadiness ↔ helpers + hygiene).

Historical companion files (asset reports, copy audits, finalization notes) may exist beside the
canonical `<slug>.md`. Prefer consolidating durable preparation decisions into `<slug>.md`.
