---
title: Forensic Audit of Production Migration Paths — Goal 1
status: final
created: 2026-08-12
updated: 2026-08-12
type: diagnostic
autonomy: 0
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
  - supabase/migration-rollout-registry.json
related_skills:
  - database-parity
  - production-sql-patches
---

# Goal 1 — Forensic Audit of Unauthorized Production Migration Paths

Read-only forensic audit. No migrations applied, reverted, or marked. No Production,
Preview, Local, schema, migration-history, configuration, or authorization-artifact
writes. MCP SQL used in this audit was `SELECT` / `list_migrations` / `list_projects`
only.

Classifications: `AUTHORIZED` | `UNAUTHORIZED` | `UNVERIFIED`.

Evidence language in this report:

- **Fact** — observed in Git, live Production history, or durable backup manifests.
- **Supported inference** — follows from facts plus the current/historical orchestrator
  contract (gate-before-write).
- **Unknown** — named missing evidence; does not block classification when an independent
  durable fingerprint already attributes the path.

Schema parity is not treated as authorization evidence.

## Verdict

The three Production versions were applied through the canonical owner Production
migrate workflow (`supabase db push --db-url <prod> --yes` after
`requireOwnerProductionApply`). They were **not** applied by an agent self-authorizing
a bypass.

| Migration | Classification | Apply window (UTC) | Worktree | Path |
| --- | --- | --- | --- | --- |
| `20260804170000` | **AUTHORIZED** | 2026-08-05 00:34:55Z → 00:36:34Z | Integration (`celebra-me`) | Canonical Production migrate |
| `20260805143000` | **AUTHORIZED** | 2026-08-06 13:56:09Z → 14:11:48Z | `dev-local` | Canonical Production migrate |
| `20260806120000` | **AUTHORIZED** | 2026-08-06 21:14:39Z → 21:18:24Z | Integration (`celebra-me`) | Canonical Production migrate |

The owner-only invariant was **not violated for these three applies**. It is **currently
bypassable** by channels that never enter `requireOwnerProductionApply`.

---

## 1. Exact timeline

### 1.1 `20260804170000_retire_legacy_adoption_rpc`

```text
20260804170000
→ introduced: 2026-08-04 09:29:05-07:00  commit 0d6bab43
   "chore(provision): retire legacy production adoption tooling and RPC"
→ registry contract entry: 2026-08-04 13:38:16-07:00  commit 2d0566a9
   phase=contract, requiresDeployedAppCapabilities=[legacy_adoption_rpc_retired_client]
→ available to Local/Preview/Production migrate: same day, once present on the
   operator worktree HEAD (commit is on develop, main, and all lane worktrees)
→ Production apply: 2026-08-05 00:34:55Z (72 versions, head 20260802090000)
                    → 2026-08-05 00:36:34Z (73 versions, head 20260804170000)
→ execution path: canonical Production migrate → supabase db push --yes
→ actor/process/worktree: human owner TTY in Integration worktree (celebra-me),
   then still using `pnpm db:prod:migrate` (thin wrapper over migrate-cli)
→ authorization evidence: critical-backup pair 72→73 in 99s from that worktree;
   TTY confirmation string not persisted; purpose/planId fields not yet on
   manifests (those fields appear on later Aug 6 migrate backups)
→ guards expected: --apply, Production identity, owner TTY, release-check,
   contract capability gate, critical pre/post backup
→ Production state: AUTHORIZED
```

**Facts**

- File introduced in `0d6bab43`. Live Production `schema_migrations` has
  `name=retire_legacy_adoption_rpc`, `statement_count=4` (matches `BEGIN` / `DROP
  FUNCTION` / `COMMENT` / `COMMIT` split used by `supabase db push`).
- `public.adopt_managed_invitation_legacy_atomic` is absent (DROP took effect).
- Integration-worktree critical backups:
  - `critical-2026-08-05T00-34-55-822Z` — 72 versions, head `20260802090000`
  - `critical-2026-08-05T00-36-34-948Z` — 73 versions, includes `20260804170000`
- Two earlier same-session backups still at 72 (`00-03-23`, `00-12-07`) match
  retry-before-write behavior.
- Daily backup `2026-08-06T02:24:22Z` still shows 73 including this version
  (apply stuck).
- Historical `production_authorization_receipts` row (`operation_type=
  production_migration`, consumed 2026-08-04 04:09:01Z) is **not** this
  migration: it predates the file and pairs with the 71→72 apply of
  `20260802090000`.

**Supported inferences**

