---
title: Invitation Mutation Architecture Phase 1
status: completed
type: implementation
autonomy: Level 2 — Local code changes allowed, no staging/commit/deploy
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
  - docs/core/invitation-creation-contract.md
  - docs/domains/intake/production-flow.md
  - docs/domains/intake/internal-invitation-editor.md
  - docs/domains/rsvp/database.md
  - docs/database-workflow.md
supersedes: []
superseded_by: []
---

# Invitation Mutation Architecture Phase 1

## Objective

Implement the mutation-authority foundation established by Goal 1: canonical application commands
and infrastructure adapters, executable field ownership, conditional interactive writes, coherent
environment identity, durable operation receipts, RSVP isolation, and backup/restore authority.

## Scope and non-goals

Autonomous changes are limited to repository code, tests, migrations, operational tooling, and the
active documentation required by the Goal 2 contract. No Preview or Production mutation, deploy, Git
staging, commit, or branch operation is authorized.

The following Goal 3 defects remain deferred unless a minimal boundary change is unavoidable:
structural deletion, asset-prune execution, stale-baseline correction, Auth password/alias partial
success internals, final alias-format unification, publication/provenance partial-state repair,
asset-upload orphan recovery, metadata-reopen/restore atomicity, CI command cleanup, and remaining
mechanism-specific regression gaps.

## Implementation loops

### Loop 1 — Contracts and persistence foundation

- Add executable field-ownership, environment-identity, operation-identity, mutation-outcome, and
  adapter contracts under the invitation/intake domain.
- Add an append-only operation-receipt migration and repository with sensitive-field exclusion.
- Preserve publication idempotency and latest managed provenance as specialized state.

Gate: focused contract and migration tests pass; no external database is contacted.

### Loop 2 — Supported writer consolidation

- Route Editor and compatibility draft/metadata endpoints through conditional application commands.
- Prove consumers before retiring any endpoint.
- Move route-level lifecycle mutations behind the owning service.
- Bound demo publication and recovery-only writers without deleting historical tooling.

Gate: stale draft/metadata and compatibility-collision tests pass; repository searches show no
supported unconditional interactive writer.

### Loop 3 — Managed adapter convergence and environment authority

- Establish one logical managed plan/apply lifecycle with explicit Local and hosted adapters.
- Reuse ownership, environment identity, operation outcome, publication, asset-state, and provenance
  contracts without merging Editor and CLI conflict algorithms.
- Reject incoherent DB/API/credential/Storage/project identities and reject arbitrary cloud targets
  as Production.

Gate: Local/Preview/Production positive cases and mismatch/cross-environment negative cases pass;
logical outcomes are equivalent across adapters.

### Loop 4 — RSVP and lifecycle isolation

- Restrict invitation-management persistence to invitation/event-linkage capabilities.
- Add guest-bearing destructive preflight covering memberships, claim codes, confirmations, and
  audit-relevant state.
- Persist lifecycle operation evidence.

Gate: invitation adapters cannot mutate guest confirmations and destructive tests reject protected
events in the disposable test environment or focused repository/RPC tests.

### Loop 5 — Backup and disposable recovery foundation

- Define operator, RPO/RTO, retention, access/encryption requirements, complete critical backup
  scope, and verified/unknown platform posture.
- Implement manifests, checksums, empty/truncation rejection, actual object inventory support, and a
  deterministic disposable-only restore verifier.
- Do not claim recoverability until a later timed drill succeeds.

Gate: artifact tests cover valid, missing, empty/truncated, and checksum-mismatch cases; Production
is rejected as a restore target.

### Loop 6 — Documentation and full validation

- Align the existing architecture, invitation production, Editor, environment, RSVP, and database
  authorities with implemented behavior. Do not introduce a duplicate source of truth.
- Preserve the Goal 3 defect inventory in the canonical production documentation.
- Run Gatekeeper Tier C because this is production-sensitive cross-cutting backend work.

Gate: type-check, structure, lint/style, UI governance, event parity, no-PII, full Jest, scoped E2E,
build, database safety/parity checks, and Git safety pass. Visual evidence is unnecessary for this
backend/operations phase.

## Allowed file boundaries

- `src/lib/intake/**`, relevant `src/lib/rsvp/**`, and their API routes
- `scripts/provision/**`, `scripts/db/**`, and narrowly related command wiring
- `supabase/migrations/**` and disposable database tests
- focused tests under `tests/**`
- the existing authoritative documents named in frontmatter and `.agent/index.md` only when
  ownership/discovery changes
- this plan while active

## Stop conditions and rollback

Stop and report if implementation would require Preview/Production mutation, Production credential
disclosure, destructive persistent-local operations, loss of a supported consumer, or a design that
requires one of the explicitly prohibited architecture patterns. Unexpected user-owned changes or
Git HEAD/index drift also stop the work.

All changes remain unstaged. If a loop fails irrecoverably, stop before later loops and report the
exact task-owned files; rollback is performed only with targeted patches or explicit user-directed
Git action, never with reset/clean/checkout.

## Completion evidence

Phase 1 is complete only when every Goal 2 acceptance criterion maps to live code, a focused test or
validation result, and the authoritative documentation. The final report follows sections A–M from
Goal 2 and hands the unchanged mechanism-defect backlog to Goal 3.
