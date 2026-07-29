---
title: Invitation Mutation Phase 3 Final Hardening and Recovery Proof
status: validated
type: implementation
autonomy:
  Level 2 — local code changes and disposable/read-only verification; no staging, commit, deploy, or
  hosted mutation
created: 2026-07-29
updated: 2026-07-29
related_skills:
  - backend-engineering
  - supabase
  - supabase-postgres
  - testing
  - documentation-governance
related_docs:
  - docs/core/architecture.md
  - docs/core/release-process.md
  - docs/database-workflow.md
  - docs/domains/intake/production-flow.md
  - docs/domains/rsvp/database.md
supersedes: []
superseded_by: []
---

# Invitation mutation Phase 3

## Objective

Prove the locked Phase 1/2 mutation architecture as an integrated, recoverable system; close only
after a complete disposable restore drill, RSVP integrity proof, concurrency/failure verification,
canonical E2E/CI hardening, environment and privilege checks, truthful operational documentation,
and an acceptance-criterion audit.

## Scope

- Critical backup-set creation, manifest validation, disposable restore orchestration, RSVP
  integrity verification, timing evidence, and Storage-object recovery.
- Read-only Production/Preview posture checks only when configured credentials resolve safely.
- Migration-before-code deployment sequencing and fail-closed environment checks.
- System-level concurrency and cross-system partial-failure coverage using existing seams.
- Canonical E2E coverage and deterministic Windows Playwright lifecycle.
- Bounded least-privilege, obsolete-code, documentation, and governance alignment.
- Final Tier C validation from the final candidate state.

## Non-goals

- No redesign of Phase 1/2 contracts.
- No Production or Preview mutation, deployment, branch operation, staging, or commit without exact
  current-task authorization.
- No persistent-local reset or destructive operation.
- No unrelated repository-wide refactor or broad fault-injection framework.

## Implementation loops

### 1. Baseline and evidence matrix

- Confirm `develop`, clean baseline, Phase 1/2 commits, and Git-safety snapshot.
- Map every Goal 4 acceptance criterion to authoritative code, command, runtime, or hosted evidence.

Gate: no unexplained Git drift; unsupported claims are classified as unproven.

### 2. Recovery workflow and integrity proof

- Build the smallest supported end-to-end backup/restore drill that reconstructs migrations,
  database data, Auth reconstruction data, Storage metadata, and critical object bytes.
- Reject incomplete/corrupt sets before restore and produce deterministic before/after integrity
  evidence plus RTO timings.
- Exercise only verified disposable targets.

Gate: a clean disposable drill succeeds from a validated synthetic critical set, and corruption
tests fail closed.

### 3. Integrated mutation hardening

- Exercise Editor/managed CLI/publication/asset/identity contention and stale-plan cases.
- Exercise partial-success boundaries and retry/replay without secret leakage or duplicate
  destructive actions.
- Reconfirm environment and RSVP isolation through application tests and disposable DB privileges.

Gate: no representative scenario permits silent overwrite or ambiguous completion.

### 4. E2E, lifecycle, and deployment safety

- Put the smallest material reveal/public/editor/auth coverage on the canonical E2E path.
- Reproduce the Windows cold-start lifecycle problem and implement or document a deterministic
  repository-supported invocation.
- Verify migration-before-code sequencing for Local, Preview, and Production.

Gate: canonical E2E starts from a clean state without relying on a detached server; migration
ordering fails closed.

### 5. Operational posture and closure

- Gather authorized read-only hosted backup/PITR, migration, route, and identity evidence when
  credentials/capabilities exist; report unavailable guarantees as unproven.
- Remove only proven obsolete paths and align active docs with actual guarantees.
- Run focused tests, disposable DB/pgTAP, and the full final `pnpm run ci` pipeline.
- Audit all acceptance criteria and prepare the A–P stabilization report.

Gate: every acceptance criterion has direct evidence. Any material Production recovery guarantee
that remains unproven forces the final verdict `Not ready — blocking issues remain`.

## Validation

- Focused Jest suites for backup/restore, environment, concurrency, failure, privilege, and E2E
  configuration contracts.
- `pnpm db:disposable:test` plus the complete timed restore drill on port 54332.
- `pnpm type-check`, `pnpm validate:structure`, `pnpm lint`, `pnpm lint:styles`,
  `pnpm validate:ui-governance`, `pnpm validate:event-parity`, `pnpm validate:no-pii`, `pnpm test`,
  `pnpm test:e2e:ci`, `pnpm build:app`, and final `pnpm run ci`.
- `git diff --check`, `pnpm agent:git-safety:check`, and persistent-local sentinel preservation.

## Rollback and stop conditions

Edits remain unstaged and can be reviewed by the owner; do not use destructive Git rollback. Stop
and report immediately for unexpected Git/HEAD/index drift, any ambiguous database target, any
hosted write requirement, Production data exposure, persistent-local mutation risk, or a
Critical/High integrity defect that cannot be corrected within this bounded program.

## Final output

Use the Goal 4 A–P stabilization-report contract, including exact readiness verdict, complete
validation evidence, hosted gaps, commits (if separately authorized), repository state, and only
concrete residual risks.
