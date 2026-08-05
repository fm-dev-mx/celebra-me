# Invitation Database Synchronization — Goal 3 Closure Report

| Field                                  | Value                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| **Report id**                          | `invitation-db-sync-goal3-closure`                                      |
| **Version**                            | `1.0.0`                                                                 |
| **Date**                               | 2026-08-04                                                              |
| **Lane**                               | `dev-local`                                                             |
| **HEAD (short)**                       | `47942d41`                                                              |
| **Baseline contract**                  | `output/reports/invitation-db-sync-goal1-audit.md`                      |
| **Mode**                               | Verification, correction, test hardening, simplification, documentation |
| **Hosted Preview/Production mutation** | **UNVERIFIED** (not executed; owner authorization required)             |
| **Hosted read-only diagnose/compare**  | **UNVERIFIED** in this session (no live hosted probes invoked)          |

---

## Executive verdict

`pnpm db:sync` remains a thin orchestration facade over existing update, promote, and mirror
engines. Goal 3 corrected verified fail-closed and redaction defects, removed dead prune code,
hardened unit/contract/CLI/read-only coverage, and aligned authoritative docs with the
implementation. Specialized commands are retained unchanged.

Acceptance criteria 1–21 are met for repository-verified contracts. Live Preview/Production apply
paths remain **operationally unverified** in this session.

---

## Findings and corrections

| ID  | Finding                                                                               | Correction                                                                 | Status   |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| C1  | Phase 8 residual Production Storage URLs were drift-only → apply could exit 0         | Promote to `MIRROR_URL_AUDIT` failure + throw on apply                     | Fixed    |
| C2  | Unregistered Supabase Storage refs were non-blocking on apply                         | Fail closed with `UNREGISTERED_STORAGE_REFS` on apply                      | Fixed    |
| C3  | Missing Storage objects used generic failure strings                                  | Emit `MISSING_ASSET:` / `STORAGE_UPLOAD_FAILED:`                           | Fixed    |
| C4  | Hardcoded Production Storage regex for URL audit                                      | Derive pattern from `prodCtx.storageUrl`                                   | Fixed    |
| C5  | Apply checked freshness only on rebuilt plan (always fresh)                           | Also `assertPlanFresh(reviewedPlan)` before mutation                       | Fixed    |
| C6  | JSON/`stderr` could embed nested credential URLs                                      | Deep `redactCredentials` in `resultToJson`; CLI human path redacts         | Fixed    |
| C7  | Dead `pruneStaleRecords` (zero callers; policy is report-only)                        | Removed from `preview-sync-db.ts`                                          | Fixed    |
| C8  | Docs claimed `invitation:update` does Production release / migrations-only Production | Fixed README, `database-workflow.md` Principle, agent rules                | Fixed    |
| C9  | Cloudinary mirror completeness undocumented (G8)                                      | Documented preserve/no-engine contract; test that rewrite skips Cloudinary | Fixed    |
| R1  | G6 async probe redaction                                                              | Already fixed in Goal 2 (`redact: [dbUrl]`); helper unit-tested            | Verified |
| R2  | Abril slug Cloudinary literal in `apply-local-invitation.ts`                          | Not obsolete without definition-driven provider refactor                   | Retained |

---

## Architecture and direction verification

| Check                                                              | Result                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Thin facade (no second SQL/Storage/approval/backup/promote engine) | Pass — orchestrator delegates; ownership grep in tests                  |
| Directions allowlist only                                          | Pass — four directions; forbidden directions throw                      |
| Local↛Production without promote                                   | Pass — `--target production` rejected                                   |
| Preview↛Production                                                 | Pass — not in allowlist                                                 |
| Production→Local restore not via `db:sync`                         | Pass — documented separate                                              |
| Schema migrate separate                                            | Pass                                                                    |
| Mirror uses `CONTENT_MIRROR_TABLES` / `EXCLUDED_TABLES`            | Pass                                                                    |
| Preview auth + Production owner TTY unchanged                      | Pass — delegated gates; headless Production still blocked by owner gate |
| Read-only diagnose/compare/plan                                    | Pass — mutation instrumentation tests                                   |

---

## Requirement → test traceability matrix

