# Database Migration Unification Audit — Goal 1 Implementation Contract

**Lane:** `dev-extra` **Mode:** read-only diagnostics; sole permitted write is this report
**Authority:** live source, `package.json`, active rules/docs (not Graphify) **Date:** 2026-08-04
**HEAD at audit:** `3706f53f` (full: `3706f53fc0bbaeadfb6f98227dfb2ba33468a695`) **Git safety:**
`pnpm agent:git-safety:check` → PASSED (no active session) **Hosted DB state:** UNVERIFIED (no
Production/Preview/Local mutation or live audit invoked)

---

## 0. Executive verdict

Schema migration today is a **three-runner control plane** sharing some pure helpers but not one
orchestrator:

| Target           | Entrypoint                | Runner                                  | Apply executor           |
| ---------------- | ------------------------- | --------------------------------------- | ------------------------ |
| Production       | `pnpm db:prod:migrate`    | `scripts/db/push-prod-migrations.ts`    | `supabase db push --yes` |
| Preview          | `pnpm db:preview:migrate` | `scripts/db/push-preview-migrations.ts` | `supabase db push --yes` |
| Persistent-local | `pnpm db:local:migrate`   | `scripts/db/apply-local-migrations.ts`  | direct `psql` atomic SQL |
| Disposable-test  | (internal / CLI)          | `scripts/db/apply-migrations.ts`        | direct `psql` atomic SQL |
| Ambiguous push   | `pnpm db:push`            | `scripts/db/blocked-db-push.mjs`        | blocked (exit 1)         |

Shared already: pending-set comparison, hosted compatibility gate, Production owner TTY boundary,
target classification, schema-lifecycle classifier, migration-history reader. **Not shared:** plan
construction, CLI flag vocabulary, release-identity policy, backup policy, exact-set obligation,
authorization adapter, Local vs hosted executor.

All seven previously identified inconsistencies are confirmed with code evidence (Section 3). Goal 2
must unify plan + orchestration while keeping environment policies isolated.

---

## 1. Responsibility map

### 1.1 Package aliases (SSOT: `package.json`)

| Alias                                                   | Command chain                                                                        | Mutation?                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `db:prod:migrate`                                       | `db-guard check --target production --operation migrate` → `push-prod-migrations.ts` | Only with `--apply` after owner gate             |
| `db:preview:migrate`                                    | `db-guard check --target preview --operation migrate` → `push-preview-migrations.ts` | Only with `--apply` after Preview auth           |
| `db:local:migrate`                                      | `apply-local-migrations.ts` only (**no** package-level `db-guard check`)             | Yes — applies pending local SQL                  |
| `db:push`                                               | `blocked-db-push.mjs`                                                                | Never                                            |
| `db:prod:audit` / `db:preview:audit` / `db:local:audit` | `db-guard check` → `audit-db.ts`                                                     | Read-only target; may start disposable reference |
| `db:contract:verify`                                    | `verify-mutation-schema-contract.ts`                                                 | Read-only privilege/schema probe                 |
| `release-check`                                         | `release-check.ts`                                                                   | Writes gitignored evidence only                  |
| `db:prod:backup` / `:critical` / `:daily`               | guard → backup scripts                                                               | Read-only from Production; local file writes     |
| `db:migrate:new`                                        | `supabase migration new`                                                             | Creates local migration file only                |
| `db:prod:patch`                                         | `run-prod-patch.ts`                                                                  | Separate specialized path (not schema migrate)   |
| `db:preview:sync-invitations`                           | guard → `preview-sync-invitations.ts`                                                | Content mirror (not schema)                      |
| `invitation:promote`                                    | promote CLI                                                                          | Managed content (not schema)                     |

**Inventory gap:** `scripts/README.md` lists `db:prod:migrate` / `db:preview:migrate` /
`release-check` but **omits** `db:local:migrate` and `db:local:audit`. `docs/database-workflow.md`
“Common Commands” likewise omits `db:local:migrate` (documented instead in
`docs/domains/database/overview.md`).

### 1.2 Core mechanisms → ownership

