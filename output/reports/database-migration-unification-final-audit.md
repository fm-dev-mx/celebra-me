# Database Migration Unification — Final Audit (Goal 3)

**Worktree:** `dev-extra`  
**HEAD at audit:** `1c8139ed` (`docs(database): document unified db migrate workflow and safety rails`)  
**Date (UTC):** 2026-08-04  
**Scope:** Final audit, in-scope defect correction, obsolete-surface cleanup, docs/package reconciliation, Graphify candidate recording.  
**Constraints honored:** No Persistent Local / Preview / Production DB mutation; Git index left unstaged (no stage/commit/reset); no secrets in this report.

---

## 1. Control-path convergence

| Environment | Package entry | Wrapper | Shared control path |
| --- | --- | --- | --- |
| Canonical | `pnpm db:migrate` → `scripts/db/migrate-cli.ts` | — | parse (`migrate-cli-args`) → expected pin (`migrate-expected`) → orchestrator (`migrate-orchestrator`) → policy → executors / compatibility |
| Local | `pnpm db:local:migrate` | `apply-local-migrations.ts` | Thin forward to `runMigrateCli` with `--target local` (legacy default `--apply` only here) |
| Preview | `pnpm db:preview:migrate` | `push-preview-migrations.ts` | Thin forward + `db-guard` pre-check |
| Production | `pnpm db:prod:migrate` | `push-prod-migrations.ts` | Thin forward + `db-guard` pre-check |
| Disposable | `pnpm db:migrate -- --target disposable-test` | — | Same orchestrator + `migrate-policy-disposable.ts` |

**Shared layers (single owners):**

| Layer | Owner |
| --- | --- |
| Planner / immutable plan | `scripts/db/migration-plan.ts` |
| Orchestrator | `scripts/db/migrate-orchestrator.ts` |
| Executors | `scripts/db/migrate-executors.ts` |
| Hosted compatibility evaluation | `scripts/db/migrate-compatibility.ts` (+ registry SSOT `migration-deployment-compatibility.ts` / `supabase/migration-rollout-registry.json`) |
| Schema lifecycle classifier | `scripts/db/schema-lifecycle-state.ts` (consumed by audit; migrate policies do not fork classifiers) |
| Expected-pin parser | `scripts/db/migrate-expected.ts` |

Environment policies (`migrate-policy-{local,preview,production,disposable}.ts`) retain only target-specific authorization, backup, identity, and verification rules.

Promote / mirror / patch / seed / restore / content workflows remain outside this orchestrator (no new coupling in this audit).

---

## 2. Contract verification

| Requirement | Result | Evidence |
| --- | --- | --- |
| `MigrationPlan` deterministic, immutable, secret-free | **PASS** | `migration-plan.ts`: `planId` from fixed-order identity hash; `redactedTargetIdentity` only; no URLs/credentials/timestamps in identity. Covered by `tests/db/migration-plan.test.ts`. |
| Apply fresh preflight + plan/pending drift fail-closed | **PASS** | `orchestrateMigrate` builds plan twice, `detectPlanDrift` / `assertNoDrift` / `assertReviewDrift` before `beforeWrite`. Covered by `tests/db/migrate-orchestrator.test.ts`. |
| Canonical commands default read-only preflight | **PASS** | `parseMigrateCliArgs` default `mode: 'preflight'`; `db:migrate` help documents apply as opt-in. |
| Preview scope token or interactive `YES` | **PASS** | `migrate-policy-preview.ts` → `authorizePreviewWriteApply` with `preview:schema:migrate` / TTY `YES`. |
| Production owner-TTY-only; reject agents / non-interactive; release identity; backups once in order | **PASS** (with Goal 3 audit memo) | `owner-production-apply.ts` blocks agents and non-TTY; policy validates release-check evidence on apply; sequence `beforeWrite` (pre-backup) → `authorize` → `execute` → `afterWrite` (post-backup). Production object audit is memoized once per orchestration via `MigratePolicySession` so apply rebuilds do not re-run audit; dry-run still runs twice for live drift detection. |
| Hosted migrations without explicit rollout phase fail closed | **PASS** | Compatibility evaluation fails closed for unspecified hosted phases (registry + `migrate-compatibility.ts`; unit coverage in `tests/unit/migration-deployment-compatibility.test.ts`). |
| Human → stderr; structured → clean redacted stdout | **PASS** | `migrate-cli.ts` `writeHuman` → stderr; `--json` emits `planToJson` on stdout. |
| Arg parse / help cannot trigger DB/env side effects | **PASS** | `migrate-cli-args.ts` is pure; help returns before dynamic import of orchestrator. `tests/db/migrate-cli-args.test.ts` asserts no orchestrator/policy/executor imports. |
| Promote/mirror/patch/seed/restore decoupled | **PASS** | No orchestrator imports from those surfaces; docs/rules still describe separate commands. |
| Local legacy default-apply isolated + deprecated | **PASS** (Goal 3) | Only `apply-local-migrations.ts` injects `--apply`; stderr `DEPRECATED` warning; canonical `db:migrate -- --target local` remains preflight-first. |
| Deprecated `--allowlist` / `EXPECTED_MIGRATIONS` Preview-only | **PASS** (Goal 3 fix) | `parseExpectedConstraint(..., { allowDeprecatedAliases })` enabled only when `target === 'preview'` in `migrate-cli.ts`. Production/Local reject aliases. Tests updated. |

