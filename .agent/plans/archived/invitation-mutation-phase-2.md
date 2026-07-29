---
title: Invitation Mutation Phase 2 Remediation
status: validated
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
  - docs/domains/intake/production-flow.md
  - docs/domains/rsvp/database.md
supersedes: []
superseded_by: []
---

# Invitation Mutation Phase 2 Remediation

## Scope and locked contracts

Implement Goal 3 against the committed Phase 1 baseline. Preserve Phase 1 ownership, writer
boundaries, environment identity, operation receipts, RSVP isolation, and source-of-truth decisions.
Only Local or disposable resources may be mutated. Preview and Production are out of scope.

## Non-goals

- Goal 4 final hardening, hosted PITR proof, production RPO/RTO, and final readiness verdict.
- Broad architecture redesign, unrelated cleanup, or changing Editor optimistic concurrency to a
  three-way merge.
- Staging, committing, branch changes, deployment, or hosted database mutation.

## Implementation loops

1. **Managed document semantics** — implement explicit structural operations, complete three-way
   merge semantics, schema validation, verified-baseline fail-closed behavior, and race coverage.
2. **Asset integrity** — implement reviewed-plan-bound pruning plus upload orphan recovery with
   hashes, completed steps, retry/replay semantics, and asymmetry failure injection.
3. **Identity mutations** — centralize alias normalization/validation and make password/alias Auth
   partial successes observable and deterministically recoverable without persisting secrets.
4. **Publication and Editor atomicity** — make post-publication provenance reconciliation durable,
   and fix metadata reopen plus restore-from-published using narrow atomic/resumable boundaries.
5. **Receipts, isolation, governance, docs** — finish receipt integration, prove RSVP/environment
   invariants, correct active `pnpm run ci` references and SQL validation contracts, remove only
   demonstrably superseded code, and update affected canonical docs.
6. **Completion audit** — map every Goal 3 acceptance criterion and named test case to current-state
   evidence, then run focused tests, disposable DB verification, Tier C / `pnpm run ci`, E2E where
   applicable, build, `git diff --check`, and Git safety.

## Gates

- **Repo gate:** HEAD and index stay equal to the Git-safety baseline; no unexpected worktree drift.
- **Evidence gate:** each loop starts from live source/tests and ends with direct focused coverage.
- **Implementation gate:** no mutation path bypasses Phase 1 command context, ownership, environment,
  or outcome contracts; final documents pass their applicable schema.
- **Database gate:** new functions use least privilege and are tested only against disposable/local
  databases; migrations pass static and disposable verification.
- **Validation gate:** the Goal 3 minimum verification list passes, including `pnpm run ci` when the
  canonical pipeline is required.

## Allowed file boundaries

Bounded changes may touch the managed provisioning engine, intake services/repositories/API routes,
RSVP user administration, shared validation schemas, targeted migrations/verification scripts,
focused tests, active governance validation, and affected canonical docs. Expand only when a direct
consumer or invariant requires it and record that expansion here.

## Stop conditions

- A locked Phase 1 invariant proves internally contradictory.
- Preview/Production access would be required to proceed.
- HEAD/index drift or unrelated user-owned worktree changes appear.
- A correction requires a broad unrelated redesign rather than a bounded mechanism fix.

## Rollback

Do not use Git write operations. If a task-authored edit must be reversed, use a targeted patch that
preserves all pre-existing state.

## Final output

Return the Goal 3 A–M implementation report, including defect dispositions, direct validation
evidence, remaining Goal 4 work, full `git status --short`, and an explicit staged/committed verdict.

## Validation evidence

- Focused mechanism suites: passed.
- Disposable database: 67/67 migrations and 37/37 pgTAP assertions passed.
- Canonical `pnpm run ci`: passed, including 4,299 Jest tests, 36 Playwright tests, Astro/Vercel
  build, and Git safety.
- Preview and Production were not mutated.