| Mechanism                    | Owner file(s)                                                                                                         | Key symbols                                                                                                                                   | Callers                                                   | Dependencies                                                                                                                           | Tests                                                                                                                                                  | Authoritative docs                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Production orchestrator      | `scripts/db/push-prod-migrations.ts`                                                                                  | `main`, `parseCliArgs`, `isAllowlistedBehindAuditOutput`, `PRODUCTION_MIGRATION_OPERATION_TYPE`                                               | `db:prod:migrate`                                         | pending-set, hosted gate, owner-apply, release-check, audit-db (subprocess), daily/critical backup, contract verify, `db-workflow-lib` | `tests/scripts/push-prod-migrations.test.ts`, `tests/provision/production-authorization.test.ts`, `tests/scripts/phase3-operational-contracts.test.ts` | `.agent/rules/database.md`, `docs/database-workflow.md` §`db:prod:migrate` |
| Preview orchestrator         | `scripts/db/push-preview-migrations.ts`                                                                               | `main`, `parseAllowlist`, `parseCliArgs`, `PREVIEW_MIGRATE_AUTH_*`                                                                            | `db:preview:migrate`                                      | pending-set, hosted gate, `preview-write-auth`, secret resolution, contract verify                                                     | `tests/db/push-preview-migrations.test.ts`, phase3 contracts                                                                                           | `docs/database-workflow.md` Preview section; `database.md` Preview rules   |
| Local adapter                | `scripts/db/apply-local-migrations.ts`                                                                                | `verifyPersistentLocalTarget`, `getAppliedLocalMigrationVersions`, `main`                                                                     | `db:local:migrate`                                        | `db-guard` classify/identity, `apply-migrations` helpers, `runPsql`                                                                    | `tests/db/apply-local-migrations.test.ts`                                                                                                              | `docs/domains/database/overview.md` Migration Strategy                     |
| Disposable executor          | `scripts/db/apply-migrations.ts`                                                                                      | `enforceDisposableTargetOnly`, `getValidatedMigrationFiles`, `runPsqlCommand`                                                                 | disposable pipeline; imported by local adapter            | `db-guard` classify                                                                                                                    | `tests/scripts/db-pipeline-safety.test.ts`                                                                                                             | `database.md` disposable rules                                             |
| Exact pending-set            | `scripts/db/migration-pending-set.ts`                                                                                 | `parseMigrationVersionList`, `extractPendingMigrationVersions`, `comparePendingSetToExpected`                                                 | both hosted runners                                       | none (pure)                                                                                                                            | `tests/scripts/push-prod-migrations.test.ts`                                                                                                           | Implied by workflow docs                                                   |
| Rollout / release membership | `scripts/db/migration-deployment-compatibility.ts` + `supabase/migration-rollout-registry.json`                       | `evaluateMigrationDeploymentCompatibility`, `evaluateAppDatabaseReadiness`, `resolveHostedMigrationIdentity`, `listMigrationVersionsAtGitSha` | hosted gate                                               | `git ls-tree`, registry file                                                                                                           | `tests/unit/migration-deployment-compatibility.test.ts`                                                                                                | `docs/database-workflow.md` Compatibility Contract                         |
| Hosted gate wrapper          | `scripts/db/hosted-migration-compatibility-gate.ts`                                                                   | `runHostedMigrationCompatibilityGate`                                                                                                         | prod + preview runners                                    | compatibility module                                                                                                                   | phase3 contracts (wiring)                                                                                                                              | same                                                                       |
| Production owner auth        | `scripts/db/owner-production-apply.ts`                                                                                | `requireOwnerProductionApply`, `agentSelfAuthorizationBlocked`, `assertExactProductionProjectRef`                                             | migrate, patch, promote, romina-draft-reset               | release-check evidence, project refs                                                                                                   | `tests/provision/production-authorization.test.ts`                                                                                                     | `database.md` Owner authorization                                          |
| Preview write auth           | `scripts/provision/preview-write-auth.ts`                                                                             | `authorizePreviewWriteApply`, `verifyPreviewWriteAuthorization`, `confirmPreviewWriteYes`                                                     | preview migrate, sync-invitations, other Preview mutators | readline TTY / `CELEBRA_TASK_SCOPE`                                                                                                    | preview migrate tests; provision auth tests                                                                                                            | `database.md` Preview authorization                                        |
| Release evidence             | `scripts/db/release-check.ts`                                                                                         | `runReleaseCheck`, `assertValidReleaseCheckEvidence`, `readGitWorktreeState`                                                                  | `pnpm release-check`; Production apply path               | git, `pnpm type-check/test/build`                                                                                                      | `tests/scripts/release-check.test.ts`                                                                                                                  | `docs/database-workflow.md` `release-check`                                |
| Target identity / secrets    | `scripts/db/db-target-config.ts`, `scripts/db/db-guard.ts`                                                            | `classifyDbTarget`, `resolveDbUrl`, `guard*`, `cliCheck`                                                                                      | package wrappers; local adapter                           | `SUPABASE_PROJECT_REFS`, secret files                                                                                                  | `tests/unit/db-guard.test.ts`                                                                                                                          | `database.md` Architecture; `docs/env-workflow.md`                         |
| Schema lifecycle             | `scripts/db/schema-lifecycle-state.ts`                                                                                | `classifySchemaLifecycle`, `domainUnverified`                                                                                                 | audit, migration-probe, invitation preflight boundary     | none (pure)                                                                                                                            | `tests/db/schema-lifecycle-state.test.ts`                                                                                                              | `database.md` status vs audit evidence classes                             |
| History reader               | `scripts/status-core/migration-history-reader.ts`                                                                     | `fetchRemoteMigrationVersions`                                                                                                                | audit, status, invitation preflight                       | `runCommand`/`psql`                                                                                                                    | `tests/scripts/db-pipeline-safety.test.ts`, status-core tests                                                                                          | status/observability docs                                                  |
| Status probe                 | `scripts/status-core/migration-probe.ts`                                                                              | `listExpectedMigrationVersions`, `readMigrationLifecycleForUrl*`                                                                              | `dbs` / observability                                     | history + lifecycle + parity                                                                                                           | `tests/unit/status-core.test.ts`                                                                                                                       | observability / `dbs`                                                      |
| Object audit                 | `scripts/db/audit-db.ts`                                                                                              | `evaluateMigrationHistoryParity`, CLI `--target`                                                                                              | `db:*:audit`; Production migrate subprocess               | disposable env, lifecycle, history reader                                                                                              | db-pipeline-safety, prod helper tests                                                                                                                  | `database.md` audit vs status                                              |
| Post-apply contract          | `scripts/db/verify-mutation-schema-contract.ts`                                                                       | CLI `--target`                                                                                                                                | prod/preview migrate after apply                          | target URLs, `psql` JSON probe                                                                                                         | phase3 contracts (ordering)                                                                                                                            | `database.md` step 10                                                      |
| Backups                      | `daily-critical-production-backup.ts`, `backup-critical-production.ts`, `backup-manifest.ts`, `recovery-integrity.ts` | daily/critical entrypoints                                                                                                                    | Production migrate steps 5 & 8; standalone backup aliases | Production URL, EFS, manifests                                                                                                         | phase3 contracts, backup tests                                                                                                                         | `docs/database-workflow.md` backup sections                                |
| Blocked ambiguous push       | `scripts/db/blocked-db-push.mjs`                                                                                      | (script body)                                                                                                                                 | `db:push`                                                 | none                                                                                                                                   | (implicit via package alias)                                                                                                                           | `database.md` Current Contract                                             |
| Branch migration identity    | `scripts/db/branch-migration-parity.ts` (+ diagnose/remediate)                                                        | parity analysis                                                                                                                               | `db:branch:*`                                             | migrations dir                                                                                                                         | `tests/scripts/branch-migration-parity.test.ts`                                                                                                        | `docs/database-workflow.md` branch-lane                                    |
| Shared command helpers       | `scripts/db/db-workflow-lib.ts`                                                                                       | `runCommand`, `runPsql`, `getProdDbUrl`, `fail`, redaction                                                                                    | nearly all DB CLIs                                        | target-config                                                                                                                          | `tests/unit/db-workflow-lib.test.ts`                                                                                                                   | scripts ownership notes                                                    |

