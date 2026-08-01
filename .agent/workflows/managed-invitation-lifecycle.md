# Managed Invitation Lifecycle Workflow — Celebra-me

**Owns:** thin agent procedure for managed invitation updates (dry-run → authorize → apply →
verify).

**Does not own:** invitation identity fields, runbook semantics, or safety invariants. Authority
chain: creation contract → production runbook → this workflow → invitation-production rule → live
CLI help. See [`.agent/index.md`](../index.md).

Use this workflow to apply the canonical invitation production runbook to managed, versioned
invitation updates. Operational policy and lifecycle semantics live in
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md). Content
promote vs Preview mirror vs RSVP isolation:
[`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md).
Executable CLI behavior lives in `scripts/provision/invitation-update-cli.ts`,
`invitation-reconcile-cli.ts`, and `invitation-promote-cli.ts` plus imported services. Capability
boundaries (Agent vs Owner, managed vs raw, Preview task scope, schema separation) are SSOT in
[`.agent/rules/invitation-production.md`](../rules/invitation-production.md); do not restate the
matrix here. Managed Local/Preview updates use `invitation:update`; reconciliation uses
`invitation:reconcile`; Production promotion uses owner-only `pnpm invitation:promote`.
`pnpm db:preview:sync-invitations` is a separate regression mirror.

**Preparation prerequisite:** New client invitations should complete
[`.agent/workflows/invitation-preparation.md`](./invitation-preparation.md) until preparation
readiness is `READY_WITH_PLACEHOLDERS` or `READY_FOR_IMPLEMENTATION`. Durable preparation state
lives at `docs/invitations/<slug>.md`. This lifecycle workflow does not own preparation semantics.

## Procedure

1. Read the canonical production runbook and `.agent/rules/invitation-production.md`.
2. Inspect the current CLI contract with the help command before composing an invocation.
3. Start with a dry run. Verify invitation identity, target identities, owner resolution, source or
   package integrity, asset policy, and every target result.
4. Treat an unavailable or failed inspection as blocked or unevaluated, never as no change.
5. Do not apply until all required preflights pass and the user has authorized the exact mutation
   scope. Preview requires explicit task scope / interactive confirmation. Production mutation uses
   owner-only `pnpm invitation:promote`, not `invitation:update`.
6. Execute only the retained, confirmed plan; any source, package, project, invitation, or asset
   drift requires a new dry run.
7. Verify database, Storage, and published state, then report one explicit result per selected
   target. Claim rollback only when all completed mutations were restored and verified.

The definition's `lifecycle` and `deliveryScope` are part of managed intent. Keep `lifecycle` as
`in_progress` while absence or partial promotion is intentional, and change it to `published` when
Production alignment becomes the expected steady state. Do not infer authority from timestamps. The
reconciliation common ancestor is the version-compatible `managed_projection` proven by the matching
completed managed-apply receipt; missing or incompatible baseline evidence requires operator
reconciliation, not a two-way overwrite.

## Commands

Illustrative only. Flags and target expansion follow the live CLI and runbook — never copy flag
semantics from this workflow into other docs.

```bash
pnpm invitation:update -- --help
pnpm invitation:update -- --slug <slug> --targets local --source-dir <path> --dry-run
pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --apply
pnpm invitation:promote -- --slug <slug> --package <path> --dry-run
pnpm invitation:promote -- --slug <slug> --package <path> --apply --backup-manifest <path>
```

Interactive apply (TTY) offers selective content apply: all changes, by section, or field-by-field.
Deselected paths keep the destination value. Non-interactive selective apply uses
`--field-selections <file.json>` with `{ "resolutions": { "<path>": "package"|"target" } }` (merged
with `--conflict-resolutions`; conflict choices win on overlap). Use `--verbose` for full field
values and plan IDs.

Host login alias remaps on Local are **not** part of `invitation:update`. Use:

```bash
pnpm tsx scripts/provision/rekey-local-host-login.ts --slug <slug>          # dry-run
pnpm tsx scripts/provision/rekey-local-host-login.ts --slug <slug> --apply
```

Password resets go through the dashboard admin reset-password flow, not this CLI.

Inspect `pnpm invitation:update -- --help` and
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md) before
composing a real invocation.

- Newly created resources may be removed during compensation. Pre-existing resources must never be
  deleted by cleanup. If an overwritten pre-existing resource cannot be restored automatically, the
  result requires manual review.
- Agents must not mutate Preview or Production, stage files, or create commits without explicit
  authorization for that exact action.
