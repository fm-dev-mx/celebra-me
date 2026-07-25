# Managed Invitation Lifecycle Workflow — Celebra-me

**Owns:** thin agent procedure for managed invitation updates (dry-run → authorize → apply →
verify).

**Does not own:** invitation identity fields, runbook semantics, or safety invariants. Authority
chain: creation contract → production runbook → this workflow → invitation-production rule → live
CLI help. See [`.agent/index.md`](../index.md).

Use this workflow to apply the canonical invitation production runbook to managed, versioned
invitation updates. Operational policy and lifecycle semantics live in
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md). Executable
CLI behavior lives in `scripts/provision/invitation-update-cli.ts` and its imported services.

## Procedure

1. Read the canonical production runbook and `.agent/rules/invitation-production.md`.
2. Inspect the current CLI contract with the help command before composing an invocation.
3. Start with a dry run. Verify invitation identity, target identities, owner resolution, source or
   package integrity, asset policy, and every target result.
4. Treat an unavailable or failed inspection as blocked or unevaluated, never as no change.
5. Do not apply until all required preflights pass and the user has authorized the exact mutation
   scope. Preview and Production actions require explicit authorization.
6. Execute only the retained, confirmed plan; any source, package, project, invitation, or asset
   drift requires a new dry run.
7. Verify database, Storage, and published state, then report one explicit result per selected
   target. Claim rollback only when all completed mutations were restored and verified.

## Commands

```bash
pnpm invitation:update -- --help
pnpm invitation:update -- --slug <slug> --targets local --source-dir <path> --dry-run
pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --apply
pnpm invitation:update -- --slug <slug> --targets production --package <path> --dry-run
```

Flags and target expansion can change with the executable contract. The CLI help and canonical
runbook are authoritative; do not preserve copied flag semantics in this workflow.

- Newly created resources may be removed during compensation. Pre-existing resources must never be
  deleted by cleanup. If an overwritten pre-existing resource cannot be restored automatically, the
  result requires manual review.
- Agents must not mutate Preview or Production, stage files, or create commits without explicit
  authorization for that exact action.