### 1.3 Environment variables (migration-relevant)

| Variable                                                         | Used by                                            | Role                                                |
| ---------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `PROD_DB_URL` / `.env.production.local`                          | Production migrate/audit/backup                    | Credential resolution                               |
| `PREVIEW_DB_URL` / `.env.preview.local`                          | Preview migrate/audit                              | Credential resolution                               |
| `LOCAL_DB_URL` (via `db-guard` constants)                        | Local migrate                                      | Persistent-local URL                                |
| `EXPECTED_MIGRATIONS`                                            | **Preview only**                                   | Optional exact pending set (alias of `--allowlist`) |
| `--expected` CLI                                                 | **Production only**                                | Mandatory exact pending set                         |
| `--allowlist` CLI                                                | Preview accepted; Production **rejected**          | Naming split                                        |
| `CELEBRA_TARGET_RELEASE_SHA`                                     | Preview hosted gate; Production overridden by HEAD | Target-release Git tree                             |
| `CELEBRA_DEPLOYED_APP_SHA` / `CELEBRA_DEPLOYED_APP_CAPABILITIES` | Hosted gate (contract phases / readiness)          | Deployed-app evidence                               |
| `CELEBRA_TASK_SCOPE`                                             | Preview authorize (`preview:schema:migrate`)       | Headless Preview apply                              |
| `CELEBRA_AGENT_CONTEXT`                                          | `owner-production-apply`                           | Reject agent self-auth                              |

### 1.4 Separation from non-schema paths (KEEP boundary)

| Path                    | Alias                                         | Must remain outside schema migrate            |
| ----------------------- | --------------------------------------------- | --------------------------------------------- |
| Managed content promote | `invitation:promote`                          | Shares owner gate only                        |
| Preview content mirror  | `db:preview:sync-invitations`                 | Separate Preview scope slug                   |
| Manual SQL patches      | `db:prod:patch`                               | `RESTRICT_OWNER_ONLY` / not versioned migrate |
| Seeds / fixtures        | disposable seed, `invitation:preview-fixture` | Never auto-run by migrate                     |
| Local restore from dump | `db:local:restore-from-dump`                  | Data import, not schema promote               |

---

## 2. Local → Preview → Production execution flows

### 2.1 Persistent-local (`pnpm db:local:migrate`)

```text
READ:  classify LOCAL_DB_URL → must be persistent-local
READ:  verify supabase/config.toml identity (celebra-me-rsvp)
READ:  ensure schema_migrations exists; list applied versions
READ:  list validated repo migration files (apply-migrations helpers)
WRITE: for each pending file — BEGIN; SQL; INSERT schema_migrations; COMMIT (psql)
FAIL:  classification/identity fail; any migration atomic failure → exit 1
ABSENT: allowlist/expected, rollout registry, release-check, backups, TTY, agent gate,
        supabase db push, package-level db-guard check, post contract verify
```

### 2.2 Preview (`pnpm db:preview:migrate`)

```text
GUARD: db-guard check --target preview --operation migrate (URL classify match)
READ:  resolve PREVIEW_DB_URL
READ:  supabase db push --dry-run → extract pending versions
READ?: optional --allowlist / EXPECTED_MIGRATIONS → exact-set compare (optional)
READ:  schema_migrations applied set
READ:  hosted compatibility gate
       (requires CELEBRA_TARGET_RELEASE_SHA; contract needs deployed-app evidence)
BRANCH:
  no candidates → contract verify only; return
  no --apply → print apply hint; return (no write)
AUTH:  authorizePreviewWriteApply(slug=schema, op=migrate)
       TTY → YES; non-TTY → exact CELEBRA_TASK_SCOPE=preview:schema:migrate
WRITE: supabase db push --db-url <preview> --yes
READ:  verify each candidate in schema_migrations
READ:  verify-mutation-schema-contract --target preview
ABSENT: release-check, Production owner challenge, critical backups, mandatory expected set
```

### 2.3 Production (`pnpm db:prod:migrate`)

