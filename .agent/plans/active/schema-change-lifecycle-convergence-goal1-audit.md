---
title: Converge Database Schema-Change Mechanisms — Goal 1 Audit
status: active
created: 2026-08-12
updated: 2026-08-12
type: diagnostic
autonomy: 0
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
  - .agent/rules/manual-sql-manifest.md
  - scripts/README.md
  - docs/domains/database/cheatsheets/schema-migrate.md
related_skills:
  - database-parity
  - production-sql-patches
  - supabase
supersedes:
  - output/reports/database-migration-unification-audit.md
---

# Goal 1 — Audit and Converge Database Schema Change Mechanisms

Read-only audit. No schema, migration-history, or authorization writes. MCP SQL was
`SELECT` / `list_migrations` / `list_projects` only.

Evidence language: **Fact** | **Supported inference** | **Unknown**.

Live evidence captured 2026-08-12 (UTC-7):

- `pnpm db:availability:verify -- --targets local,preview,production` → all `AVAILABLE_READ_ONLY`
- `pnpm db:local:audit` / `db:preview:audit` / `db:prod:audit` → all `CURRENT`, Errors: 0
- Hosted projects: Production `celebrame-db` (`ineitkdkyrxqyressllp`), Preview `celebra-me-preview` (`iwipdvisoyerfdytuhwi`)

Do not implement in this Goal. Goal 2 must implement only what this audit established.

**Note:** Public owner Production apply later converged to `pnpm prod:apply`. Treat
`db:migrate -- --target production --apply` as the schema primitive, not the owner-facing command.

---

## 1. Canonical mechanism verdict

**Remain:** `pnpm db:migrate -- --target <local|preview|production|disposable-test>` as the
single schema-change lifecycle.

This lifecycle is already implemented and is sufficient as the single supported mechanism.
It does **not** yet guarantee that every executable path is forced through it.

### Implemented lifecycle

```text
author   supabase/migrations/*.sql   via pnpm db:migrate:new
validate disposable proof (requireCurrentDisposableMigrationProof) +
         registry phase (hosted) + optional --expected pin
apply    migrate-orchestrator.ts → environment policy → executor
auth     Local: none
         Preview: authorizePreviewWriteApply (TTY YES or CELEBRA_TASK_SCOPE)
         Production: requireOwnerProductionApply (TTY, release-check, agent reject)
verify   schema_migrations membership + hosted mutation-contract
record   Production: critical backup pair + owner-apply record
         Disposable: disposable-migration-proof.json
         Hosted history: supabase_migrations.schema_migrations
```

| Target | Policy | Executor | Extra gates |
| --- | --- | --- | --- |
| disposable-test | `migrate-policy-disposable.ts` | `executePsqlAtomicDisposable` | identity only; writes proof |
| persistent-local | `migrate-policy-local.ts` | `executePsqlAtomicPending` | disposable proof; local identity |
| preview | `migrate-policy-preview.ts` | `executeSupabasePush` | disposable proof; clean HEAD; Preview auth; contract verify |
| production | `migrate-policy-production.ts` | `executeSupabasePush` | audit BEHIND-or-CURRENT; `--expected`; release-check; critical backup; owner TTY; contract verify; owner-apply record |

**Fact:** Environment-specific aliases `db:prod:migrate` / `db:preview:migrate` /
`db:local:migrate` and files `push-prod-migrations.ts` / `push-preview-migrations.ts` /
`apply-local-migrations.ts` are gone from `package.json` and the tree. Tests in
`tests/db/preview-perimeter.test.ts` assert the aliases are undefined. `--allowlist` and
`EXPECTED_MIGRATIONS` are rejected (`scripts/db/migrate-expected.ts`).

**Doc vs code gaps (non-blocking for the mechanism, blocking for cleanup):**

| Surface | Disagreement |
| --- | --- |
| `output/reports/database-migration-unification-audit.md` (2026-08-04) | Describes the three-runner control plane that Goal 2 already removed |
| `output/reports/database-migration-unification-final-audit.md` | Still recommends keeping the retired aliases |
| `docs/database-workflow.md` PIT block | Freezes “67 migrations” / `20260729152113` as a historical cutover; live head is `20260806120000` (75). Labeled PIT, but easy to misread as current |
| `docs/domains/database/overview.md` | Last updated 2026-07-25; omits later objects (`preview_approval_artifacts`, mutation receipts, managed identity) |
| `scripts/manual/production-patches/README.md` | Still says the agent never connects and describes a generated-publish workflow; current runner is owner-TTY `db:prod:patch` for specialized DML |
| `audit-db.ts` CURRENT verdict | Object fingerprint mismatch is allowed when Errors=0; CURRENT is not identity of schema |

