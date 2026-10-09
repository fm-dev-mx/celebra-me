# Cheat sheet — Status & diagnostics

**Purpose:** Read-only evidence of managed invitations and schema readiness.  
**User:** Human operators and agents.  
**Prerequisites:** Credentials for claimed targets; run availability verify before integrity claims.

## Commands

```bash
pnpm db:availability:verify -- --targets local,preview,production
pnpm dbs
pnpm dbs --verbose
pnpm dbs --diagnostics
pnpm dbs --in-sync
pnpm dbs --json
pnpm dbs --compact
pnpm dbs <slug>
pnpm invitation:content-parity -- --slug <slug> --event-type <type> --envs local,preview,production
pnpm invitation:cross-db-reconcile
pnpm invitation:inventory-audit
pnpm invitation:diagnose-identity -- --target <local|preview|disposable-test>  # never Production
pnpm db:local:audit | db:preview:audit | db:prod:audit
```

`pnpm dbs` is the canonical operator matrix: **schema migrations**, **registry publication**,
**operation readiness**, and **Production authorization evidence** as separate columns. It also
shows the active manual-patch catalog. Patch rows are read-only detectors: `PENDING` means the
detector found rows inside the approved range, `NOT_NEEDED` means it found zero rows (not
"applied"), and `NOT_APPLICABLE` means the environment is outside the patch target. The detailed
section includes the owner planning command for `PENDING`; applying still requires the owner TTY
workflow and `--apply`. Historical SQL files outside the catalog are intentionally excluded.
Disposable-test proof is listed apart from persistent schema. `--compact` is connectivity + schema
only — not publication state. `CURRENT`/`BEHIND` on that matrix are **migration-history** states.
Named public object drift is `pnpm db:*:audit` (`object_audit_readiness`).

Local dashboard: `/dashboard/estado` (explicit remote refresh; same classifiers as `pnpm dbs`).
Advanced diagnostics are enrichment only (`?diagnostics=1` / `pnpm dbs --diagnostics`), except
missing Production owner-apply evidence, which is a first-class integrity finding (`MISSING`) and
must not be presented as unqualified `CURRENT`.

## Action first

The dashboard shows one prioritized queue: confirmed blockers, applicable actions, pending
verifications, and manual review. Each step shows its command, prerequisite, and whether it needs
the owner; commands are only copied, never executed from the UI. The revalidation scope block
(Entorno, Dominio, Diagnóstico avanzado) bounds the next probe and does not filter evidence already
shown. Migrations and patches are separate domains: `pnpm prod:apply -- --schema` is the schema flow
and `pnpm prod:apply -- --patch <file>` is the manual patch flow.

`Todo en orden` requires LIVE evidence on every applicable control, a valid disposable-test proof,
no pending promotion/migration/patch, and intact applicable authorization. `NOT_APPLICABLE` does not
block; `NOT_NEEDED` means zero detector rows and does not prove a patch was applied. Cached, stale,
or unverified evidence keeps the state out of green. History and diagnostics sections stay collapsed
so the first action is visible.

**Expected result:** Typed availability and lifecycle/parity evidence. `UNVERIFIED` ≠ healthy.

**Failures:** `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`,
`READ_ONLY_ENFORCEMENT_FAILED`.

**Recovery:** Fix credentials/identity; never invent zero-row health. Schema behind → migrate
workflow. Content drift → update/reconcile — not audit alone.

See taxonomy in [README](./README.md).
