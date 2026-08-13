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
pnpm invitation:content-parity -- --slug <slug> --event-type <type>
pnpm invitation:cross-db-reconcile
pnpm invitation:inventory-audit
pnpm invitation:diagnose-identity -- --slug <slug>
pnpm db:local:audit | db:preview:audit | db:prod:audit
```

`pnpm dbs` is the canonical operator matrix: **schema migrations**, **registry publication**,
**operation readiness**, and **Production authorization evidence** as separate columns.
It also shows the active manual-patch catalog. Patch rows are read-only detectors: `PENDING` means
the detector found rows inside the approved range, `NOT_NEEDED` means it found zero rows (not
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

**Expected result:** Typed availability and lifecycle/parity evidence. `UNVERIFIED` ≠ healthy.

**Failures:** `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`, incomplete evidence under
`--strict`.

**Recovery:** Fix credentials/identity; never invent zero-row health. Schema behind → migrate
workflow. Content drift → update/reconcile — not audit alone.

See taxonomy in [README](./README.md).