The canonical **rule that should remain** after cleanup:

> All persistent schema changes are authored as versioned files under `supabase/migrations/`,
> validated on disposable-test, then applied with `pnpm db:migrate -- --target` in order
> Local → Preview → Production. Production apply stays owner-only. Data/content repairs stay
> on `invitation:release` or owner-only `db:prod:patch` (DML, never DDL). Dashboard/CLI
> observe; they never mutate schema.

---

## 2. Complete mutating-path inventory

Classification of every repository path capable of persistent schema mutation, or explicitly
ruled out.

### Keep — canonical schema lifecycle

| Location | Purpose | Executable | Targets | Class | Bypass? | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `package.json` `db:migrate` → `migrate-cli.ts` → `migrate-orchestrator.ts` | Single planner/orchestrator | Yes | all four | schema | No | **keep-canonical** |
| `migrate-policy-*.ts` | Isolated env policy | Yes, via orchestrator | per env | schema | No | **keep-canonical** |
| `migrate-executors.ts` `executeSupabasePush` | Hosted apply | Yes, via policy | preview, production | schema | Only if imported with a URL and spawn permit | **keep-canonical**; tighten caller surface |
| `migrate-executors.ts` `executePsqlAtomicPending` | Local apply | Yes, via policy | intended local | schema | **Yes for Preview** — rejects Production only | **fail-closed on preview** in Goal 2 |
| `migrate-executors.ts` `executePsqlAtomicDisposable` | Disposable apply | Yes, via policy | disposable-test | schema | No (`enforceDisposableTargetOnly`) | **keep-canonical** |
| `supabase/migrations/*.sql` (75 files, head `20260806120000`) | Versioned DDL SSOT | Applied only via migrate | all | schema | N/A | **keep-canonical** |
| `db:migrate:new` | Author file only | Yes | filesystem | none | N/A | **keep-canonical** |
| `db-guard.ts`, `production-boundary-policy.ts`, `owner-production-apply.ts`, `production-write-permit.ts` | Identity + owner gate | Yes | production (+ spawn) | none | N/A | **keep-canonical** |
| Cursor hooks `before-mcp-production.ts`, `before-shell-production.ts` | Agent Production write block | Yes | production / agent | none | N/A | **keep-canonical** |
| `db:push` → `blocked-db-push.mjs` | Block ambiguous push | Yes (exit 1) | unknown | none | N/A | **keep-canonical** |
| `db:*:audit`, `db:contract:verify`, `dbs` | Observe | Yes | all | none | N/A | **keep-canonical** (never a mutator) |

### Keep — specialized non-schema (must stay outside migrate)

| Location | Purpose | Executable | Targets | Class | Disposition |
| --- | --- | --- | --- | --- | --- |
| `db:prod:patch` → `run-prod-patch.ts` | Owner DML maintenance | Yes | production | data (DDL partially lint-blocked) | **keep-specialized-data**; tighten lint |
| `invitation:release` | Managed content | Yes | local/preview/production | data | **keep-specialized-data** |
| `db:preview:sync-invitations` | Prod→Preview content mirror | Yes | preview | data (TRUNCATE RSVP children) | **keep-specialized-data** |
| `db:local:restore-from-dump` | Debug restore; staging DDL | Yes | persistent-local | mixed (transient `restore_staging`) | **keep-specialized-data**; document exception |
| `db:local:bootstrap-admin` | Local admin bootstrap | Yes | persistent-local | data (`CREATE TEMP`) | **keep-specialized-data** |
| `db:disposable:reset` → `disposable-test-env.ts` | Recreate test DB (DROP schemas, auth/storage dumps, migrate-cli, seed) | Yes | disposable-test | mixed | **keep** as disposable infra, not a second schema SSOT |
| `supabase/test/auth-schema.sql`, `storage-schema.sql`, `seed-test-data.sql` | Disposable bootstrap | Yes, via reset | disposable-test | schema dumps + data | **keep** |
| pgTAP under `supabase/tests/` | Contract tests | Yes, disposable | disposable-test | mixed fixtures | **keep** |
| CI `test:db:rsvp-contracts` / `test:db:managed-contracts` | Disposable reset+test | Yes | disposable-test | mixed | **keep** |
| `sentinel-check.ts insert` | `CREATE TABLE IF NOT EXISTS public._db_sentinel` | Yes, no package alias | persistent-local | schema (local-only) | **keep as documented local exception**; never promote to hosted |