- Lowest write was `supabase db push` (statement array populated; the disposable
  `apply-migrations.ts` INSERT path does not write `statements`).
- The 99-second 72→73 pair is the migrate `beforeWrite` → `execute` → `afterWrite`
  fingerprint. Raw `supabase db push` and MCP `apply_migration` do not create
  critical backup sets.
- `requireOwnerProductionApply` ran and succeeded: `execute()` is unreachable
  without it in `migrate-orchestrator.ts`.

**Unknowns (do not change classification)**

- Typed confirmation code for this apply is not in any durable log.
- Manifests from this window lack `purpose` / `planId` / `pendingVersions`
  (feature not yet written onto backup manifests).
- No durable record of `CELEBRA_DEPLOYED_APP_SHA` /
  `CELEBRA_DEPLOYED_APP_CAPABILITIES` at apply time. Canonical path would have
  failed closed on contract without them; success implies the then-current
  compatibility gate allowed the apply.

### 1.2 `20260805143000_managed_invitation_identity_and_archive_cascade`

```text
20260805143000
→ introduced: 2026-08-05 16:56:56-07:00  commit 2a8dc353
   "feat(db): add managed invitation identity and archive cascade"
→ available to hosted migrate: after that commit on the operator HEAD
→ Production apply: 2026-08-06 13:56:09Z migrate-pre (73, pending=[20260805143000])
                    → 2026-08-06 14:11:48Z migrate-post (74, applied)
→ execution path: pnpm db:migrate -- --target production --apply
   → productionMigratePolicy.execute → supabase db push --yes
→ actor/process/worktree: human owner TTY in dev-local
   planId 6d66b6bb2f53a1b5946262fa96a793395aea2204c2b0c20bda4cb50ae66c6324
→ authorization evidence: matching migrate-pre/post manifests with pendingVersions
   and planId. Prior evening (2026-08-05 21:19-07:00) the owner attempted the
   same pending set from Integration via `pnpm db:prod:migrate`; TTY confirmation
   failed with OWNER_CONFIRMATION_MISMATCH (Windows CR-after-inquirer bug).
   That failed attempt recorded "No changes were made to Production".
→ guards expected: --apply, identity, agent rejection, TTY, release-check,
   disposable proof, critical backup, compatibility (phase=expand)
→ Production state: AUTHORIZED
```

**Facts**

- Live history: `name=managed_invitation_identity_and_archive_cascade`,
  `statement_count=37`.
- Columns exist on `public.invitations.managed_identity_id` and
  `public.managed_invitation_release_provenance.{managed_identity_id,previous_slugs}`.
- `dev-local` backups:
  - purpose `migrate-pre`, pending `20260805143000`, count 73, already includes
    `20260804170000`
  - purpose `migrate-post`, same `planId`, count 74, includes `20260805143000`
- Owner transcript (Integration, 2026-08-05 21:19-07:00) shows pending set
  exactly `20260805143000`, owner selected Aplicar, typed `MIGRATE da9a0bea`,
  gate rejected, no Production write.

**Supported inferences**

- Successful apply the next morning from `dev-local` is the same owner workflow
  after the confirmation-reader fix, not an agent bypass.
- Agents in that conversation were diagnosing the TTY bug, not executing the
  write.

### 1.3 `20260806120000_preview_approval_artifacts`

```text
20260806120000
→ introduced: 2026-08-06 11:04:38-07:00  commit b7e1d7a5
   "feat(provision): migrate preview release approvals to shared database store"
→ SQL fix (non-immutable generated column): 2026-08-06 13:52:04-07:00  af47cd7d
→ registry expand entry: 2026-08-06 12:51:59-07:00  commit 63a9c875
→ Production apply: 2026-08-06 21:14:39Z migrate-pre (74, pending=[20260806120000])
                    → 2026-08-06 21:18:24Z migrate-post (75, applied)
   planId eaa002fa6c68dd478e169f12de04544b073d7a14ccfab05cf02846b89b9c5848
→ earlier aborted pre: 2026-08-06 20:42:06Z migrate-pre, different planId
   82bc15de…, still 74 (no write)
→ execution path: canonical Production migrate → supabase db push --yes
→ actor/process/worktree: human owner TTY in Integration (celebra-me)
→ authorization evidence: matching migrate-pre/post + pendingVersions + planId
→ Production state: AUTHORIZED
```

**Facts**

- Live history: `name=preview_approval_artifacts`, `statement_count=9` (matches
  CREATE TABLE / comments / indexes / RLS / REVOKE / GRANT split).
