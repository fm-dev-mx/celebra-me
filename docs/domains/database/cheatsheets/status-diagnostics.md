# Cheat sheet — Status & diagnostics

**Purpose:** Read-only evidence of managed invitations and schema readiness.  
**User:** Human operators and agents.  
**Prerequisites:** Credentials for claimed targets; run availability verify before integrity claims.

## Commands

```bash
pnpm db:availability:verify -- --targets local,preview,production
pnpm dbs
pnpm dbs --compact
pnpm dbs <slug>
pnpm invitation:content-parity -- --slug <slug> --event-type <type>
pnpm invitation:cross-db-reconcile
pnpm invitation:inventory-audit
pnpm invitation:diagnose-identity -- --slug <slug>
pnpm db:local:audit | db:preview:audit | db:prod:audit
```

**Expected result:** Typed availability and lifecycle/parity evidence. `UNVERIFIED` ≠ healthy.

**Failures:** `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`, incomplete evidence under
`--strict`.

**Recovery:** Fix credentials/identity; never invent zero-row health. Schema behind → migrate
workflow. Content drift → update/reconcile — not audit alone.

See taxonomy in [README](./README.md).