```text
GUARD: db-guard check --target production --operation migrate
PARSE: mandatory --expected; reject --allowlist
READ:  resolve/assert PROD_DB_URL
READ:  audit-db --target production
       allow continue only if pass OR (BEHIND && Errors:0)
READ:  supabase db push --dry-run → exact compare to --expected
READ:  HEAD as release SHA (worktree state)
READ:  hosted compatibility gate with targetReleaseShaOverride=HEAD
       (CELEBRA_TARGET_RELEASE_SHA not used for Production)
BRANCH no --apply:
  print "pnpm release-check && ... --apply --expected ..."; return
READ:  assertValidReleaseCheckEvidence (standalone prior pnpm release-check)
READ/WRITE local: daily-critical-production-backup (verified recovery point)
AUTH:  requireOwnerProductionApply
       --apply, agent reject, exact project ref, release evidence,
       challenge = `MIGRATE <sha> <expected...>`, TTY exact match
WRITE: supabase db push --db-url <prod> --yes
READ:  expected versions present in schema_migrations
READ:  verify-mutation-schema-contract --target production
READ/WRITE local: backup-critical-production (post recovery set)
FAIL paths: any pre-gate failure exits before write; backup failure before owner confirm
            performs no Production write; confirmation mismatch performs no write
ABSENT: resume/checkpoint after partial push; concurrency lock; --json mode;
        risk-tiered backup skipping; mandatory registry phase for every migration
```

### 2.4 Cross-cutting verification / failure semantics

| Concern                        | Local                               | Preview                          | Production                            |
| ------------------------------ | ----------------------------------- | -------------------------------- | ------------------------------------- |
| Default no-write               | N/A (always applies pending)        | Yes (no `--apply`)               | Yes (no `--apply`)                    |
| Non-TTY apply                  | Allowed                             | Scoped token                     | **Blocked** (`TTY_REQUIRED`)          |
| Agent apply                    | Allowed                             | Scoped token                     | **Blocked** (`CELEBRA_AGENT_CONTEXT`) |
| Resume after mid-apply failure | Per-file stop; re-run skips applied | Supabase push resume: UNVERIFIED | Same as Preview: UNVERIFIED           |
| Concurrent migrate             | No lock                             | No lock                          | No lock                               |
| JSON / headless plan output    | No                                  | No                               | No (owner prompts on stderr only)     |

---

## 3. Known findings — evidence and disposition

### F1. Separate orchestrators

**Evidence:** Distinct `main` flows in `push-prod-migrations.ts`, `push-preview-migrations.ts`,
`apply-local-migrations.ts`; duplicated dry-run → candidate → gate → auth → push → verify sequencing
between hosted runners. **Disposition:** **CONSOLIDATE** orchestrator; **KEEP** environment policy
modules. **Goal 2 AC:** One schema-migrate orchestrator builds an immutable plan and dispatches
environment policy + executor; deleting either hosted runner file is blocked until the other is a
thin alias or gone.

### F2. `--allowlist` versus `--expected`

**Evidence:** Production rejects `--allowlist` and requires `--expected` (`push-prod-migrations.ts`
parseCliArgs). Preview accepts `--allowlist` / `EXPECTED_MIGRATIONS` and never mentions `--expected`
(`push-preview-migrations.ts`). Both call the same `comparePendingSetToExpected`. **Disposition:**
**CONSOLIDATE** CLI vocabulary to one flag (recommend `--expected`) with temporary Preview alias.
**Goal 2 AC:** Single documented flag; Preview still accepts deprecated alias for one transition
window with warning; Production and Preview share parser.

### F3. Manually supplied migration / release inputs

**Evidence:** Production requires operator-typed `--expected` even when dry-run already enumerates
pending. Preview may omit allowlist and apply the dry-run set. Preview requires operator-supplied
`CELEBRA_TARGET_RELEASE_SHA`; Production derives release from HEAD + release-check evidence.
**Disposition:** **REPLACE** manual expected for happy path with plan derived from dry-run +
explicit operator confirmation of the plan hash/set; **KEEP** ability to pin an exact set for
constrained applies. Release identity remains policy-specific (HEAD vs target SHA). **Goal 2 AC:**
Preflight emits a plan containing exact pending versions; apply refuses if live dry-run ≠ plan;
optional `--expected` only to constrain/pin, not as the sole discovery channel.

### F4. Standalone release-check sequencing

**Evidence:** Preflight message tells operator to run
`pnpm release-check && pnpm db:prod:migrate -- --apply ...` separately (`push-prod-migrations.ts`).
Apply only validates evidence via `assertValidReleaseCheckEvidence`. Evidence is a gitignored file
under `.agent/tmp/`. **Disposition:** **REUSE** `release-check.ts` as the evidence producer;
**CONSOLIDATE** sequencing so Production apply plan records required evidence SHA and fails with a
single actionable error if missing/stale (optional orchestrated substep remains env-policy). **Goal
2 AC:** Production apply plan includes `releaseEvidenceSha`; missing/stale evidence fails closed
before backup/TTY; no silent re-use of mismatched HEAD.

### F5. Destructive / unclassified migrations accepted without explicit rollout classification

