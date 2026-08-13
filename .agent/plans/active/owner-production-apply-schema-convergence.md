---
title: Finalize Owner-Only Production Apply and Canonical Schema Convergence
status: blocked
created: 2026-08-12
updated: 2026-08-12
type: implementation
autonomy: 2
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
related_skills:
  - database-parity
  - production-sql-patches
  - supabase
related_plans:
  - .agent/plans/archived/schema-change-lifecycle-convergence-goal1-audit.md
  - .agent/plans/archived/production-owner-apply-convergence-goal2-report.md
  - .agent/plans/archived/production-mutation-boundary-goal2-report.md
---

# Finalize Owner-Only Production Apply and Canonical Schema Convergence

Implements the user Goal using Goal 1 audits as evidence. No Production mutation.

## Known evidence (do not re-audit)

- `pnpm prod:apply` already exists as the thin owner orchestrator.
- Owner TTY + plan-bound in-process permit already exist.
- Agent `--apply` is denied; `CELEBRA_AGENT_CONTEXT=false|0|empty` cannot opt out.
- Live 2026-08-12: Production index `idx_guest_invitations_phone_e164` btree(phone); CHECK `guest_invitations_phone_country_code_pair_check` present. Preview/Local: canonical `idx_guest_invitations_phone`; CHECK absent. History head `20260806120000` on all three.

## Non-goals

- No Production `--apply`.
- No new migration engine, publication classifier, or generic schema comparator.
- No credential-isolation infrastructure beyond reporting the residual (agents can still read Production URLs for audits).

## Implementation units

1. Fail-closed Local-only psql; delete apply-migrations CLI; delete compare-schemas.
2. Expand `db:prod:patch` DDL lint; keep TEMP DML.
3. Bidirectional named-object audit for indexes/constraints/routines; CURRENT cannot hide drift; BEHIND does not block migrate.
4. One reconciliation migration; registry expand; disposable → Local → Preview only.
5. Tests + owner docs; romina one-off kept (not `--all-ready`).
6. Read-only Production plan handoff.

## Stop

Any Production write. Non-idempotent reconciliation SQL. New workflow framework.

## Live evidence (2026-08-12)

- Disposable + Local: applied `20260812210000`; history CURRENT; structural audit clean (matching fingerprints).
- Preview: BEHIND pending `20260812210000`; missing CHECK `guest_invitations_phone_country_code_pair_check`; canonical phone index already present. Apply blocked: dirty worktree (`DIRTY_WORKTREE`) and migration not in HEAD tree.
- Production (read-only): BEHIND pending `20260812210000`; noncanonical index `idx_guest_invitations_phone_e164`; pair CHECK already present; Errors 0 so migrate preflight would be ready after the file is in HEAD. `pnpm prod:apply` planning currently fails compatibility because `20260812210000` is not in HEAD `600508de`.
- Residual (out of this migration): Production `backfill_guest_invitations_from_legacy()` still inserts `phone_e164`; not part of the mutation-contract RPC set, so it does not fail object audit.
- `invitation:romina-draft-reset` kept as explicit one-off (never `--all-ready`).

## Blocker

Hosted Preview apply and Production planning require a clean HEAD that contains the reconciliation migration. Ask the owner to authorize a commit, then continue Preview apply → Preview audit → Production read-only `pnpm prod:apply` plan. Do not Production `--apply`.
