---
title: Audit Production Promotion and Owner-Only Apply Mechanisms — Goal 1
status: superseded
created: 2026-08-12
updated: 2026-08-12
type: diagnostic
autonomy: 0
related_docs:
  - docs/database-workflow.md
  - docs/env-workflow.md
  - docs/domains/intake/production-flow.md
  - .agent/rules/database.md
  - .agent/rules/invitation-production.md
  - scripts/README.md
related_skills:
  - database-parity
  - production-sql-patches
  - supabase
related_plans:
  - .agent/plans/archived/production-owner-apply-convergence-goal2-report.md
  - .agent/plans/active/schema-change-lifecycle-convergence-goal1-audit.md
---

# Goal 1 — Audit Production Promotion and Owner-Only Apply Mechanisms

**Superseded.** Pre-implementation evidence only. Owner apply is `pnpm prod:apply`; see
`.agent/plans/archived/production-owner-apply-convergence-goal2-report.md`.

Read-only audit. No Production, Preview, or persistent-local mutation. No Git mutation.

Evidence language: **Fact** | **Supported inference** | **Unknown**.

Do not implement the unified owner command in this Goal. Goal 2 must implement only what this
audit established.

---

## 1. Current Production mutation map

### 1.1 Maintained owner-facing Production writers

All six are discovered by `tests/provision/production-authorization.test.ts` (`APPROVED_MUTATORS`).
Each calls `requireOwnerProductionApply` before the first write.