### Close / remove in Goal 2

| Location | Why it is still a problem | Disposition |
| --- | --- | --- |
| `apply-migrations.ts` CLI `main()` | Direct `tsx` path still applies SQL + INSERT history; uses raw `spawnSync('psql')` which bypasses `runCommand` production-write-permit. CLI is disposable-gated, but it is a second apply engine | **Delete CLI**; keep helpers (`getValidatedMigrationFiles`, `enforceDisposableTargetOnly`, `runPsqlCommand` after routing through `runCommand`) |
| `executePsqlAtomicPending` Preview hole | Rejects Production only. Policy currently classifies local first, but the executor is not fail-closed | **Reject preview + unknown** |
| `sql-safety.ts` `BLOCKED_PATTERNS` | Blocks `ALTER TABLE`, RLS, `SECURITY DEFINER`, `DROP TABLE/SCHEMA`, `TRUNCATE`, `CASCADE`. Does **not** block persistent `CREATE TABLE/INDEX/FUNCTION/VIEW/TYPE`, `GRANT`/`REVOKE`, `ALTER FUNCTION` | **Expand blocklist** so `db:prod:patch` cannot carry DDL |
| `compare-schemas.ts` | Orphan CLI; stale `ALLOWED_LOCAL_ADDITIONS` from when Local was ahead of Production. Not imported by migrate/audit. Test copies `normalizeDef` inline | **Delete** file; keep `audit-db.ts` as the object-audit SSOT |
| `scripts/manual/dev-patches/*.sql` | No runner | **Archive** (historical local DML) |
| `scripts/sql/*.sql` (3 files) | No runner; content repairs | **Archive** as historical DML |
| `output/reports/database-migration-unification*.md` | Describes retired aliases/runners as current | **Archive or delete** in Goal 3; not policy SSOT |

### Ruled out (not persistent schema mutators)

- `src/` API / dashboard / `CanonicalStatusPanel` — observe `schema_migrations`; no DDL.
- Provision content apply — fails closed on `SCHEMA_INCOMPATIBLE`; points at `db:migrate`.
- `scripts/dev/seed-invitation.mjs` — DML via Supabase client, local URL guard.
- `db:local:reset` / `db:local:refresh-from-prod*` — blocked rails.
- GitHub Actions — disposable tests only; no hosted migrate.
- Supabase MCP `apply_migration` / mutating `execute_sql` — blocked for agent Production by hooks; still a **human Dashboard / non-agent TTY** residual channel (same class as raw `supabase db push`). Do not build a new engine to replace hooks; keep documenting the residual.

---

## 3. Manual patch reconciliation matrix

No production patch file contains persistent DDL. `CREATE TEMP TABLE` in Ayrin patches is session-only.

| File | Class | Manifest | Canonical coverage | Live apply assumed? | Disposition |
| --- | --- | --- | --- | --- | --- |
| `20260812_p0_itinerary_gallery_structural_contracts.sql` | Data/content | Full | None (JSON variants) | **Unknown** — not schema | Keep as data-repair; not schema lifecycle |
| `20260812_thankyou_editorial_back_cover_structural_contracts.sql` | Data/content | Full | None (JSON variants) | **Unknown** | Same |
| Leah / Luna / Valentina / América prepare patches | Data/content | Full or partial | Event-type migrations exist; publish path superseded by `invitation:release` | Do not assume | **Superseded operationally**; keep as payload SSOT where tests/docs still read them |
| `20260620120001_xareni-iyarit-publish.sql` | Data/content | No | Publication RPCs | Do not assume | **Superseded** → `invitation:release` |
| Ayrin family (8 files) | Data/content | Mostly no | Icon migrations exist; location backfill is **not** in migrations (by test design) | Do not assume | **Historical/superseded**; do not promote to migrations |
| Xareni snapshot/owner/gift/hero | Data/content | Mixed | Table schema canonical | Do not assume | One-off data; archive or complete manifest if still runnable |
| Samantha guest share | Data/content | No | Column `first_shared_at` is canonical | Do not assume | Data-only one-off |
| `scripts/sql/repair-*cesar-ramses*` | Data/content | N/A | Content tables | Historical comments | **Archive** |
| `scripts/sql/repair-asset-slug.sql` | Unknown (SELECT) | N/A | N/A | N/A | Keep diagnostic |
| `scripts/db/sql/bootstrap-admin.sql` | Mixed (temp + auth DML) | N/A | Roles table canonical | Active local command | **Keep** local-only |
| `supabase/test/auth-schema.sql` / `storage-schema.sql` | Schema dumps | N/A | Internal Auth/Storage | Disposable reset | **Keep** disposable infra |