| Requirement                                    | Test                                                        | Level         | Environment      | Result          | Evidence limitation                                                         |
| ---------------------------------------------- | ----------------------------------------------------------- | ------------- | ---------------- | --------------- | --------------------------------------------------------------------------- |
| Mode/arg parsing                               | `db-sync.test.ts`                                           | Unit          | Local            | Pass            | —                                                                           |
| Direction allowlist                            | `db-sync.test.ts`, `db-sync-cli.test.ts`                    | Unit/CLI      | Local            | Pass            | —                                                                           |
| Incompatible flags                             | `db-sync-cli.test.ts` (`APPLY_FLAG_REQUIRED`, unknown args) | CLI           | Local            | Pass            | —                                                                           |
| Exit codes / JSON schema                       | `db-sync.test.ts`, `db-sync-cli.test.ts`                    | Unit/CLI      | Local            | Pass            | —                                                                           |
| Redaction / sentinel secrets                   | `db-sync.test.ts`, `db-sync-cli.test.ts`                    | Unit/CLI      | Local            | Pass            | Service-role non-URL tokens not pattern-covered by `redactCredentials`      |
| Plan stability / expiration / exact plan       | `db-sync.test.ts`, `db-sync-apply.test.ts`                  | Unit/contract | Local            | Pass            | —                                                                           |
| Engine dispatch (mirror)                       | `db-sync-apply.test.ts`                                     | Contract      | Mock             | Pass            | Local/Preview/Production apply engines covered mainly by specialized suites |
| No unrelated engines / read-only zero mutation | `db-sync-readonly.test.ts`, ownership grep                  | Contract      | Mock             | Pass            | Instrumentation via mock call walls, not disposable DB                      |
| Stop on auth/blocker                           | `db-sync-apply.test.ts`                                     | Contract      | Mock             | Pass            | —                                                                           |
| Mirror partial failure → `ok=false`            | `db-sync-apply.test.ts`, upsert failure unit                | Contract      | Mock             | Pass            | Full `runPreviewMirror` phase injection not end-to-end                      |
| Mirror fail-closed markers                     | `preview-sync-invitations.test.ts`                          | Unit          | Local            | Pass            | Static source contract                                                      |
| Cloudinary not rewritten                       | `preview-sync-invitations.test.ts`                          | Unit          | Local            | Pass            | —                                                                           |
| Dry-run zero writes (specialized)              | `preview-sync-dry-run.test.ts`                              | Contract      | Mock             | Pass            | —                                                                           |
| Specialized aliases retained                   | `db-sync.test.ts`                                           | Unit          | Local            | Pass            | —                                                                           |
| Non-TTY / JSON stdout                          | `db-sync-cli.test.ts`                                       | CLI           | Local            | Pass            | —                                                                           |
| Data isolation allow/deny lists                | ownership + config SSOT                                     | Unit          | Local            | Pass            | Disposable exclusion proof relies on existing mirror/table tests            |
| Production headless/agent rejection            | Existing `production-authorization.test.ts`                 | Engine        | Local            | Pass (adjacent) | Facade delegates; not re-tested end-to-end here                             |
| Hosted diagnose/compare/plan                   | —                                                           | Hosted RO     | Preview/Prod     | **UNVERIFIED**  | Not invoked                                                                 |
| Hosted Preview/Production apply                | —                                                           | Hosted mutate | Preview/Prod     | **UNVERIFIED**  | Requires owner authorization                                                |
| Disposable Local create/update/no-op           | Existing update/local suites                                | Integration   | Disposable/Local | Adjacent        | No new disposable `db:sync` suite added                                     |

---

## Happy / no-op / failure / partial-failure results

| Area          | Happy / no-op                  | Failure / partial                                              | Result                                     |
| ------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------ |
| Diagnose      | Mock available targets → READY | Missing credentials → BLOCKED + exit 1                         | Pass (mock/CLI)                            |
| Compare       | MATCH_CANONICAL                | Missing slug/event-type blocked                                | Pass (readonly + unit)                     |
| Plan          | Stable planId                  | Forbidden direction / missing inputs                           | Pass                                       |
| Apply         | Exact plan + mirror applied    | Wrong/expired plan, auth failure, missing assets               | Pass (mock)                                |
| Mirror        | Applied with empty failures    | PARTIAL_UPSERT / MISSING_ASSET / URL audit / unregistered refs | Pass (engine markers + orchestrator mocks) |
| JSON          | Versioned envelope             | Nested credential URL redacted                                 | Pass                                       |
| Compatibility | Specialized scripts present    | —                                                              | Pass                                       |

