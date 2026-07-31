---
title: Final Managed Lifecycle Closure — CI Isolation, Render Parity, Local Regression
status: final
created: 2026-07-31
updated: 2026-07-31
base_head: e65f3e38f0cd2f384b391580538cdb4173b1d1ab
worktree: uncommitted (ready to commit)
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/core/git-governance.md
  - docs/core/content-parity-rsvp-isolation.md
  - docs/domains/database/overview.md
supersedes: []
---

# Final Managed Lifecycle Closure Report

**Date:** 2026-07-31  
**Lane:** `dev-local`  
**Base HEAD:** `e65f3e38` (`develop`)  
**Working tree:** tooling/code complete, **uncommitted** (awaiting owner commit authorization)  
**Invariant:** render-effective managed state — not byte-for-byte DB equality

---

## 1. Root cause and correction of GitHub CI

### Root cause

GitHub `Repository CI / Application Suite` failed on `e65f3e38` because DB-backed Jest suites ran inside hermetic `pnpm test`:

| Suite | Failure |
| ----- | ------- |
| `tests/provision/goal2-rekey-disposable-integration.test.ts` | `127.0.0.1:54332` connection refused (disposable not provisioned) |
| `tests/provision/goal2-identity-status.test.ts` | `Local Supabase is required` + fixed Alba UUID on persistent Local |

### Correction

- Exclude disposable rekey suite from `jest.config.cjs`.
- Add `jest.managed-db-contracts.config.cjs` + `pnpm test:db:managed-contracts` (reuses `disposable-test-env.ts`: start → reset → migrate/seed → Jest → blocking failure).
- Split identity suite: hermetic option/guards only under `pnpm test`; DB/SQL rekey paths under disposable tier.
- Extract pure guards to `scripts/provision/managed-identity-guards.ts` (wired into `apply-local-invitation.ts`).
- GitHub Actions Application Suite adds blocking step: `pnpm test:db:managed-contracts`.

Missing disposable DB → **controlled setup failure** from the harness, not a misleading product assertion.

---

## 2. Final hermetic vs DB-integration architecture

```text
Hermetic (`pnpm test` / Application Suite `pnpm run ci`)
→ no persistent Local / disposable dependency
→ includes goal2-identity-status (guards), lane-sync, CI tier classification,
  managed render regression, managed-status formatters, Preview fixture mocks

Disposable integration (`pnpm test:db:managed-contracts`)
→ Docker disposable :54332
→ goal2-rekey-disposable-integration (A–E: success, idempotency, collision,
  partial retry, IDENTITY_NOT_FOUND)
→ CELEBRA_MANAGED_DB_CONTRACTS=1 required; never silently skipped

Disposable RSVP (unchanged)
→ `pnpm test:db:rsvp-contracts`

Hosted Preview / Production
→ explicit invitation:* / Playwright Preview tiers only; owner-gated
```

Classification protected by `tests/unit/ci-test-tier-classification.test.ts`.

---

## 3. Lane / rebase observability

| Path | Behavior |
| ---- | -------- |
| Husky `post-commit` / `post-merge` / `post-rewrite` | Unchanged fail-open `dbs --compact`; may miss no-op rewrites |
| **`pnpm lane:sync`** (new) | fetch → rebase (or `--ff-only`) onto `origin/develop` → always `dbs --compact` |
| Already-aligned | Status still shown |
| Remote DB unavailable | Git sync succeeds; status degrades read-only |
| Opt-out | `CELEBRA_SKIP_MANAGED_STATUS=1` or `--skip-status` |

Documented in `docs/core/invitation-creation-contract.md` and `docs/core/git-governance.md`.  
Tests: `tests/unit/lane-sync.test.ts`.

---

## 4. Complete managed invitation inventory

Active registry definitions (`scripts/provision/invitations/registry.ts`):

1. `alba-rosa-quinonez` (cumple)
2. `abril-michelle-becerra-rea` (xv)
3. `romina-rios-chaparro` (xv)

Synthetic Preview E2E fixture `e2e-preview-publication` is **not** a managed definition.

---

## 5. Cross-environment parity findings

**Render-effective invariant:** Local ≈ Preview ≈ Production for managed public release fields (identity, theme, published content, sections, presentation, assets, provenance hashes). Legitimate divergence: unpublished drafts, audit, receipts, RSVP, auth, analytics.

### SCHEMA (all environments)