**No schema or mixed production patch requires a reconciliation migration derived from the patch file.**
The only uncanonicalized **structural** diffs found live are not represented by these patches
(see §4–5).

---

## 4. Schema convergence findings

### 4.1 Migration-history convergence — aligned

| Env | Applied | Head | Pending | Extra | `db:*:audit` lifecycle |
| --- | --- | --- | --- | --- | --- |
| Repo files | 75 | `20260806120000_preview_approval_artifacts` | — | — | — |
| persistent-local | 75 | `20260806120000` | [] | [] | CURRENT, Errors 0 |
| Preview | 75 | `20260806120000` | [] | [] | CURRENT, Errors 0 |
| Production | 75 | `20260806120000` | [] | [] | CURRENT, Errors 0 |
| `pnpm dbs` cache | same | same | [] | [] | `migration_history_parity` CURRENT |

`CURRENT` on `/dashboard/estado` and `pnpm dbs` is **history parity**, not object identity.

### 4.2 History metadata is not identical

Production `schema_migrations` rows for `20260610000000` … `20260715210600` (14 versions) have
`name IS NULL` and `statement_count = 0`. Preview has names and statement arrays for the same
versions. Production `20260601000001` (`invitations_domain`) has a name but `statement_count = 0`;
Preview has 29 statements. Preview `20260402000100` has 17 statements vs Production 16.

**Supported inference:** those Production rows are leftover from the removed one-time
`reconcile-prod-baseline` / version-only insert path, not from today’s `supabase db push`
executor (which writes `statements`). They prove **history-row provenance**, not missing DDL.

**Disposition:** do **not** replay those SQL files. Do **not** backfill `name`/`statements` unless
a later owner task explicitly wants metadata-only repair. Schema identity does not depend on it.

### 4.3 Actual schema convergence — not identical

Object fingerprints from `audit-db.ts` (includes grants/policies/indexes):

| Env | Fingerprint | vs disposable `6d87e2f3…` | vs Preview/Local `980ab14e…` |
| --- | --- | --- | --- |
| disposable-test | `6d87e2f3b8dffd338cfb3132c485ceb681be2b1bcea29bbffb0c6f9d107a743e` | — | different |
| persistent-local | `980ab14ea0f1c7db208d05c578b9d10fae8cddf868e12236aa4c92dfcdd90d2c` | different, Errors 0 | match Preview |
| Preview | `980ab14e…` (same as Local) | different, Errors 0 | — |
| Production | `1f1035cc2d805643483ef145696dccf79bf33a944ca7be9399a789e1c48c3302` | different, Errors 0 | **different** |

MCP structural hashes Preview vs Production:

| Kind | Match? |
| --- | --- |
| public base tables (32) | Yes |
| views (2) | Yes |
| routines (identity args) | Yes |
| columns (+ defaults) | Yes |
| RLS policy names/cmd | Yes |
| indexes | **No** |
| constraints | **No** |
| `_db_sentinel` on hosted | Absent both |

**Confirmed object diffs (Production vs Preview/Local):**

| Object | Production | Preview / Local (fingerprint-matched) | In `supabase/migrations/` today? |
| --- | --- | --- | --- |
| Index on `guest_invitations(phone)` | `idx_guest_invitations_phone_e164` | `idx_guest_invitations_phone` | Canonical name is `idx_guest_invitations_phone` in `20260215000300` |
| CHECK `guest_invitations_phone_country_code_pair_check` | **Present** (`phone`/`country_code` pair) | **Absent** | **No current migration** defines it. App still maps it in `src/lib/rsvp/repositories/supabase-errors.ts` |