**Evidence:** `defaultPhase` returns `'unspecified'` when registry lacks the version;
`evaluateCandidateVersion` only adds contract-specific reasons when `phase === 'contract'`.
Unspecified candidates still `allow` if present in release tree. Registry currently annotates **4**
version keys vs **73** migration SQL files. Docs intentionally say “annotate only migrations that
participate in sequencing,” which leaves DROP/REVOKE-class migrations unclassified unless manually
registered. **Disposition:** **REPLACE** silent `unspecified` allow for hosted applies with
fail-closed classification policy (exact policy is an unresolved decision — Section 7). **Goal 2
AC:** Hosted apply cannot proceed when any candidate phase is missing/unspecified **unless** an
explicit approved exception mechanism is defined and tested; registry completeness is enforceable.

### F6. Risk-independent backup behavior

**Evidence:** Production apply always runs complete critical pre-backup
(`daily-critical-production-backup.ts`) and post-backup (`backup-critical-production.ts`) regardless
of rollout phase, candidate count, or SQL risk class (`push-prod-migrations.ts` steps 5 & 8; phase3
contract test asserts ordering). Preview has **no** backup gate. **Disposition:** **KEEP** mandatory
complete Production recovery points for schema apply (do not weaken). **CONSOLIDATE** backup
invocation behind a Production environment policy so Goal 2 does not fork backup semantics. Optional
future risk tiers are out of scope unless explicitly decided (Section 7). **Goal 2 AC:** Production
apply still requires verified pre-backup before owner confirmation and post-backup after contract
verify; Preview remains non-backup; policy is not inlined twice across runners.

### F7. Obsolete Graphify output outside the canonical root

**Evidence:**

- Repo policy (`.agent/rules/graphify-ops.md`): optional local `graphify-out/` via
  `pnpm ops graphify-refresh`; leads only; not authority.
- This worktree `graphify-out/SOURCE_STATE.json` matches audit HEAD `3706f53f…` (fresh leads
  available).
- Integration checkout also has `graphify-out/` including dated directories `2026-07-17` and
  `2026-07-18` (legacy layout) plus a current graph — **outside** the active `dev-extra` lane root.
- Other worktrees (`dev-local`, `dev-preview`) also contain `graphify-out/` (lane-local copies).

**Disposition:** **DELETE** dated legacy Integration directories after owner confirmation; **KEEP**
lane-local `graphify-out/` as gitignored optional state; **never** treat Graphify as migration SSOT.
**Goal 2 AC:** Migration unification does not depend on Graphify; deletion inventory lists dated
Integration paths; proof = directories absent + `pnpm ops graphify-doctor` still passes in a chosen
lane if Graphify is used.

---

## 4. Component dispositions (summary)

| Component                                                                                          | Disposition                                                              | Rationale                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `migration-pending-set.ts`                                                                         | **KEEP / REUSE**                                                         | Already the shared exact-set primitive              |
| `hosted-migration-compatibility-gate.ts`                                                           | **KEEP / REUSE**                                                         | Shared hosted wrapper                               |
| `migration-deployment-compatibility.ts` + registry                                                 | **KEEP**; tighten unspecified policy via **REPLACE** of allow-on-missing | Core contract SSOT                                  |
| `owner-production-apply.ts`                                                                        | **KEEP**                                                                 | Shared Production mutator boundary                  |
| `preview-write-auth.ts`                                                                            | **KEEP**                                                                 | Shared Preview boundary                             |
| `release-check.ts`                                                                                 | **REUSE**                                                                | Evidence producer; sequencing consolidated          |
| `schema-lifecycle-state.ts`                                                                        | **KEEP**                                                                 | Single classifier (post Goal 3 cleanup)             |
| `migration-history-reader.ts` / `migration-probe.ts`                                               | **KEEP**                                                                 | Status/audit consumers; not apply orchestrators     |
| `audit-db.ts`                                                                                      | **KEEP**                                                                 | Object audit distinct from status history           |
| `db-guard.ts` / `db-target-config.ts`                                                              | **KEEP**                                                                 | Target policy/identity                              |
| `blocked-db-push.mjs`                                                                              | **KEEP**                                                                 | Safety rail                                         |
| `push-prod-migrations.ts` / `push-preview-migrations.ts`                                           | **CONSOLIDATE → thin env adapters**                                      | Duplicate orchestration                             |
| `apply-local-migrations.ts`                                                                        | **REUSE** as Local executor adapter                                      | Different executor by design                        |
| `apply-migrations.ts`                                                                              | **KEEP** disposable executor + shared file validation                    | Local imports helpers                               |
| `verify-mutation-schema-contract.ts`                                                               | **KEEP**                                                                 | Post-apply verification                             |
| Production critical backup scripts                                                                 | **KEEP** behind Production policy                                        | Risk-independent completeness retained              |
| `db:prod:patch` / promote / sync-invitations                                                       | **KEEP_SPECIALIZED** (out of schema unify)                               | Explicit separation                                 |
| Dated Integration `graphify-out/2026-*`                                                            | **DELETE** (after proof)                                                 | Obsolete outside active lane                        |
| Duplicate migration file listing (`listExpectedMigrationVersions` vs `getValidatedMigrationFiles`) | **CONSOLIDATE**                                                          | Two filename parsers; validation strictness differs |
| `EXPECTED_MIGRATIONS` env name                                                                     | **CONSOLIDATE / rename path**                                            | Align with `--expected`                             |

---

## 5. Minimum target architecture (Goal 2)