| Environment | Schema |
| ----------- | ------ |
| Local | CURRENT |
| Preview | CURRENT |
| Production | CURRENT |

No migrations required.

### CONTENT (package-hash classifiers, 2026-07-31)

| Invitation | Local | Preview | Production |
| ---------- | ----- | ------- | ---------- |
| alba-rosa-quinonez | MATCH_CANONICAL | MATCH_CANONICAL | MATCH_CANONICAL |
| abril-michelle-becerra-rea | NOT_PRESENT | BEHIND_CANONICAL | BEHIND_CANONICAL |
| romina-rios-chaparro | NOT_PRESENT | UNVERIFIED* | UNVERIFIED* |

\*Invitation **present** remotely with provenance, but canonical package hash cannot be built without Local assets / `--source-dir`. Detail now states this is **not a proven MATCH** (`dbs-status.ts`). Do not treat as false MATCH.

Connectivity-only `pnpm dbs --compact` (no slug) correctly reports CONTENT `UNVERIFIED` — not conflated with MATCH.  
Aggregate: `pnpm dbs --compact --aggregate-content` adds CORPUS summary (`ALL_ALIGNED` / `DRAFT_DIVERGENCE_ONLY` / `BEHIND_OR_CONFLICTED` / `UNVERIFIABLE`).

`invitation:content-parity` for Abril also reported Preview↔Production published + draft semantic drift (read-only).

---

## 6. Reconciliation actions proposed / performed

### Performed (code/tooling only)

- CI isolation, lane-sync, regression sweep, fixture contract, observability improvements.
- **No** Preview/Production mutations.
- **No** full-DB cloning.
- Local `invitation:update` dry-runs for Abril/Romina: **blocked** (missing preserve binary / unable to build package without asset root).

### Proposed (owner-gated — not executed)

| Invitation | Canonical | Local | Preview | Production | Action |
| ---------- | --------- | ----- | ------- | ---------- | ------ |
| alba-rosa-quinonez | OK | MATCH | MATCH | MATCH | **none** |
| abril-michelle-becerra-rea | OK | NOT_PRESENT | BEHIND | BEHIND | Provide asset root → `invitation:update --targets local` → `invitation:update --targets preview` → validate → `invitation:promote` |
| romina-rios-chaparro | needs Local/`--source-dir` | NOT_PRESENT | UNVERIFIED | UNVERIFIED | Same sequence after assets available; re-classify before promote |

Never use `invitation:update` for Production. Prefer `invitation:reconcile` only when intentional Editor divergence must be retained deliberately.

---

## 7. Local managed regression mechanism

| Surface | Command |
| ------- | ------- |
| Deterministic render-contract sweep (all registry slugs) | `pnpm test:managed:regression` |
| Optional screenshot completeness sweep (no pixel baselines) | `pnpm screenshot:managed:regression` |

Exercises schema → DB adapter → page context → section descriptors for Alba, Abril, Romina with synthetic assets. Catches render-contract / section / theme / presentation mapping failures.

**Limitation:** no trustworthy deterministic pixel baselines in-repo; screenshot sweep validates capture/section completeness and runtime errors only — **not** pixel-diff.

---

## 8. Changed-path routing behavior

`scripts/validation-runner.mjs` → `requiresManagedInvitationRegression(files)`:

Triggers `pnpm test:managed:regression` when changes touch:

- `src/components/invitation/`
- `src/lib/adapters|invitation/`
- intake section content mappers / schemas
- invitation SCSS / theme section styles
- `scripts/provision/invitations/`
- the regression test itself

Docs/backend-only paths skip the expensive sweep. Covered by `tests/unit/validation-runner.test.ts`.

---

## 9. Preview fixture final contract

| Item | Value |
| ---- | ----- |
| Postcondition constant | `published_with_draft_divergence` |
| Bootstrap | Ensures demo-derived **published** content + divergent draft (`_e2eFixtureDraftMarker`) |
| Authenticated E2E | Expects `hasUnpublishedChanges === true` and UI **「Hay cambios sin publicar」** |
| Provision E2E | Asserts published + `changedPaths.length > 0` without a third `readEditorContext` (rate-limit contract) |
| Hosted execution | Owner-gated (Preview credentials / task scope) |

Contradiction resolved at fixture/test-contract level — assertion not weakened toward “clean published”.

---

## 10. Full local CI results

