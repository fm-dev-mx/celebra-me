---
title: Managed Observability & Preview Fixture Bootstrap
status: completed
created: 2026-07-31
updated: 2026-07-31
related_docs:
  - .agent/plans/archived/goal2-canonical-creation-closure.md
  - docs/domains/intake/production-flow.md
  - docs/database-workflow.md
  - docs/core/content-parity-rsvp-isolation.md
  - docs/core/invitation-creation-contract.md
  - docs/env-workflow.md
supersedes: []
---

# Managed Observability & Preview Fixture Bootstrap — Closure

Authority: `.agent/plans/archived/goal2-canonical-creation-closure.md` §9.

Baseline: `c99b7cfb`.

## Delivered

1. **Compact status** — `pnpm dbs --compact` / `managed-status.ts` composes `dbs-status` +
   `classifySchemaLifecycle`. Default CONTENT is connectivity-derived (fast); slug path uses
   package-hash vocabulary; `--aggregate-content` for worst-of definitions.
2. **Git hooks** — non-blocking `post-commit` / `post-merge` / `post-rewrite` with
   `CELEBRA_SKIP_MANAGED_STATUS=1` opt-out and strict spawnSync timeouts. Not in husky gates.
3. **Preview fixture** — `pnpm invitation:preview-fixture` (Preview-only; Production rejected).
4. **Cleanup** — stale Dashboard-create docs corrected; CreateInvitationFlow already absent;
   `assign-owner` retained (Editor consumer).
5. **Tests** — `managed-status.test.ts`, `preview-e2e-fixture.test.ts`; create/duplicate 403 green.
6. **Validation** — type-check, validate:changed/structure, git-safety, unit tests, e2e:ci (after
   Playwright browser install), build:app all green. Full `pnpm run ci` equivalent after
   environmental Playwright fix.

## External limitations

- Authenticated Preview E2E against live Preview was not executed in this session (requires
  Preview credentials + task scope + Deployment Protection). Fixture CLI contract is unit-tested.
- Vercel production deploy verification not run (owner-gated).