```text
                    ┌─────────────────────────────┐
                    │  CLI / package aliases      │
                    │  db:{local,preview,prod}:   │
                    │  migrate (+ compat wrappers)│
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Plan Builder (pure)        │
                    │  - target + operation       │
                    │  - credential/identity refs │
                    │  - dry-run pending set      │
                    │  - expected pin (optional)  │
                    │  - release/deploy identity  │
                    │  - rollout phases           │
                    │  - backup requirements      │
                    │  - auth requirements        │
                    │  → Immutable MigrationPlan  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Orchestrator               │
                    │  preflight → authorize →    │
                    │  execute → verify → evidence │
                    └──────┬───────────┬──────────┘
           ┌───────────────┼───────────┼────────────────┐
           ▼               ▼           ▼                ▼
   EnvPolicy:Local  EnvPolicy:Preview  EnvPolicy:Prod  EnvPolicy:Disposable
   (identity only)  (scope/TTY YES)   (release+backup+  (destructive OK)
                                       owner challenge)
           │               │           │                │
           └───────────────┴─────┬─────┴────────────────┘
                                 ▼
                    ┌────────────────────────────┐
                    │ Executors                  │
                    │ - SupabaseCliPushExecutor  │
                    │ - PsqlAtomicExecutor       │
                    └────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
     InteractiveAdapter                      HeadlessAdapter
     (TTY challenge / YES /                  (Preview scope token;
      plan review)                            JSON plan I/O;
                                              Production apply denied)
```

### 5.1 Immutable `MigrationPlan` (minimum fields)

- `target`, `mode` (`preflight` | `apply`)
- `credentialSource` (redacted), `projectRef` / local identity
- `pendingVersions[]` (from dry-run or local scan)
- `expectedPin[] | null`
- `phaseByVersion`, `compatibilityStatus`
- `releaseIdentity` (`head` | `targetSha` + value)
- `deployedAppIdentity` (nullable)
- `authRequirement` (`none` | `preview_scope_or_tty` | `production_owner_tty`)
- `backupRequirement` (`none` | `prod_critical_pre_post`)
- `executor` (`supabase_cli_push` | `psql_atomic`)
- `planId` / content hash for confirmation binding

Plans are **value objects**: apply re-validates live dry-run/history against the plan before write.

### 5.2 Environment policies (isolated)

| Policy     | Exact-set                              | Release identity                    | Auth            | Backup            | Executor      |
| ---------- | -------------------------------------- | ----------------------------------- | --------------- | ----------------- | ------------- |
| Local      | N/A (pending scan)                     | repo files @ worktree               | none            | none              | psql atomic   |
| Preview    | optional pin; default = dry-run set    | `CELEBRA_TARGET_RELEASE_SHA`        | Preview adapter | none              | supabase push |
| Production | pin required **or** confirmed plan set | clean HEAD + release-check evidence | Owner adapter   | critical pre+post | supabase push |
| Disposable | optional file/max-version              | none                                | none            | none              | psql atomic   |

### 5.3 Interactive adapter (reusable UX patterns)

Reuse interaction **models**, not invitation domain prompts:

| Pattern                                           | Source                        | Reuse for migrate                      |
| ------------------------------------------------- | ----------------------------- | -------------------------------------- |
| Exact challenge string + stderr summary           | `owner-production-apply.ts`   | Production apply                       |
| Exact `YES` on TTY; scope token non-TTY           | `preview-write-auth.ts`       | Preview apply                          |
| Plan-before-apply; default-deny; `--json` status  | `invitation-update-cli.ts`    | Headless/interactive plan presentation |
| `--interactive` / `--no-interactive` flag parsing | `scripts/screenshot/utils.ts` | CLI surface consistency only           |

Do **not** import invitation slug/package wizards into schema migrate.

### 5.4 Headless adapter

- **Preflight:** support `--json` MigrationPlan emission (stdout) with human logs on stderr.
- **Preview apply:** existing `CELEBRA_TASK_SCOPE=preview:schema:migrate` remains the only non-TTY
  auth.
- **Production apply:** remain TTY-only; headless must fail closed with `TTY_REQUIRED` / agent block
  (no new token path).

---

## 6. Transition and deletion inventory

### 6.1 Compatibility wrappers (keep until proof)