| Gate | Result |
| ---- | ------ |
| `pnpm type-check` | PASSED |
| `pnpm validate:structure` | PASSED |
| `pnpm validate:event-parity` | PASSED |
| `pnpm validate:no-pii` | PASSED |
| `pnpm validate:ui-governance` | PASSED |
| `pnpm lint:styles` | PASSED |
| `pnpm lint` (lane-sync complexity) | FAILED once → **fixed** → eslint clean on `lane-sync.ts` |
| Hermetic `pnpm test` | **379 passed**, 1 skipped |
| `pnpm test:db:managed-contracts` | PASSED (blocking disposable) |
| `pnpm test:managed:regression` | PASSED (5) |
| Focused provision/lane/CI suites | PASSED (38+) |
| `pnpm test:e2e:ci` | **39 passed** |
| `pnpm agent:git-safety:check` | PASSED |
| `git diff --check` | Clean (CRLF warnings only) |
| Full `pnpm run ci` end-to-end after lint fix | **Not re-run as single command** after final lane-sync lint fix; constituent gates above green |
| `pnpm build:app` | Not re-run in final pass |

---

## 11. GitHub Actions results

| Run | HEAD | Conclusion |
| --- | ---- | ---------- |
| Application Suite on develop `e65f3e38` | pre-fix | **failure** (persistent/disposable DB missing under `pnpm test`) |
| This worktree fix | uncommitted | **Not yet on GitHub** — requires commit + push |

Expected after merge: Application Suite hermetic green; Managed disposable DB contracts step blocking and green on clean runner with Docker.

---

## 12. Remaining owner-gated actions

1. **Commit + push** this worktree to `develop` (or PR path) so clean-runner CI validates the new tiers.
2. **Asset roots / `--source-dir`** for Abril and Romina Local apply.
3. **Authorized** `invitation:update` Local → Preview for Abril (and Romina after Local hash classifies).
4. **Authorized** `invitation:promote` to Production after Preview validation.
5. Optional: re-bootstrap Preview E2E fixture on hosted Preview (`pnpm invitation:preview-fixture`) so live postcondition matches contract.
6. Optional: `pnpm build:app` + single `pnpm run ci` on final commit SHA before release confidence.

---

## 13. Final readiness verdict

| Question | Verdict |
| -------- | ------- |
| Is the CI contract defect fixed in code? | **Yes** (uncommitted) |
| Are hermetic tests free of persistent Local DB? | **Yes** |
| Do DB tests remain blocking via disposable tier? | **Yes** |
| Is lane-sync observability deterministic? | **Yes** |
| Are schemas CURRENT everywhere? | **Yes** |
| Is every managed invitation classified? | **Yes** |
| Is Alba render-equivalent across envs? | **Yes** |
| Are Abril/Romina fully render-equivalent? | **No** — owner-gated update/promote + assets |
| Was Preview/Production auto-mutated? | **No** |
| Can current branch code sweep the managed corpus locally? | **Yes** (`test:managed:regression`) |
| Is `develop` tip alone a stable baseline for the *next* invitation? | **Not yet** — land CI fix first; then converge Abril/Romina or explicitly accept them as behind/unverified until assets exist |

### Verdict summary

**Tooling/stabilization goal: implemented and locally validated; blocked on commit/push for GitHub green and on owner-gated asset + update/promote for full corpus render-parity.**

Safe to start the next invitation **after**:

1. this CI isolation lands on `develop` with green Application Suite + managed disposable step, and  
2. either Abril/Romina are reconciled to MATCH (or explicitly deferred with owner acknowledgment).

Alba alone is already a stable render-equivalent reference across Local / Preview / Production.

---

## Key files changed (this closure)

| Area | Paths |
| ---- | ----- |
| CI | `.github/workflows/commit-validation.yml`, `jest.config.cjs`, `jest.managed-db-contracts.config.cjs`, `package.json`, `scripts/db/disposable-test-env.ts` |
| Identity | `scripts/provision/managed-identity-guards.ts`, `apply-local-invitation.ts`, `goal2-identity-status.test.ts`, `goal2-rekey-disposable-integration.test.ts` |
| Lane sync | `scripts/agent/lane-sync.ts`, `tests/unit/lane-sync.test.ts`, docs |
| Parity observability | `managed-status.ts`, `dbs-status.ts`, tests |
| Regression | `managed-invitation-regression.test.ts`, `validation-runner.mjs`, screenshot config |
| Preview fixture | `preview-e2e-fixture.ts`, E2E + unit tests |
| Classification | `tests/unit/ci-test-tier-classification.test.ts` |