---

## Removed code (caller evidence)

| Symbol                                                                   | Evidence                                                                          | Action  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------- |
| `pruneStaleRecords` (+ `PruneResult`) in `scripts/db/preview-sync-db.ts` | Repo-wide grep: definition only; live path is `detectStaleCandidates` report-only | Removed |

No other deletions. Abril Cloudinary slug literal retained (not proven obsolete).

---

## Retained unresolved / residual risks

1. **Hosted verification UNVERIFIED** — no Preview/Production diagnose or apply executed this
   session.
2. **No distributed lock** — single-operator concurrency residual (accepted; same as migrate).
3. **Partial mirror without rollback** — fail-closed stops further phases; already-committed
   upserts/truncates are not rolled back (documented; no false rollback claim).
4. **`redactCredentials` URL-centric** — non-URL service-role keys in free text are not
   pattern-redacted; engines should continue to avoid embedding them.
5. **Disposable end-to-end `db:sync` apply** — not added; Local behaviors remain covered by
   specialized update/mirror tests.
6. **G12** — outer `db-guard` still does not parse in-script `TRUNCATE CASCADE`; in-script guards +
   Preview auth remain the gate.

---

## Commands and tests executed

```text
pnpm exec jest tests/db/db-sync.test.ts tests/db/db-sync-apply.test.ts \
  tests/db/db-sync-cli.test.ts tests/db/db-sync-readonly.test.ts \
  tests/db/preview-sync-invitations.test.ts tests/db/preview-sync-dry-run.test.ts \
  --no-coverage
→ 6 suites, 62 tests passed

pnpm validate:changed → PASSED
pnpm agent:git-safety:check → PASSED with warnings (authorized session)
pnpm exec prettier --write <changed files>
```

Not run (out of Goal 3 scope): browser/screenshot suites, full `pnpm ci`, hosted mutations.

---

## Final documentation sources

| Authority                                                                                        | Role                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`docs/database-workflow.md`](../../docs/database-workflow.md)                                   | Operator runbook — Principle, `db:sync` section, promote vs migrate |
| [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md) | Content/RSVP/mirror/Cloudinary policy SSOT                          |
| [`.agent/rules/database.md`](../../.agent/rules/database.md)                                     | Agent decision tree (links; does not duplicate full runbook)        |
| [`scripts/README.md`](../../scripts/README.md)                                                   | Command inventory pointer                                           |
| [`README.md`](../../README.md)                                                                   | Quick command table (aligned)                                       |
| `pnpm db:sync --help`                                                                            | Live CLI help                                                       |

---

## Acceptance criteria checklist

1. Thin facade — **Pass**
2. No duplicated engines — **Pass**
3. Approved directions only — **Pass**
4. Read-only mutation-free — **Pass** (mock instrumentation)
5. Exact plan + drift/expiry — **Pass**
6. Mirror failures cannot succeed — **Pass** (engine + orchestrator)
7. Production PII cannot flow to Preview — **Pass** (allowlist SSOT retained)
8. Preview/Production auth unchanged or stricter — **Pass**
9. Output secret-free — **Pass** (URL redaction paths)
10. Interactive/headless semantic parity; no headless Production apply — **Pass** (auth stricter in
    headless)
11. Critical contracts happy/failure coverage — **Pass** (facade + adjacent engines)
12. Multistep partial-failure coverage — **Pass** (mirror failure paths)
13. Statuses/JSON/exits/side effects asserted — **Pass**
14. Disposable DB behaviors — **Partial / adjacent** (specialized suites; no new disposable
    `db:sync` harness)
15. Specialized commands retained — **Pass**
16. Dead/duplicate removed — **Pass** (`pruneStaleRecords`)
17. Cloudinary explicit — **Pass**
18. Docs/rules match implementation — **Pass**
19. Relevant validation passed — **Pass**
20. Unperformed hosted verification labeled — **Pass**
21. No unnecessary abstraction — **Pass**