- `public.preview_approval_artifacts` exists.
- Integration backups as above. `dev-extra` `critical-2026-08-06T23-11-57` is
  `purpose=promote-pre` at count 75 (content promote after schema apply — not a
  schema mutator).
- `dev-local` `critical-2026-08-07T23-46-28` is `purpose=standalone` at count 75
  (later draft-canonicalize backup, not this migrate).

**Supported inference**

- Apply used the post-fix SQL (`af47cd7d` is 20:52Z; successful pre is 21:14Z).
  Same version cannot be re-applied; the 20:42Z pre with a different planId is a
  failed/aborted attempt before the successful pair.

### 1.4 When each could have reached Production

Production migrate reads `supabase/migrations/` from the operator worktree
filesystem and requires the version to exist in clean `HEAD`. Earliest
Production-eligible moment is the introducing commit on that worktree's HEAD,
not merge-to-`main` alone. All three commits are ancestors of current
`dev-local` HEAD and are on `develop` / `main`.

CI (`.github/workflows/commit-validation.yml`) is read-only policy/application
validation. It does not run `db:migrate` or `supabase db push`.

---

## 2. Production mutation-path inventory

Traced to the lowest executable write boundary. `db-guard` is **not** a process
interceptor; it only runs when a wrapper invokes it.

### 2.1 Canonical schema migrate (used for all three)

```text
pnpm db:migrate -- --target production --apply
  → scripts/db/migrate-cli.ts
    → orchestrateMigrate (migrate-orchestrator.ts)
      → productionMigratePolicy
        resolveContext: getProdDbUrl + assertProductionDbUrl + guardProduction('migrate')
        prepareApply:    release-check evidence for clean HEAD
        buildPlan:       disposable proof, prod audit, supabase db push --dry-run,
                         hosted compatibility (registry)
        beforeWrite:     critical backup purpose=migrate-pre   [local files + prod read]
        authorize:       requireOwnerProductionApply
                         (--apply, CELEBRA_AGENT_CONTEXT reject, exact Production
                          project ref, release-check, TTY Cancel-default menu,
                          typed `MIGRATE <8-hex>`)
        execute:         runCommand('supabase', ['db', 'push', '--db-url', url, '--yes'])
                         ★ LOWEST SCHEMA WRITE BOUNDARY
        afterWrite:      verify schema_migrations + mutation contract + migrate-post backup
```

Historical alias `pnpm db:prod:migrate` → `push-prod-migrations.ts` was already a
thin forwarder to `migrate-cli` before deletion (`714a319` 2026-08-06 05:28-07:00).
`04170000` used that alias; `05143000` / `06120000` used `migrate-cli` directly.

`guardProduction(..., 'migrate')` **allows** the operation by design and defers
to the owner gate.

### 2.2 Other repository Production mutators (gated)

All discovered `requireOwnerProductionApply` callers (test registry
`APPROVED_MUTATORS`):

| Entry | Lowest write | Schema migrate? |
| --- | --- | --- |
| `migrate-policy-production.ts` | `supabase db push --yes` | Yes |
| `run-prod-patch.ts` | `runPsql(fullSql)` | Manual SQL, not versioned migrate |
| `invitation-promotion-orchestrator.ts` | managed content apply | No |
| `romina-draft-reset-cli.ts` | draft reset | No |
| `draft-canonicalization-cli.ts` | draft canonicalize | No |
| `draft-restore-cli.ts` | draft restore SQL | No |

These cannot record `schema_migrations` versions for the three files.

### 2.3 Blocked or disposable-only

| Path | Write boundary | Production reachable? |
| --- | --- | --- |
| `pnpm db:push` | none (`blocked-db-push.mjs` exits 1) | No |
| `apply-migrations.ts` CLI | `psql` atomic SQL + INSERT history | No — `enforceDisposableTargetOnly` |
| `executePsqlAtomicDisposable` | same | No — disposable check |
| `executePsqlAtomicPending` | `psql` atomic SQL, **no** disposable check | Only via local policy today. Direct import with a Production URL would write. Not used by Production policy. |
| CI workflows | none | No |

### 2.4 Ungated channels (reachable now)

| Path | Write boundary | Owner gate? |
| --- | --- | --- |
| `supabase db push --db-url <PROD> --yes` | Supabase CLI DDL + history | **No** |
| `supabase db push --linked` | linked project DDL | **No** (policy forbids; not technically blocked) |
| `supabase migration up --db-url <PROD>` | CLI DDL + history | **No** |
| `psql` / `runPsql` with Production URL | arbitrary SQL | **No** |
| Supabase MCP `apply_migration` | Management API DDL + history | **No** |
| Supabase MCP `execute_sql` | arbitrary SQL including DDL | **No** |
| Supabase Dashboard SQL editor | arbitrary SQL | **No** (out of repo) |