---

## 3. Corrected defects (Goal 3)

1. **Deprecated aliases accepted for all targets**  
   - **Was:** `parseExpectedConstraint` accepted `--allowlist` / `EXPECTED_MIGRATIONS` without a target gate.  
   - **Fix:** Preview-only via `allowDeprecatedAliases: parsed.target === 'preview'`; other targets fail closed.  
   - **Files:** `scripts/db/migrate-expected.ts`, `scripts/db/migrate-cli.ts`, `tests/db/migrate-expected.test.ts`.

2. **Production audit ran twice on apply rebuild**  
   - **Was:** Apply rebuild called `buildPlan` twice; each ran the expensive production audit subprocess.  
   - **Fix:** `MigratePolicySession.productionAuditCompleted` memoizes audit within one orchestration; dry-run still double-runs for drift.  
   - **Files:** `scripts/db/migrate-policy.ts`, `migrate-policy-production.ts`, `migrate-orchestrator.ts`.

3. **Helper re-export kept orchestration surface on Production wrapper**  
   - **Was:** Tests imported `isAllowlistedBehindAuditOutput` from `push-prod-migrations.ts`.  
   - **Fix:** Import from `migrate-policy-production.ts`; wrapper is thin delegation only.  
   - **Files:** `push-prod-migrations.ts`, `tests/scripts/push-prod-migrations.test.ts`, `tests/provision/romina-draft-reset.test.ts`.

4. **Local default-apply deprecation not operator-visible**  
   - **Fix:** Stderr deprecation when shim injects `--apply`; docs/rules state removal criteria.  
   - **Files:** `apply-local-migrations.ts`, `.agent/rules/database.md`, `docs/domains/database/overview.md`.

5. **Docs still implied non-canonical / stale wording**  
   - **Fix:** RSVP DB doc + workflow registry wording point at `db:migrate` / shared orchestrator; local legacy called out as deprecated.  
   - **Files:** `docs/domains/rsvp/database.md`, `docs/database-workflow.md`, overview + database rule as above.

---

## 4. Deleted artifacts

| Artifact | Reason | Callers checked |
| --- | --- | --- |
| `scripts/db/hosted-migration-compatibility-gate.ts` | Superseded by `migrate-compatibility.ts`; no remaining TypeScript imports | Repo grep (active code); only historical mention in Goal 1 audit report |

---

## 5. Intentionally retained compatibility surfaces

| Surface | Why retained | Removal criteria |
| --- | --- | --- |
| `pnpm db:local:migrate` → `apply-local-migrations.ts` | Legacy default-apply callers | No docs/scripts/CI rely on default-apply; operators use `db:migrate -- --target local` (+ explicit `--apply`); then delete default-`--apply` injection (and eventually the alias if unused). |
| `pnpm db:preview:migrate` → `push-preview-migrations.ts` | Named alias + `db-guard` | Optional: keep as thin alias indefinitely, or remove when operators standardize on `db:migrate -- --target preview`. |
| `pnpm db:prod:migrate` → `push-prod-migrations.ts` | Named alias + `db-guard` | Same as Preview alias. |
| Preview `--allowlist` / `EXPECTED_MIGRATIONS` | Documented transition shim | Grep shows no remaining operational scripts/docs callers outside deprecation text/tests; then delete alias branches + tests; Goal 3 removal ack. |
| `isAllowlistedBehindAuditOutput` name | BEHIND-audit allow-path for Production preflight | Rename optional; behavior still required for clean BEHIND audits before apply. |