| Path | Domain | Agent/non-interactive | Credentials | TTY/HITL | Preflight | Preview prerequisite | Backup | Verification | Receipt/evidence | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pnpm db:migrate -- --target production --apply` → `migrate-policy-production.ts` | Schema (`supabase/migrations` via `supabase db push`) | Rejected if `CELEBRA_AGENT_CONTEXT`; non-TTY fails `TTY_REQUIRED` | `PROD_DB_URL` from env or `.env.production.local` | `--apply` + Cancel-default menu + `MIGRATE <8-hex>` | Disposable proof, object audit `readyForMigrate`, dry-run pending set, compatibility registry, `release-check` | Not a content gate; hosted compatibility uses clean `HEAD` | Critical pre + post (RPO 15m, reuse allowed) | `schema_migrations` + `db:contract:verify` | `.backups/prod/owner-apply/` | Stop; re-run preflight (no cached resume) |
| `pnpm invitation:release -- --slug <s> --targets production --apply` → `invitation-promotion-orchestrator.ts` | Managed published content + optional Storage | Same owner gate; `CELEBRA_TASK_SCOPE` is explicitly rejected | `PROD_DB_URL` + Production Storage service role for asset scopes | `--apply` + `PROMOTE <8-hex>` (wizard adds Cancel-default before orchestrator) | `runPromotionPreflight`: Preview approval, placeholders, import-engine dry-run, schema `CURRENT` | Exact live Preview approval artifact | Proportional: critical only when recovery risk is `critical` | Post-apply schema gate + engine re-read / fingerprint | `invitation_mutation_operation_receipts` (`applied` / `partial` / `replayed`) | Engine records `partial`; next run reconstructs from live + receipt |
| `pnpm db:prod:patch -- --apply` → `run-prod-patch.ts` | Specialized DML (manifest SQL) | Same owner gate | `PROD_DB_URL` + `SUPABASE_URL` same project + `--owner-user-id` | `--apply` + `PATCH <8-hex>` | Lint + required manifest; **`--dry-run` does not connect** | None | Operator-owned (`@requires-backup: true` is a flag, not a capture) | `db:contract:verify` after SQL | None beyond console | SQL `ON_ERROR_STOP`; contract fail after successful SQL is a split-brain |
| `pnpm invitation:draft-canonicalize -- --target production --apply` | Draft document only (not published) | Same owner gate | Production DB URL | `CANONICALIZE` (verb in gate) + backup manifest | Dry-run plan; `evaluatePromotionBackupGate` | None | Required `--backup-manifest` | Post-apply draft verification | Domain plan fingerprint | Single-transaction apply in service |
| `pnpm invitation:draft-restore -- --target production --apply` | Draft restore from published | Same owner gate | Production DB URL | `RESTORE <8-hex>` + backup manifest | Dry-run plan | None | Required `--backup-manifest` | Post-apply draft verification | Fingerprint `after` | Single-transaction apply |
| `pnpm invitation:romina-draft-reset -- --apply` | One-off draft reset for `romina-rios-chaparro` | Same owner gate | Production DB URL | `RESET` + backup | Idempotent `isRominaDraftResetApplied` | None | Backup gate | Outcome verify | Operation fingerprint | Skip if already applied |

**Fact:** `db-guard.guardProduction` allowlists operations `migrate` and `patch`. Invitation
promote, draft repair, and Romina **do not** go through `db-guard`; they rely on the owner gate +
`runPsql` spawn permit.

### 1.2 Read / export paths that touch Production credentials (not writers)

| Path | Class | Notes |
| --- | --- | --- |
| `pnpm dbs`, `invitation:release --status`, `--targets production --dry-run`, `invitation:content-parity`, `invitation:cross-db-reconcile` | Safe observational | Policy allows agents |
| `pnpm db:prod:audit`, `db:prod:backup*`, `db:prod:export-auth`, `db:prod:export-storage` | Privileged read | Policy owner-only; **no TTY gate** — credential presence is enough |
| `pnpm db:preview:sync-invitations` | Preview writer; Production reader | Content mirror, not promotion |
| `pnpm db:contract:verify --target production` | Read-only contract | Used post-apply |

### 1.3 Explicitly blocked or Production-rejected

| Path | Disposition today |
| --- | --- |
| `pnpm db:push`, raw `supabase db push` / `migration up` / `db reset` | Blocked (package script / spawn guard / agent hook) |
| `apply-migrations.ts` / `executePsqlAtomicPending` | Code-level reject Production |
| `invitation:reconcile` | Production and `--targets all` rejected |
| `invitation:purge-by-id` | `INVITATION_ID_PURGE_PRODUCTION_REJECTED` |
| `invitation:release --targets local,preview` execute path | Throws `PRODUCTION_PROMOTION_REQUIRED` if Production slips in |
| `--rekey-from` on Production | Import engine rejects |
| `CELEBRA_TASK_SCOPE` on Production promote | Orchestrator throws `CONFIRMATION_REQUIRED` |
| Supabase MCP `apply_migration`, mutating `execute_sql`, branch/project tools | Agent hook deny (`failClosed: true`) |

### 1.4 Out-of-repository residual writers

| Surface | Control |
| --- | --- |
| Supabase Dashboard SQL editor | None in this repository |
| Direct `psql` / `node` outside Cursor hooks and outside `runCommand` | Spawn guard only if using `db-workflow-lib.runCommand`; otherwise policy-only |
| Runtime app writes (RSVP, dashboard, intake) | Auth/RLS; out of operational DB scope per `.agent/rules/database.md` |
| CI (`.github/workflows/commit-validation.yml`) | `contents: read`; **no** `PROD_DB_URL` |

### 1.5 Duplicate / weakly protected flags

- **Six owner apply CLIs** for one Production destination (**Fact**).
- Canonical `--apply` commands are **allowed** by `evaluateShellProductionMutation` (`CANONICAL_OWNER_WORKFLOW`). Agent shells can invoke them; protection is in-process, not hook-deny (**Fact**).
- `beforeShellExecution` matcher is `supabase\|psql\|PROD_DB_URL\|<prod-ref>`. `pnpm invitation:release -- --targets production --apply` often **does not match**, so the hook never runs (**Fact**).
- `sessionStart` / `preToolUse` have `failClosed: false` (**Fact**).
- `wrapShellCommandWithAgentContext` skips wrapping when the command already assigns `CELEBRA_AGENT_CONTEXT`, including `=false` (**Fact**). `isExplicitAgentContext` treats `false`/`0` as non-agent (**Fact**).
- Wizard `productionReady` is Preview-approval-only (`invitation-release-destination.ts`) (**Fact**).

---

## 2. Agent-boundary verdict

**Agents cannot complete a Production write through intended repository channels today, but the
guarantee is not “under any circumstance.”**

| Layer | What it actually does | Bypass |
| --- | --- | --- |
| **Policy** | Rules + actor matrix: agents never Production `--apply` | Convention |
| **Credential isolation** | **Absent.** `getProdDbUrl()` reads env or `.env.production.local` in any process, including agent sessions on the owner machine | Agent inherits owner secrets |
| **Code-level target rejection** | Strong for raw `supabase`/`psql` without permit; `apply-migrations` / `executePsqlAtomicPending` refuse Production; MCP mutating tools denied | JS/SQL via owner-gated `runPsql` after permit |
| **Runtime/TTY** | `requireOwnerProductionApply`: `--apply`, exact project ref, reject agent context, `release-check`, TTY, bound code, then in-process permit (30 min, same pid) | Test seams `selectIntent` / `readConfirmationLine`; `CELEBRA_AGENT_CONTEXT=false` + TTY if Shell is a TTY |
| **Agent hooks** | MCP writes fail-closed; raw CLI fail-closed when matcher hits; Shell wrapping is best-effort | Matcher miss; `failClosed: false` on context injection; canonical `--apply` allowed |

**Supported inference:** A non-TTY agent Shell cannot pass `TTY_REQUIRED`. That is the practical
stop for Cursor agents. It is not credential isolation and not hook-deny of owner workflows.

**Minimum controls to make mutation owner-only by construction** (no new architecture):

1. Agent `beforeShellExecution`: **deny** canonical Production commands that include `--apply`
   (preflight/dry-run remain allowed).
2. Always force `CELEBRA_AGENT_CONTEXT=1` on agent Shell; do not honor `=false` as “already set.”
3. Keep TTY + bound confirmation as the owner-terminal positive gate (already exists).
4. Do not add a token/env confirmation alternative.
5. Credential isolation is optional hardening, not required for the write invariant if (1)+(2)+TTY
   hold. Privileged reads remain credential-gated only.

CI/automation: **Fact** — no Production credentials in GitHub Actions. Non-interactive owner apply
is impossible without test seams.

---

## 3. Canonical domain mechanisms (keep)

### Schema

Authoritative chain:

```text
supabase/migrations/*
  → disposable proof (requireCurrentDisposableMigrationProof)
  → pnpm db:migrate -- --target production          # preflightMigrate
  → prepareApply (release-check)
  → beforeWrite (critical backup)
  → rebuild plan + drift check
  → requireOwnerProductionApply
  → executeSupabasePush (permit required)
  → verifyVersionsInHistory + owner-apply record + db:contract:verify
  → post backup
```

Pending discovery: `executeSupabaseDryRun`. Preview is a separate migrate target, not a content
prerequisite. Invitation workflows must not auto-migrate (`SCHEMA_INCOMPATIBLE` → owner
`db:migrate`).

### Invitation publication

Authoritative chain (one slug):

```text
managed definition → package
  → Preview apply + live verify + exact approval artifact
  → invitation:release --targets production --dry-run   # runPromotionPreflight
  → orchestrateInvitationPromotion
       (preflight → release-check → proportional backup → volatile revalidation
        → requireOwnerProductionApply → runPromotionApply → verifyPromotionOutcome)
```

Multiple invitations: **no apply-all primitive**. Discovery exists
(`discoverInvitationPromotionCandidates`) but each Production apply is one slug. The TTY wizard
selects **one** invitation, then a destination.

### Data / content repairs that remain legitimate

| Mechanism | Keep in unified `--all-ready`? | Reason |
| --- | --- | --- |
| `db:prod:patch` | **No** — explicit `--patch <file>` only, or remain independent | Specialized DML; lint-only dry-run; operator backup |
| `invitation:draft-canonicalize` / `draft-restore` | **No** — independent owner tools | Draft-only; not publication; already owner-gated |
| `invitation:romina-draft-reset` | **No** — delete after verified/abandoned | Documented one-off |
| Historical `scripts/manual/production-patches/*.sql` | Not a runner | Data-only under sql-safety; apply only via `db:prod:patch` |
| `invitation:reconcile` | Never Production | Local/Preview only |

Do not assume every historical patch belongs in the unified flow.

---

## 4. Production-ready contract

A future plan item may enter an owner apply plan only from **domain preflight**, not from wizard
labels or candidate `disposition: 'ready'`.

### Schema

| Label | Evidence |
| --- | --- |
| **READY** | Audit `readyForMigrate` (BEHIND, 0 unexplained errors), disposable proof current, dry-run pending set non-empty, `--expected` match if pinned, hosted compatibility pass, `release-check` for apply |
| **BLOCKED** | `SCHEMA_DRIFT`, audit errors, expected-pin mismatch, compatibility fail, missing disposable proof |
| **IN_SYNC / ALREADY_APPLIED** | Dry-run pending empty (history CURRENT vs repo) |
| **UNKNOWN** | Credentials/unreachable; `UNVERIFIED` lifecycle |
| **NOT_APPLICABLE** | Plan scope omitted `--schema` |

**Gap (Fact from prior schema audit, still binding):** object identity can drift while history is
CURRENT. Promotion schema gate uses **migration-history `CURRENT` only**. Do not treat `pnpm dbs`
history parity as object identity.

### Invitation

| Label | Evidence |
| --- | --- |
| **READY (PROMOTABLE)** | Exact Preview approval; Production credentials; schema `CURRENT`; no published placeholders; import-engine dry-run `PROMOTABLE`; not `IN_SYNC`; backup acceptable when required |
| **BLOCKED** | `MISSING_PREVIEW_APPROVAL`, `SCHEMA_INCOMPATIBLE`, `PRODUCTION_PLAN_BLOCKED`, `MANAGED_DIVERGENCE`, placeholders, `BACKUP_REQUIRED` when recovery risk is critical |
| **IN_SYNC** | Production already matches approved package hash |
| **UNKNOWN** | `UNVERIFIED` / `CREDENTIALS_REQUIRED` / `UNREACHABLE` production status |
| **NOT_APPLICABLE** | Slug not selected |

**False READY today (Fact):**

- `resolveDestinationReadiness.productionReady` = Preview approval only (no schema, no engine dry-run).
- Candidate `ready` = approval + Production `NOT_PRESENT`/`BEHIND_CANONICAL` (no schema gate).

Both are UX hints. Apply still runs real preflight. A unified planner **must not** copy these
labels into the apply plan.

### Patch / draft repair

| Label | Evidence |
| --- | --- |
| **READY** | Manifest lint pass + owner-chosen file; draft plans with writes>0 and backup manifest valid |
| **UNKNOWN** | Patch `--dry-run` never executes `dry-run-query` (**Fact** — field required, unused) |
| **ALREADY_APPLIED** | Romina `isRominaDraftResetApplied`; draft `alreadyCanonical` / `sectionUnchanged` |

---

## 5. Dependency / order model

No generic DAG. Confirmed domain boundary:

```text
read-only mixed plan
  → (if schema READY) schema apply + history/contract verify
  → (if any invitation selected) require schema CURRENT else BLOCK entire invitation slice
  → invitations in explicit slug order, stop on first failure
  → optional explicit data ops (patch/draft) only if listed; never implied by --all-ready
  → final verification = union of domain verifiers already run
```

| Relationship | Evidence |
| --- | --- |
| Invitation depends on schema CURRENT | `evaluatePromotionSchemaGate`; promote never migrates |
| Data patch vs schema | sql-safety blocks DDL; patches must not be used to repair schema |
| Independent | Draft canonicalize/restore (published untouched); observational commands |
| Block entire plan | `UNKNOWN` or `BLOCKED` items in the **selected** scope; do not skip them |
| Skip without inconsistency | `IN_SYNC` / empty pending schema / already-applied one-off |

`--all-ready` must omit BLOCKED/UNKNOWN rather than apply a subset silently **only if** the plan
prints them as excluded with reasons. Prefer fail-closed: `--all-ready` refuses if any discovered
candidate is UNKNOWN.

---

## 6. Scope model

| Intent | Recommended flags | Today |
| --- | --- | --- |
| Schema only | `--schema` | `db:migrate -- --target production` (applies **all** pending versions; `--expected` pin optional) |
| One invitation | `--slug <slug>` | `invitation:release -- --slug … --targets production` |
| Explicit set | `--slugs a,b,c` | **Missing** — N sequential owner commands |
| All ready | `--all-ready` (never implied) | **Missing** — candidate discovery is read-only |
| Mixed | `--schema --slugs …` or `--all-ready` | **Missing** |
| Specialized patch | `--patch <file>` (never in `--all-ready`) | `db:prod:patch` |
| No args | TTY: plan + Cancel default. Non-TTY: refuse | `db:migrate` TTY selects target then **preflight only** for Production; `invitation:release` TTY wizard is one-slug |

**Invariant:** omitting arguments must not mean apply everything.

Schema-with-pending-prereq invitations: include schema first or refuse the invitation slice with
`SCHEMA_INCOMPATIBLE`. Do not auto-expand `--slug` into `--schema` without printing it as a
prerequisite in the plan and requiring it in the same explicit invocation (or a prior successful
schema apply visible as IN_SYNC).

---

## 7. Safety model for the future command

Reuse:

- `requireOwnerProductionApply` (one confirmation for the **whole plan**, `bindingHex` = hash of
  planId + package hashes + patch fingerprint).
- In-process write permit.
- Domain backups as each domain already classifies them (do not add a second backup prompt).
- `release-check` once per apply (schema `prepareApply` + promote `ensureRelease` already share
  the same evidence helper).
- Stop-on-first-failure; reconstruct remaining work from live domain preflights.

Add:

- Explicit Production-only CLI (no Preview/Local in the same apply).
- Agent-hook deny of `--apply` (section 2).
- `alreadyAuthorized` / injected `requireOwnerApply` no-op **after** outer gate issued the permit,
  so domain orchestrators do not prompt N times. They already accept `requireOwnerApply` injection
  on promote; schema policy does not — **Goal 2 seam**.
- Reject UNKNOWN/BLOCKED in selected scope.

Do not add: extra YES prompts, tokens, distributed locks, or a second evidence store.

---

## 8. Partial-failure and retry

| Domain | Atomic unit | Retry | Duplicate prevention | Stop subsequent? |
| --- | --- | --- | --- | --- |
| Schema | Per migration file inside `supabase db push` (not one transaction across all files) | Re-run preflight; pending set shrinks | History versions | Yes — orchestrator does not continue after `execute` throw |
| Invitation | `publish_invitation_atomic` for published content; Storage uploads/prunes are **outside** that RPC | Receipt `partial` + plan preconditions; `replayed` on zero-drift | `invitation_mutation_operation_receipts` + package hash | Yes for a mixed plan |
| Patch | Single `psql` script with `ON_ERROR_STOP` | Manual; no receipt ledger | None | N/A (one file) |
| Draft repair | Service transaction | Re-run dry-run; already-canonical skips | Plan fingerprints | N/A |

**Target:** next invocation rebuilds the plan from live canonical preflights. No hidden flags or
hand-edited state files. No distributed transaction across schema + invitations.

---

## 9. Architecture / dependency boundaries

Preferred direction already matches the code:

```text
migrate-orchestrator + productionMigratePolicy     (schema)
invitation-promote + invitation-promotion-orchestrator + import-engine
draft-* / run-prod-patch                           (explicit only)
        → NEW thin production plan + apply CLI
        → operator UX + one requireOwnerProductionApply
```

Do **not** duplicate: pending-set discovery, promotion classification, fingerprints, env
resolution (`getProdDbUrl`), authorization, SQL execution, receipts, verification.

`migrate-cli.ts` is already an adapter. `invitation-release-cli.ts` is a large Local/Preview/wizard
surface — the Production slice should keep calling `orchestrateInvitationPromotion`, not a second
classifier.

Server-only: keep `scripts/db/*` and provision mutators out of `src/` client islands (**already
true**).

---

## 10. Legacy / redundant path dispositions

| Mechanism | Disposition |
| --- | --- |
| `preflightMigrate` / `orchestrateMigrate` / `productionMigratePolicy` | **Keep as canonical domain primitive**; **reuse behind** future owner orchestrator |
| `runPromotionPreflight` / `orchestrateInvitationPromotion` / `runImportEngine` | **Keep as canonical domain primitive**; **reuse behind** orchestrator |
| `requireOwnerProductionApply` + write permit + boundary policy + Cursor hooks | **Keep**; tighten agent `--apply` deny |
| `pnpm db:migrate -- --target production --apply` | After unified CLI: **reuse as domain entry** or thin wrapper; do not keep a second owner-facing story |
| `pnpm invitation:release -- --targets production --apply` | Same; Local/Preview/wizard **stay** on `invitation:release` |
| `pnpm db:prod:patch` | **Keep specialized**; not in `--all-ready` |
| Draft canonicalize/restore | **Keep as independent owner tools** |
| `invitation:romina-draft-reset` | **Delete** when verified/abandoned (already the rule) |
| `invitation:reconcile`, purge, preview-fixture, preview sync | **Restrict to Local/Preview** (already) |
| `db:push`, refresh-from-prod, `db:local:reset` | **Keep blocked** |
| `apply-migrations.ts` Production | **Keep code-level reject** |
| `compare-schemas.ts` | **Delete as redundant** (schema-change Goal 1) |
| `production_authorization_receipts` | **Historical inert** — do not revive |
| Dashboard SQL | **Unresolved / out of repo** |
| Dual confirmation (wizard + owner gate) on Production promote | **Keep one owner gate**; wizard Cancel-default may remain as destination choice, not a second bound code |

---

## 11. Operational gaps (block a safe unified entry until addressed)

1. No mixed-domain plan object or owner CLI — only sequential human commands.
2. Domain apply functions each prompt `requireOwnerProductionApply` — need a permit-aware seam.
3. False READY labels in wizard/candidates if copied into a planner.
4. Patch dry-run is lint-only; cannot honestly put unexecuted SQL in a READY plan without running
   `dry-run-query` or keeping patches out of `--all-ready` (prefer the latter).
5. Agent `--apply` still reachable in Shell; context wrap is bypassable with `=false`.
6. Schema object drift vs history CURRENT can mark invitations PROMOTABLE while objects differ
   (pre-existing; do not paper over with a new classifier — surface `db:prod:audit` as
   BLOCKED/UNKNOWN if object errors exist).
7. `db:prod:patch` post-apply contract failure after successful SQL has no automatic rollback.

---

## 12. Minimal implementation plan (Goal 2+)

Ordered by dependency and risk. No new migration engine, publication classifier, workflow
framework, or evidence store.

1. **Harden agent channel (small, safety):** deny Production `--apply` in agent shell policy;
   force `CELEBRA_AGENT_CONTEXT=1`; regression tests next to `production-mutation-boundary.test.ts`.
2. **Read-only Production plan assembler:** compose `preflightMigrate` + per-slug
   `runPromotionPreflight` (and optional candidate discovery for `--all-ready` listing only).
   Print READY / BLOCKED / IN_SYNC / UNKNOWN. No writes.
3. **Authorization seam:** after one outer `requireOwnerProductionApply`, inject no-op/permit-assert
   into promote; add the same optional skip to `productionMigratePolicy.authorize` when a valid
   permit already matches `plan.planId` binding.
4. **Owner CLI** (`pnpm prod:apply` or equivalent package alias): explicit `--schema` /
   `--slug` / `--slugs` / `--all-ready` / `--patch`; default plan-only; `--apply` mutates in the
   order of section 5; stop on first failure; reprint remaining plan from live preflight.
5. **Retarget docs/rules:** one owner Production apply story; `invitation:release` remains
   Local/Preview/approve; `db:migrate -- --target production` remains the schema primitive called
   by the orchestrator.
6. **Do not fold** Romina, draft repair, or patches into `--all-ready`.
7. **Correct READY copy** in wizard/candidates so they cannot be mistaken for apply eligibility
   (label as “Preview approved” not “Production-ready”) — docs/UX only unless the assembler is
   the SSOT.

Validation: existing mutator-discovery test still matches; new tests that the assembler does not
reimplement promotion/schema classifiers; no Production `--apply` in this Goal; Goal 2 apply only
with explicit owner TTY authorization.

---

## 13. Final verdict

**The current primitives are sufficient to build one thin owner-only Production command without
new architecture.**

Agents prepare and verify through Preview (and read-only Production surfaces). The owner uses one
explicit Production entry point that plans from canonical domain preflights, authorizes once,
applies in schema-then-content order, and verifies by delegating to existing mechanisms.

What is missing is composition + agent `--apply` deny + a single confirmation seam — not a second
control plane.
