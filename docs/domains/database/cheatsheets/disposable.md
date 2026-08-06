# Cheat sheet — Disposable test database

**Purpose:** Destructive migration/pgTAP/contract reconstruction on `127.0.0.1:54332`.  
**User:** Agents, CI, developers.  
**Prerequisites:** Never target persistent-local (`54322` / `celebra-me-rsvp`).

## Commands

```bash
pnpm db:disposable:start
pnpm db:disposable:reset
pnpm db:disposable:test
pnpm test:db:rsvp-contracts
pnpm test:db:managed-contracts
pnpm db:validate:pipeline
pnpm db:branch:remediate-disposable -- --verify-only
pnpm db:branch:remediate-disposable -- --execute
```

**Expected result:** Isolated container reset + seed; persistent Local sentinel untouched.

**Failures:** Stale disposable vs repo migrations; Docker/port conflicts.

**Recovery:** `db:disposable:reset` or branch remediate after diagnosis. Do not run `db:local:reset`
(blocked).