---

## 6. External cleanup candidates (authorization required)

Inspected sibling / Integration Graphify trees **read-only**. Do **not** delete without owner authorization.

| Location | Candidate | Notes |
| --- | --- | --- |
| Integration `celebra-me/graphify-out/2026-07-17/` | Dated Graphify snapshot directory | Obsolete dated output |
| Integration `celebra-me/graphify-out/2026-07-18/` | Dated Graphify snapshot directory | Obsolete dated output |
| Integration `celebra-me/graphify-out/cache/`, `.graphify_python`, etc. | Tooling/cache siblings | Confirm not needed by Integration operators before delete |
| `dev-local/graphify-out/cache/`, `.graphify_python`, `.graphify_detect.json` | Local tooling artifacts | Outside `dev-extra`; owner auth required |

**Canonical graph (this worktree):** Refreshed after source cleanup via `pnpm ops graphify-refresh`.  
`graphify-out/SOURCE_STATE.json`:

- `sourceHead` = `1c8139ed2fd5df40d83c09d62efe6d92554cdf54` (matches `git rev-parse HEAD`)
- Working-tree diff captured via `trackedDiffHash` / untracked Goal 1 report listed
- No `hosted-migration-compatibility-gate` node; `migrate-orchestrator.ts` present
- Snapshot: 9100 nodes / 24356 edges

---

## 7. Validation results

| Check | Result |
| --- | --- |
| Focused migrate tests (`migrate-expected`, `migrate-cli-args`, `migrate-orchestrator`, `push-preview-migrations`, `push-prod-migrations`, `production-authorization`) | **32 passed** |
| Related regression (`romina-draft-reset`, `phase3-operational-contracts`, `release-check`) | **13 passed** |
| Plan / compatibility / safety units | **22 passed** |
| `pnpm type-check` | **PASS** (0 errors) |
| `pnpm validate:changed` | **PASS** (Prettier advisory only on some working-tree files) |
| `pnpm validate:structure` | **PASS** |
| `git diff --check` | **PASS** (CRLF warnings only) |
| `pnpm agent:git-safety:check` | **PASSED with warnings** (authorized session; reports staged/HEAD drift vs older auth baseline — current index has **zero** staged files) |

**Git index:** Unstaged working tree only; no `git add` / commit / reset performed in Goal 3.  
**Protected DB mutation:** None performed.

---

## 8. Remaining risks

1. **Single-operator concurrency residual** — documented in `MIGRATE_CONCURRENCY_RESIDUAL_RISK`; no distributed lock.  
2. **Local default-apply shim** — still mutates when using `db:local:migrate` without flags; mitigated by stderr deprecation and canonical preflight-first path.  
3. **Preview alias window** — `--allowlist` / `EXPECTED_MIGRATIONS` remain until removal criteria met.  
4. **Apply double dry-run** — intentional for live drift; Production audit now once-per-orchestration, but dry-run cost remains 2× on apply.  
5. **External dated Graphify dirs** — still present outside `dev-extra` until authorized cleanup.  
6. **Graphify SOURCE_STATE** — reflects HEAD + working-tree hash at refresh time; commit of Goal 3 changes (when authorized) should re-run `pnpm ops graphify-refresh` so `sourceHead` advances with the cleanup commit.

---

## 9. Goal completion statement

Local, Preview, and Production schema migration entry points converge on one planner, orchestrator, executor layer, and lifecycle classifier. Safeguards (Production backups + authorization order; Preview auth; hosted phase fail-closed; apply drift checks) execute as specified. Unjustified duplicate hosted-gate wrapper removed; remaining compatibility surfaces are thin or explicitly time-boxed. Required checks passed; no protected database or Git index mutation occurred in this audit.
