# Managed Invitation Lifecycle Workflow — Celebra-me

This is the authoritative workflow for planning and executing managed invitation updates across
Local, Preview, and Production. Executable behavior remains owned by
`scripts/provision/invitation-update-cli.ts` and its imported services.

## Canonical lifecycle

1. Validate the repository state, source or immutable package, invitation identity, target
   selection, credentials, and target project identities.
2. Resolve the existing owner independently in every target. `--owner-user-id` is required only when
   the invitation does not yet exist in that hosted target.
3. Inspect **every** selected target before mutation. An unavailable or failed inspection is
   `NO EVALUADO` or `BLOQUEADO`, never `SIN CAMBIOS`.
4. Build and retain one immutable plan per target. Each plan carries its own project identity,
   source/package hashes, functional changes, technical operations, preconditions, and plan ID.
5. Present all target plans. If any mandatory preflight is incomplete or blocked, abort the whole
   mutation phase before confirmation; an earlier Local target must not mutate.
6. After confirmation, execute only plans with pending changes in deterministic order: Local →
   Preview → Production. Stop later mutations after the first execution failure.
7. Immediately before each mutation, validate the retained plan against current source/package,
   project, invitation/draft/publication, and asset state. Drift requires a new plan.
8. Attach the same plan ID to confirmation, execution, receipt, and final target result. Never
   replace a confirmed plan with a hidden rescan.
9. Verify database, Storage, and published state. Every selected target receives an explicit final
   result in both human and JSON output.
10. Classify recovery truthfully. `ERROR — CAMBIOS REVERTIDOS` is valid only when every completed
    mutation was restored and verified; unsupported restoration, pre-existing overwrites, or failed
    compensation require `ERROR — REQUIERE REVISIÓN`.

## Commands

```bash
pnpm invitation:update -- --help
pnpm invitation:update -- --slug <slug> --targets local --source-dir <path> --dry-run
pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --apply
pnpm invitation:update -- --slug <slug> --targets production --package <path> --dry-run
```

`--source-dir` and `--package` are mutually exclusive. There is no `--resume` flag: Production
continues by selecting the exact immutable package with `--package`. The `all` target alias means
Local plus Preview; Production must be selected explicitly and requires a valid, fresh Preview
approval bound to the executed Preview plan, reviewer, timestamp, Preview project, and intended
Production project. Production mutation also requires explicit operator authorization.

## Approval and recovery boundaries

- A pending Preview artifact is not approval. Hosted verification and a human reviewer must finalize
  it before Production preflight can pass.
- Preview and Production always have distinct target plan IDs.
- Newly created resources may be removed during compensation. Pre-existing resources must never be
  deleted by cleanup. If an overwritten pre-existing resource cannot be restored automatically, the
  result requires manual review.
- Agents must not mutate Preview or Production, stage files, or create commits without explicit
  authorization for that exact action.
