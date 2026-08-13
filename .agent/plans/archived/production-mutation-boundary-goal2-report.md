---
title: Enforce Production Mutation Boundaries — Goal 2 Report
status: validated
created: 2026-08-12
updated: 2026-08-12
type: validation
autonomy: 2
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
  - .agent/plans/archived/production-migration-path-forensics-goal1-audit.md
related_skills:
  - database-parity
  - production-sql-patches
---

# Goal 2 — Enforce Production Mutation Boundaries

Implementation + verification of the Goal 1 §7 minimum. No Production, Preview, or
persistent-local mutation. The three already-applied versions were not reverted or reapplied.

## Current state

The owner-only Production write invariant is now enforced at three layers:

1. **Canonical workflow** — `requireOwnerProductionApply` remains the positive authorization
   boundary (`--apply`, exact Production identity, TTY, release-check). On success it issues an
   in-process write permit. Production `supabase db push` then runs only through
   `executeSupabasePush`.
2. **In-process spawn guard** — `runCommand` / `executeSupabasePush` refuse Production mutations
   without that permit. `executePsqlAtomicPending` and `apply-migrations` `psql` refuse Production
   entirely (no second schema-apply path).
3. **Agent channels** — Cursor `beforeMCPExecution` / `beforeShellExecution` deny Production MCP
   writes and raw CLI. `sessionStart` + `preToolUse` inject `CELEBRA_AGENT_CONTEXT=1` so the owner
   gate cannot be self-authorized from an agent session.

Durable owner-apply records are written after a successful Production migrate. `pnpm dbs` and
`/dashboard/estado` report `authorizationIntegrity` separately from schema `CURRENT`.

## Completed work

- Shared policy: `scripts/db/production-boundary-policy.ts`
- In-process permit: `scripts/db/production-write-permit.ts`
- Owner-apply ledger: `scripts/db/owner-apply-record.ts` (gitignored `.backups/prod/owner-apply/`)
- Integrity classifier: `scripts/db/production-authorization-integrity.ts`
- Cursor hooks + always-on rule under `.cursor/`
- Status matrix, CLI, dashboard, labels, and schema
- Bypass regression tests

Grandfather: versions `<= 20260806120000` do not require ledger rows (Goal 1 AUTHORIZED).

## Evidence

- `tsc --noEmit -p tsconfig.json` passed
- Jest: production mutation boundary/hooks, production-authorization, canonical status format,
  diagnostics, CanonicalStatusPanel, phase3 contracts, status-presentation, dashboard estado,
  db-guard, migrate-orchestrator, migrate-cli-args, managed-status, observability-access

## Validation passed

Targeted unit/component tests above. No Production `--apply`. No MCP write. No raw Production CLI.

## Validation intentionally not run

- `pnpm db:migrate -- --target production --apply` (would mutate / create backups)
- Live MCP deny against Production (write-capable; covered by pure policy tests + hook wiring tests)
- `pnpm run ci` / full `astro check` (out of proportion; `tsc` covered the TS surface)

## Residual risks

- Supabase Dashboard SQL editor remains outside the repository.
- `sessionStart` `env` injection is best-effort; Shell wrapping and MCP/CLI hooks are the
  enforceable agent controls.
- Cross-machine migrate concurrency is unchanged.
- Historical applies before the ledger remain grandfathered, not backfilled.

## Applicable authorization

No Production/Preview/persistent-local writes. No Git mutation.

## Next responsibility (Goal 3)

Cleanup + final verification only: leftover doc consistency, structure validation of `.cursor/`
hooks, and any fixture/comment drift. Do not add new mutation paths or re-open the three
applied versions.