`audit-db.ts` still reported CURRENT / Errors 0 because hosted comparison is largely one-way
(target extras vs disposable) and index **name** drift plus a Production-only CHECK are not
treated as blocking when disposable also lacks the CHECK.

Disposable vs persistent fingerprint mismatch with Errors 0 is expected today (grants / internal
objects / indexdef normalization). It is an **audit-tool gap**, not proof of extra public tables.

Postgres engine patch differs (Production `17.6.1.063`, Preview `17.6.1.147`). Not schema drift.

---

## 5. Uncanonicalized schema changes — disposition

| Change | Disposition | Goal 2 action |
| --- | --- | --- |
| `idx_guest_invitations_phone_e164` on Production | **Canonicalize** by idempotent rename/replace to `idx_guest_invitations_phone`. Same key; do not create a duplicate | Reconciliation migration: `DROP INDEX IF EXISTS idx_guest_invitations_phone_e164` after `CREATE INDEX IF NOT EXISTS idx_guest_invitations_phone` |
| `guest_invitations_phone_country_code_pair_check` on Production only | **Canonicalize** — app still depends on the name; Preview/Local/disposable are missing it | Reconciliation migration: `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS` with the Production `pg_get_constraintdef` text. Do not apply DROP on Production |
| 14 Production history rows with null name/statements | **Already canonical structurally**; metadata only | No migration. Optional later metadata repair is out of scope unless owner asks |
| Manual production patches | **Data-only** / superseded | Stay out of schema lifecycle |
| `_db_sentinel` | Local-only exception | Keep; continue excluding from hosted audits |
| Auth/storage dumps | Disposable infra | Keep |

Do not replay historical SQL. Design the reconciliation migration against **current** Production
(has e164 index + pair CHECK), Preview/Local (canonical index, no pair CHECK), and disposable
(rebuild from files).

---

## 6. Legacy / redundant code and documentation to remove

Confirmed delete/archive (Goal 2 unless noted Goal 3 docs):

| Item | Why |
| --- | --- |
| `scripts/db/apply-migrations.ts` CLI `main()` + argv auto-exec | Second apply engine; spawnSync bypass |
| `scripts/db/compare-schemas.ts` | Orphan, stale allowlist, duplicates `audit-db` poorly |
| `tests/unit/schema-normalization.test.ts` copy of `normalizeDef` | Retarget to `audit-db.ts` or drop if redundant |
| `tests/scripts/push-prod-migrations.test.ts` filename | Legacy name; file already tests `migrate-policy-production` helpers — rename |
| `output/reports/database-migration-unification-audit.md` and `-final-audit.md` | Obsolete inventory; Goal 3 archive |
| Non-manifest production patches used as templates | Rule already says historical-only; Goal 3 stop listing them as runnable |
| `scripts/manual/dev-patches/` and `scripts/sql/` repair files | No runner; archive |
| Duplicate `ensureSchemaMigrationsTable` apply loop vs `apply-migrations.ts` CLI body | Collapse CLI away; keep one helper |

Do **not** delete: orchestrator, four policies, executors, `sql-safety` (tighten), `run-prod-patch`,
disposable-test-env, sentinel-check, audit-db, owner-apply, hooks, blocked-db-push.

---

## 7. Operational gaps (cannot canonicalize blindly)

1. **Whether the 20260812 content patches were applied** — unknown; irrelevant to schema Goal 2.
2. **Whether Production pair CHECK was added by a deleted migration, dashboard SQL, or old patch** —
   unknown. Live Production definition is the source for the reconciliation SQL.
3. **Disposable vs persistent fingerprint delta** — not fully decomposed (grants vs indexdef vs
   policies). Goal 2 should make CURRENT-on-hosted fail or warn on **named public object** diffs
   (indexes, constraints, columns, tables, routines). Do not require byte-identical grant
   fingerprints across Supabase-managed roles without measuring first.
4. **Human non-agent channels** (Supabase SQL editor, raw `supabase db push` on a non-hooked TTY)
   remain residual. Hooks cover agent sessions. Do not invent a distributed lock.
5. **`execute_sql` MCP** is listed as a write tool in `production-boundary-policy.ts` but SELECT
   succeeded in this audit. Goal 2 should keep SELECT allowed and mutating SQL denied; do not
   broaden.

---

## 8. Target architecture