| Surface                                                            | Transition                                               | Proof before removal                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm db:prod:migrate`                                             | Keep alias → new orchestrator + Production policy        | Existing prod tests + authorization discovery still green                    |
| `pnpm db:preview:migrate`                                          | Keep alias → orchestrator + Preview policy               | Preview apply-gate tests green                                               |
| `pnpm db:local:migrate`                                            | Keep alias → orchestrator + Local policy / psql executor | Local target tests + disposable safety still green                           |
| `--allowlist` / `EXPECTED_MIGRATIONS`                              | Deprecated aliases → `--expected`                        | Grep shows no scripts/docs callers; warning tests; then delete               |
| `push-prod-migrations.ts` / `push-preview-migrations.ts` filenames | Thin re-export or delete after alias move                | `rg` no imports; package.json points to new entry; APPROVED_MUTATORS updated |
| Manual-only `--expected` as sole discovery                         | Optional pin after plan derivation                       | Operator docs updated; tests for plan≠dry-run fail-closed                    |

### 6.2 Deletion candidates

| Candidate                                                                          | Known callers                     | Proof required                                                                                  |
| ---------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Integration `graphify-out/2026-07-17`, `2026-07-18`                                | None (local gitignored artifacts) | Owner ack; dirs absent; no docs reference dated paths                                           |
| Duplicate pending-set parsers (if any reappear outside `migration-pending-set.ts`) | Hosted runners only today         | `rg extractPendingMigrationVersions` / `\d{14}_` dry-run parsers → single module                |
| Weaker `listExpectedMigrationVersions` filename split                              | `migration-probe.ts`              | Consolidated with `getValidatedMigrationFiles` or shared validator; status-core tests updated   |
| Legacy Ed25519 / receipt consumption                                               | Already removed from mutators     | Keep discovery test asserting absence (`production-authorization.test.ts`) — not a new deletion |

### 6.3 Must not delete

- `blocked-db-push.mjs`
- `owner-production-apply.ts` shared gate
- Critical backup scripts
- Rollout registry file (may grow)
- Disposable-only enforcement in `apply-migrations.ts`
- Separation of promote / patch / sync-invitations

---

## 7. Unresolved decisions / blockers

1. **Unspecified rollout phase policy:** Fail closed for all hosted candidates lacking registry
   phase? Or require phase only when static SQL risk heuristics detect DROP/REVOKE/TRUNCATE? Current
   docs allow sparse registry — Goal 2 must pick one and update docs + registry completeness
   process.
2. **Production expected-set UX:** Auto-derive from dry-run with challenge bound to plan hash, vs
   keep mandatory `--expected` forever as deliberate friction. Audit recommends derive + confirm;
   owner may prefer mandatory typing.
3. **Backup tiering:** Retain always-on complete critical backups (recommended KEEP) vs introduce
   expand/neutral skip tiers (explicitly not recommended without separate risk review).
4. **Local package guard:** Should `db:local:migrate` gain
   `db-guard check --target persistent-local --operation migrate` for alias symmetry? Local already
   classifies inside the adapter; decision is consistency vs double-check.
5. **Concurrency control:** Introduce advisory lock / evidence lock for hosted apply, or document
   single-operator assumption as accepted residual risk?
6. **Resume semantics:** After failed `supabase db push`, is re-run-from-preflight the only
   supported recovery? (Currently de facto yes; UNVERIFIED whether push is partially applied.)
7. **Graphify cleanup scope:** Delete only dated Integration folders, or also reconcile
   multi-worktree `graphify-out/` copies? Migration Goal 2 should not block on this.
8. **Documentation SSOT gap:** `db:local:migrate` missing from `scripts/README.md` and workflow
   common commands — fix in Goal 2 docs pass vs separate docs chore.
9. **Live hosted pending sets:** UNVERIFIED in this audit; Goal 2 implementation must not assume
   Production/Preview CURRENT/BEHIND without a fresh read-only audit when credentials resolve.

---

## 8. Finding-to-action matrix (Goal 2 implementation items)

| ID    | Finding                     | Goal 2 item                                                                   | Affected surface                                                             | Constraints                                                                          | Tests to add/extend                                                                          | Verifiable acceptance                                                                                 |
| ----- | --------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| G2-01 | F1 separate orchestrators   | Introduce `MigrationPlan` + shared orchestrator; env policies as plugins      | new module(s) under `scripts/db/`; thin wrappers for prod/preview/local      | No hosted DB writes in implementation PR; preserve fail-closed defaults              | Unit: plan hash stability; orchestration order matrix per target                             | Single orchestrator path traced in tests for all three targets; old duplicate sequencing gone or thin |
| G2-02 | F2 flag split               | Unify on `--expected`; deprecate `--allowlist`/`EXPECTED_MIGRATIONS`          | preview runner, docs, README, database.md                                    | Compatibility window required                                                        | Parser tests for alias warning; prod still rejects unknown flags appropriately               | One flag in docs; alias tests; `rg --allowlist` limited to deprecation shims                          |
| G2-03 | F3 manual inputs            | Plan builder derives pending set; optional pin; release identity per policy   | plan builder; prod/preview policies                                          | Production must not use `CELEBRA_TARGET_RELEASE_SHA` as auth                         | Tests: derive match; pin mismatch fail; preview without pin uses dry-run                     | Apply blocked when live dry-run ≠ plan; preflight JSON shows versions                                 |
| G2-04 | F4 release-check sequencing | Plan records required evidence; apply validates before backup                 | release-check integration; prod policy                                       | Do not embed full test/build into every preflight                                    | release-check evidence stale/missing/pass                                                    | Apply without evidence fails before backup; with matching HEAD evidence proceeds to TTY               |
| G2-05 | F5 unspecified phase        | Enforce explicit classification policy (per Section 7 decision)               | compatibility evaluator; registry; docs                                      | Must not strand historical migrations without a migration path for registry backfill | Unit: unspecified hosted candidate blocks (or approved exception); contract/expand unchanged | Hosted apply with unregistered candidate fails closed per chosen policy                               |
| G2-06 | F6 backups                  | Production policy owns pre/post critical backup calls once                    | prod policy module                                                           | Do not remove mandatory backups                                                      | phase3 ordering test updated to policy module                                                | Pre-backup before owner gate; post-backup after contract; Preview has zero backup calls               |
| G2-07 | F7 Graphify obsolete        | Document non-dependence; optional delete dated Integration dirs               | local artifacts only                                                         | No regen required for migrate unify; do not commit graphify-out                      | N/A (artifact hygiene)                                                                       | Dated dirs removed when authorized; migrate code has zero Graphify imports                            |
| G2-08 | Auth adapters               | Interactive + headless adapters wrapping existing gates                       | owner-apply, preview-write-auth                                              | No new Production token/env confirmation                                             | Existing production-authorization + preview tests must remain green                          | Agent/non-TTY Production fail; Preview scope exact match; prompts on stderr                           |
| G2-09 | Executors                   | Keep Supabase push vs psql atomic split behind interface                      | apply-local, apply-migrations, hosted push                                   | Disposable-only enforcement preserved                                                | db-pipeline-safety disposable restriction; local remote URL reject                           | Local never calls `supabase db push`; disposable reject non-disposable URLs                           |
| G2-10 | Headless JSON               | `--json` preflight plan on stdout                                             | CLI                                                                          | Production apply still TTY                                                           | JSON schema/unit tests; non-TTY apply prod fails                                             | `migrate --json` preflight exits 0 with plan; apply prod non-TTY exits ≠0                             |
| G2-11 | No-write default            | Preflight default for hosted; Local documents write nature                    | aliases/docs                                                                 | Preview/Prod default remain read-only                                                | preview test: no `--apply` ⇒ no push/auth                                                    | Documented + tested                                                                                   |
| G2-12 | Failure / resume            | Define resume = re-run preflight+plan revalidate; no silent continue          | orchestrator docs/tests                                                      | No partial-skip without history proof                                                | Simulated push failure then replan                                                           | After failure, apply refuses unless pending set revalidated                                           |
| G2-13 | Concurrency                 | Document or implement single-flight guard (decision §7.5)                     | prod/preview policy                                                          | Must not lock disposable/local incorrectly                                           | If implemented: lock contention test on disposable                                           | Chosen behavior tested; residual risk stated if deferred                                              |
| G2-14 | Docs inventory              | Add `db:local:migrate` to README + workflow common commands; align flag names | `scripts/README.md`, `docs/database-workflow.md`, `.agent/rules/database.md` | Relative paths only; Spanish UI N/A                                                  | Doc/structure validation if applicable                                                       | Inventory lists all three migrate aliases consistently                                                |
| G2-15 | Separation                  | Keep promote/patch/mirror outside orchestrator                                | package aliases; ownership tests                                             | APPROVED_MUTATORS families unchanged except path moves                               | production-authorization discovery                                                           | Schema orchestrator not imported by promote/sync; families still schema/promote/patch                 |

### 8.1 Required test matrix coverage (Goal 2)

| Axis                | Must cover                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Security / identity | target mismatch; Production project-ref mismatch; Preview URL classify                   |
| TTY                 | Production exact challenge; Preview YES; prompts not on stdout                           |
| Non-TTY             | Production apply fail; Preview scope success/fail; agent context fail                    |
| Failure             | audit drift; expected mismatch; compat block; backup fail before write; confirm mismatch |
| Resume              | replan after failed push; already-applied versions                                       |
| Concurrency         | per decision G2-13                                                                       |
| No-write            | hosted default preflight; dry-run only                                                   |

---

## 9. Shared ownership proposal (one owner each)

| Responsibility                  | Proposed single owner                                          |
| ------------------------------- | -------------------------------------------------------------- |
| Immutable plan construction     | `scripts/db/migration-plan.ts` (new)                           |
| Orchestration sequence          | `scripts/db/migrate-orchestrator.ts` (new)                     |
| Exact pending-set parse/compare | `migration-pending-set.ts` (existing)                          |
| Rollout compatibility           | `migration-deployment-compatibility.ts` (existing)             |
| Production auth                 | `owner-production-apply.ts` (existing)                         |
| Preview auth                    | `preview-write-auth.ts` (existing)                             |
| Release evidence                | `release-check.ts` (existing)                                  |
| Target classification           | `db-target-config.ts` / `db-guard.ts` (existing)               |
| Schema lifecycle labels         | `schema-lifecycle-state.ts` (existing)                         |
| Supabase CLI push execution     | new thin executor wrapping current `runCommand('supabase', …)` |
| Psql atomic execution           | `apply-migrations.ts` helpers (existing)                       |
| Env-specific policy             | `migrate-policy-{local,preview,production}.ts` (new; isolated) |
| Interactive/headless IO         | `migrate-cli-adapters.ts` (new)                                |
| Package aliases                 | `package.json` (SSOT)                                          |
| Human runbook                   | `docs/database-workflow.md`                                    |
| Agent contract                  | `.agent/rules/database.md`                                     |
| Command inventory               | `scripts/README.md`                                            |

---

## 10. Audit process notes (non-goals / hygiene)

- No database mutation on Disposable, Persistent Local, Preview, or Production.
- No source/config/migration/test/docs/package changes except this report.
- No Git staging or commit.
- Graphify used only as freshness lead check; all actionable claims corroborated via source
  reads/`rg`.
- Live pending migration counts: **UNVERIFIED**.

---

## 11. Acceptance checklist (Goal 1)

| Criterion                                                               | Status                         |
| ----------------------------------------------------------------------- | ------------------------------ |
| Every scoped command/internal mutation path mapped to code + tests      | Yes (Sections 1–2)             |
| Every known finding has disposition + Goal 2 AC                         | Yes (Sections 3, 8)            |
| Shared responsibilities have one proposed owner; env behavior isolated  | Yes (Sections 5, 9)            |
| Deletion candidates list callers + proof                                | Yes (Section 6)                |
| Security/TTY/non-TTY/failure/resume/concurrency/no-write in test matrix | Yes (Section 8.1)              |
| Report sufficient to start Goal 2 without rediscovery                   | Yes                            |
| No DB mutation / source change / staging / commit                       | Yes — only this report written |