This audit invoked MCP `execute_sql` with read-only `SELECT` against Production
and received rows. The same tool accepts non-SELECT SQL. That proves the channel
is live in this agent environment.

`pnpm db:push` being blocked does **not** block invoking the `supabase` binary
directly.

---

## 3. Authorization evidence per migration

Owner TTY confirmation is **not persisted**. Current policy states
`production_authorization_receipts` is historical inert state. Durable evidence
is therefore critical-backup manifests produced by `beforeWrite` / `afterWrite`.

| Migration | Receipts | migrate-pre/post | planId match | TTY log | Classification |
| --- | --- | --- | --- | --- | --- |
| `20260804170000` | No (inert; unrelated prior row) | Pair 72→73 in 99s; purpose fields not yet on manifest | No (field absent) | Not persisted | AUTHORIZED |
| `20260805143000` | No | Yes, pending pin exact | Yes `6d66b6bb…` | Failed attempt logged; success not logged | AUTHORIZED |
| `20260806120000` | No | Yes, pending pin exact | Yes `eaa002fa…` | Not persisted | AUTHORIZED |

Failed owner attempts for `20260805143000` (Integration, 2026-08-05 evening)
are evidence the gate **held** until a later successful owner apply.

---

## 4. Bypass investigation (historical reachability)

| Candidate | Reachable at incident? | Used for these three? |
| --- | --- | --- |
| Canonical migrate after owner TTY | Yes | **Yes** (all three) |
| Raw `supabase db push` | Yes, if Production URL in env | **No** — would not emit migrate-pre/post pairs with `pendingVersions` |
| MCP `apply_migration` / `execute_sql` | Likely (MCP exists now; historical install unknown) | **No** — no backup fingerprint; statement counts match CLI file split |
| `apply-migrations.ts` / psql atomic | Script exists; CLI blocked for non-disposable | **No** — history `statements` would be empty/null |
| Preview misclassified as Production | Preview ref is distinct in `SUPABASE_PROJECT_REFS` | **No** — backup `projectRef` is the Production project |
| Agent inheriting Production credentials + self-auth | Credentials exist in operator env; `CELEBRA_AGENT_CONTEXT` is opt-in | **No evidence of use**. Agent rejection only fires when that env var is set. Canonical path still needs TTY + code. |
| Recording a version without SQL | Possible via INSERT | **No** — objects exist; `statements` populated |
| CI / Vercel | No migrate job | **No** |

Root cause of the original suspicion (Production already at head `20260806120000`
without an obvious receipt): **authorization receipts are inert**, and TTY
success is not logged. The applies were real owner-workflow events whose durable
trace lives only in gitignored critical backups, split across worktrees.

Ranked root-cause candidates for “how did these get onto Production?”:

1. **Proven:** owner-authorized canonical migrate (all three).
2. **Rejected:** agent MCP/CLI bypass (no matching fingerprint).
3. **Rejected:** history-only insert (schema objects present).

---

## 5. Current owner-only enforcement (independent of history)

Static analysis of current `HEAD` (this worktree). No `--apply` was executed
(that path creates backups before the owner gate).

**Canonical `pnpm db:migrate -- --target production --apply` still enforces:**

- explicit `--apply`
- exact Production project ref
- `CELEBRA_AGENT_CONTEXT` rejection **if set**
- interactive TTY (Cancel default) + bound `MIGRATE <8-hex>`
- release-check evidence
- disposable proof + hosted compatibility
- critical pre/post backups

**An agent today can still reach Production schema mutation without owner/HITL
if it uses an ungated channel:**

1. **Supabase MCP `apply_migration` / `execute_sql`** targeting the Production
   project id — confirmed callable in this session (read used; write not used).
2. **Raw `supabase db push --db-url $PROD_DB_URL --yes`** — no wrapper, no
   `db-guard`, no TTY.
3. **`psql` against Production** with resolved credentials.
4. **Unset `CELEBRA_AGENT_CONTEXT`:** the canonical path’s agent rejection is a
   no-op. The TTY + code still apply, but only on that path.

`readConfirmationLine` auto-proceeds past the intent menu when injected. The
production CLI does not pass it; tests do. Not a live operator bypass unless a
caller wires the seam.

---

## 6. Severity and blast radius

