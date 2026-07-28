# Invitation documentation

Per-client invitation evidence and **canonical preparation state** live here:

```text
docs/invitations/<slug>.md
```

## Authority

| Concern | Owner |
| ------- | ----- |
| Preparation schema & semantics | `docs/core/invitation-preparation-contract.md` |
| Markdown template | `.agent/templates/invitation/preparation-state.md` |
| Preparation orchestration | `.agent/workflows/invitation-preparation.md` |
| Analysis skill | `.agent/skills/client-invitation-audit` |
| Executable evaluation | `src/lib/invitation-preparation/` |
| Cross-cutting architecture / runbooks | `docs/core/`, `docs/domains/` — **not** these files |

Invitation-specific notes may guide their named invitation but must not redefine system contracts.

Historical companion files (asset reports, copy audits, finalization notes) may exist beside the
canonical `<slug>.md`. Prefer consolidating durable preparation decisions into `<slug>.md`.
