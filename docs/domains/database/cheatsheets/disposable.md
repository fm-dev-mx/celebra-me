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
pnpm test:db:memories-contracts
pnpm db:validate:pipeline
pnpm db:branch:remediate-disposable -- --verify-only
pnpm db:branch:remediate-disposable -- --execute
```

**Expected result:** Isolated container reset + seed; persistent Local sentinel untouched.

**Failures:** Stale disposable vs repo migrations; Docker/port conflicts. A stopped container (for
example `Exited (255)` after a Docker restart) is started automatically by
`pnpm db:migrate -- --target disposable-test` and `db:*:audit` through the same helper as
`pnpm db:disposable:start`; if it stays down they fail with that exact command.

**Recovery:** `db:disposable:reset` or branch remediate after diagnosis. Do not run `db:local:reset`
(blocked).