No new migration engine, persistence layer, or parallel SSOT.

```text
Schema
  supabase/migrations/*
    → disposable proof / db:disposable:reset+test
    → pnpm db:migrate -- --target local --apply
    → pnpm db:migrate -- --target preview --apply
    → pnpm db:migrate -- --target production --apply   (OWNER/HITL)
    → schema_migrations + object_audit (bidirectional named objects)

Data / content
  invitation:release          (managed invitation)
  db:prod:patch               (owner DML only; lint forbids DDL)
  db:preview:sync-invitations (content mirror; not schema)

Observe
  pnpm dbs / dashboard/estado / db:*:audit / db:contract:verify
```

Deviation justified by evidence: disposable reset still performs extra Auth/Storage DDL dumps
because those catalogs are not in `supabase/migrations/`. That stays test infra, not a second
product schema path. Sentinel table stays local-only.

---

## Goal 2 — minimal implementation plan

Ordered by dependency and risk. No Production write in Goal 2 until the reconciliation
migration is ready and the owner explicitly authorizes `db:migrate -- --target production`.

1. **Fail-closed remaining schema apply surfaces** (no hosted mutation)
   - Delete `apply-migrations.ts` CLI; tests must call `db:migrate -- --target disposable-test` or
     exported helpers.
   - `executePsqlAtomicPending` / `runPsqlCommand`: reject production, preview, and unknown;
     route psql through `runCommand`.
   - Expand `sql-safety` to reject persistent DDL/GRANT in patches; add tests.
   - Verify `tests/db/production-mutation-boundary.test.ts` still covers spawn/MCP.

2. **Make object audit detect the class of drift found here**
   - When history is CURRENT, compare named public indexes/constraints/routines **both ways**
     against disposable (not only target extras).
   - Index-name drift and missing/extra CHECKs must be Errors, not silent fingerprint mismatch.
   - Keep excluding `_db_sentinel` / pgTAP tables.

3. **Author one idempotent reconciliation migration** against live state
   - Ensure `idx_guest_invitations_phone` exists; drop `idx_guest_invitations_phone_e164` if present.
   - `ADD CONSTRAINT IF NOT EXISTS guest_invitations_phone_country_code_pair_check` using the
     Production definition (pair of phone/country_code nullness).
   - Register rollout phase in `supabase/migration-rollout-registry.json`.
   - Prove on disposable (`db:disposable:reset` / migrate proof), then Local, then Preview, then
     Production via canonical migrate only.

4. **Delete dead schema-tooling** listed in §6 (code first). Do not delete invitation payload
   patches that tests still import until Goal 3 confirms consumers.

5. **Docs / rules (may land in Goal 3 if Goal 2 is migration-heavy)**
   - Single canonical rule in `.agent/rules/database.md` + cheatsheet + `scripts/README.md`.
   - Point unification reports to this plan as superseded.
   - Refresh `docs/domains/database/overview.md` entity list.
   - Align `production-patches/README.md` with owner-only DML, not a parallel publish system.

### Goal 2 acceptance

- No second executable schema apply CLI remains.
- `db:prod:patch` cannot lint-pass DDL.
- Live named-object diffs above are represented by a versioned migration and gone after promote,
  or explicitly accepted with a recorded reason (none accepted in this audit).
- `db:local:audit` / `db:preview:audit` / `db:prod:audit` still pass, and CURRENT no longer hides
  index/constraint name drift of this class.
- Dashboard/CLI still cannot mutate schema.

### Stop conditions

- Any Production/Preview write requested without explicit current-task authorization.
- Reconciliation SQL that is not idempotent against all three persistent states.
- Proposal of a new migration framework.

---

## Final verdict

**Future schema changes cannot yet be guaranteed to use one canonical path**, even though that
path already exists and is the correct one to keep.

Guarantee fails today because: (1) `apply-migrations.ts` CLI remains a second apply engine;
(2) `db:prod:patch` lint does not block all DDL; (3) `executePsqlAtomicPending` is not Preview
fail-closed; (4) `audit-db` CURRENT conceals the Production index/constraint drift found live;
(5) non-agent human channels (SQL editor / raw CLI) remain residual by design.

After Goal 2 closes (1)–(4) and promotes the reconciliation migration, **repository-owned
tooling can guarantee one lifecycle**. Residual human Dashboard/raw-CLI risk stays documented,
not re-architected.
