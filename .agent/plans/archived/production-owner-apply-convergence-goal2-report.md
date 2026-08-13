---
title: Owner-Only Production Apply Orchestration — Goal 2
status: implemented
created: 2026-08-12
updated: 2026-08-12
type: implementation
autonomy: 0
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
  - .agent/rules/invitation-production.md
related_plans:
  - .agent/plans/archived/production-owner-apply-convergence-goal1-audit.md
---

# Goal 2 — Owner-only Production apply orchestration

Implemented. No Production mutation was performed.

## Owner command

```bash
pnpm prod:apply                         # read-only plan (no writes)
pnpm prod:apply -- --schema --apply
pnpm prod:apply -- --slug <slug> --apply
pnpm prod:apply -- --slugs a,b --apply
pnpm prod:apply -- --all-ready --apply
pnpm prod:apply -- --patch <file.sql> --owner-user-id <uuid> --apply
```

No arguments never apply. `--apply` without an explicit scope is rejected (`SCOPE_REQUIRED`).

## What was implemented

1. Agent Shell denies canonical Production `--apply` (`AGENT_PRODUCTION_APPLY_BLOCKED`).
2. Agent context is forced to `CELEBRA_AGENT_CONTEXT=1`; `false`/`0`/empty cannot opt out.
3. Thin orchestrator composes `preflightMigrate` / `orchestrateMigrate`, `runPromotionPreflight` /
   `orchestrateInvitationPromotion`, and explicit `prepareProductionPatchFile`.
4. One owner TTY confirmation (`APPLY <8-hex>`) issues a plan-scoped in-process permit. Domain
   primitives skip a second prompt by asserting that permit.
5. Mixed order: schema → verify → invitations (explicit order) → optional `--patch`. Stop on first
   failure. Retry rebuilds from live preflight (no resume file).

## Residual

- Production write credentials remain readable in agent sessions on the owner machine (TTY + agent
  `--apply` deny + `CELEBRA_AGENT_CONTEXT` are the write invariant).
- `invitation:romina-draft-reset` was not deleted; still a temporary one-off pending owner
  confirmation that it is complete.
- Draft canonicalize/restore remain independent owner tools (not in `--all-ready`).
- Domain CLIs (`db:migrate -- --target production`, `invitation:release --targets production`) remain
  as primitives; owner-facing story is `pnpm prod:apply`.

## First owner apply

1. Review `pnpm prod:apply` (read-only).
2. If the plan is correct: `pnpm prod:apply -- --all-ready --apply` (or a narrower explicit scope)
   from an interactive owner terminal **without** `CELEBRA_AGENT_CONTEXT`.
3. Type `APPLY <8-hex>` after leaving Cancel as the default unless the plan is intended.