### Historical applies (these three)

- **Severity:** Low as an authorization incident. The owner-only path was
  exercised, not bypassed.
- **Blast radius:** Limited to intended schema:
  - `20260804170000` — DROP of retired legacy adoption RPC (contract / irreversible
    function drop).
  - `20260805143000` — expand: identity columns, triggers, archive cascade.
  - `20260806120000` — expand: `preview_approval_artifacts` table.
- Live Production history is 75/75, head `20260806120000`, no extra/reorder
  (independent live read 2026-08-12 via MCP `list_migrations`, consistent with
  the same-day schema probe).

### Current ungated channels

- **Severity:** High. Any authenticated agent or shell with MCP or Production
  credentials can apply DDL without `--apply`, TTY, release-check, or backups.
- **Blast radius:** Full Production schema and data reachable by those tools.
  This audit did not exercise writes.

---

## 7. Corrective recommendations (not implemented)

Separated from findings. Minimum Goal 2 scope:

1. **Close MCP Production writes.** Prevent `apply_migration` and non-SELECT
   `execute_sql` against the Production project from agent sessions, or require
   the same owner boundary before those tools can target Production.
2. **Close raw CLI Production writes.** Make `supabase db push` / `migration up`
   / ad-hoc `psql` against the Production URL fail closed unless they entered
   through `pnpm db:migrate -- --target production --apply` (or an equivalent
   owner-gated wrapper). `pnpm db:push` being blocked is insufficient.
3. **Make agent context default-on** in agent/non-interactive sessions so
   `agentSelfAuthorizationBlocked` is not opt-in.
4. **Persist a durable owner-apply record** (operation, versions, planId, HEAD,
   worktree identity, timestamp) at the owner gate. Receipts are currently inert;
   forensics had to reconstruct from gitignored backups across worktrees.
5. Do **not** revert or re-apply these three versions. Production state matches
   the authorized SQL.

Out of scope for Goal 2 unless the owner expands it: Preview MCP/CLI hardening,
Dashboard SQL editor (platform control), distributed migrate lock.

---

## 8. Audit constraints — compliance

| Constraint | Status |
| --- | --- |
| No Production / Preview / Local schema or history writes | Met |
| No migrate apply / revert / mark | Met |
| No authorization artifacts created or consumed | Met |
| No write-capable Production commands as tests | Met (`--apply` not run; MCP SQL was SELECT only) |
| Credentials / URLs redacted in this report | Met |

Read-only evidence sources: Git history, `schema_migrations` SELECT,
`list_migrations`, `list_projects`, critical-backup manifests in Integration /
`dev-local` / `dev-extra`, owner-gate source, package.json, CI workflow, prior
owner TTY transcript for the failed `20260805143000` attempt.

Postgres log search (24h windows) was not required after backup attribution and
was not run.

---

## Handoff (Goal 2)

### Current state

Goal 1 complete. Three Production versions classified **AUTHORIZED**. Current
owner-only invariant holds on the canonical CLI and is **not** enforced on MCP
or raw Supabase/psql channels.

### Completed work

Forensic reconstruction of introduction, apply windows, worktrees, write
boundary, and authorization fingerprints for the three migrations. Full
Production schema-mutation path inventory to lowest write.

### Evidence

This file. Live Production history head `20260806120000` (75 versions). Backup
manifests cited above (gitignored; do not commit).

### Validation passed

Read-only live history + object existence checks; Git introduction commits;
orchestrator gate-before-write static trace.

### Validation failed

None.

### Validation intentionally not run

- `pnpm db:migrate -- --target production --apply` (would create backups before
  the owner gate).
- MCP `apply_migration` / non-SELECT `execute_sql` (write-capable).
- Postgres log harvest.

### Unresolved uncertainty

- Typed TTY codes for the three successful applies (not persisted).
- `CELEBRA_DEPLOYED_APP_*` values at `20260804170000` apply time.
- Whether MCP was installed in August 2026 (irrelevant to these applies).

### Residual risks

Ungated MCP and raw CLI Production DDL remain reachable from agent sessions.

### Applicable authorization

Read-only forensic audit only. No exception to Git, database, or Production
write rules.

### Branch / commit reference

Worktree `dev-local`. Report written against then-current HEAD (status-dashboard
consolidation commit present in the lane). No Git mutation by this goal.

### Next responsibility

Goal 2 implemented the §7 minimum (MCP/raw-CLI lockdown, agent fail-closed context, durable
owner-apply records, status authorization integrity). Goal 3 is cleanup + final verification only.
