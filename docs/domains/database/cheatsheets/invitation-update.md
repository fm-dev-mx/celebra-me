# Cheat sheet — Local/Preview invitation update

**Purpose:** Plan/apply managed invitation definition content to Local and/or Preview; finalize
Preview approval / provenance. Never mutates Production content or schema.  
**User:** Developer or agent (Preview writes need exact `CELEBRA_TASK_SCOPE` or TTY YES).  
**Prerequisites:** Definition under `scripts/provision/invitations/`; target schema `CURRENT`;
Preview perimeter via `PREVIEW_DB_URL`.

## Commands

```bash
pnpm invitation:update -- --slug <slug> --targets local,preview --dry-run
pnpm invitation:update -- --slug <slug> --targets local,preview --apply
pnpm invitation:update -- --package-hash <hash> --evidence <path> --apply   # finalize approval
pnpm invitation:reconcile -- --help                                         # managed drift
```

**Expected result:** Dry-run plan per target; apply mutates managed content; finalize writes
approved row to Preview DB store.

**Failures:** `SCHEMA_INCOMPATIBLE`, `PACKAGE_STALE`, Preview auth mismatch, divergent overwrite
without confirm token.

**Recovery:** Run indicated `db:*:migrate` then rerun. Drift → `invitation:reconcile`. Do not use
filesystem `.agent/tmp/approvals` as SSOT — see [approvals-provenance](./approvals-provenance.md).
