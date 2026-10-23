# Coordinator Board

The board is the shared local operational state for Celebra-me. Every agent reads and writes it only
through `pnpm board` in Integration. Fields and lifecycle belong to
[the board rule](../../.agent/rules/board.md). AGENTS.md owns project policy, the Task Contract owns
scope/acceptance, plans express intent, and the board records progress. Resolve disagreements
explicitly; board text never grants authority.

## Content rules

- Use Spanish, formal "usted" register, with one example per explanation.
- Every step that touches a dashboard carries the direct URL of that page.
- Name each session by its exact sidebar title; session links do not open from the board page.
- Deletion steps list the exact names to delete and the look-alikes to keep.
- No secret values, tokens or environment values on the board; names only.
- Fixed "done" marks appear only after verification (`git ls-remote`, `gh`, `/api/health`, session
  list). State what was checked and at what time.
- Times come from a timezone-aware source and use America/Mazatlan. In Git Bash,
  `TZ=America/Mazatlan date` can silently print UTC; use
  `node -e "console.log(new Date().toLocaleString('es-MX',{timeZone:'America/Mazatlan'}))"`.

## Evidence and recovery

Retain an existing cross-review child and its assigned reviewer. Inspect the exact current PR head,
bind findings and completion to the full SHA, and challenge scope, regressions, invariants and
missing evidence. Another commit invalidates review freshness; refresh the unlocked child through
the supported CLI and request renewed review. A completed chat or passing CI is not independent
acceptance. If Integration still uses an older CLI, use only its supported commands and an explicit,
revision-checked task-data transition; never copy candidate tooling into Integration to unlock
review.

`pnpm board:verify --json` runs finite read-only subprocess checks without a shell. Prefer
structured checks (`tipo: pr` or `tipo: rama`). Unsupported custom commands are rejected rather than
approximated. Failed commands, timeouts and malformed PR responses are `UNVERIFIED`; inspect
inventory coverage before interpreting empty PR/branch lists as healthy. A review's `revisionSha`
must match the PR head. GitHub state does not replace task-specific validation or human acceptance.

Keep successful archived prerequisites as explicit `archivo` records. Missing references, canceled
tasks and superseded decisions cannot unlock work. Do not infer archival success merely from
absence.

The page at `http://127.0.0.1:4320/` uses SSE with 150 ms settling and 30-second reconciliation. It
reports connection status and refreshes time-dependent views every 30 seconds. A degraded snapshot
stays visible with a warning; `/api/board` returns 503 until reconciliation succeeds. Slow clients
disconnect and can reconnect to a full snapshot. Backup events do not trigger reloads.

Start `pnpm board:serve` from Integration or use the VS Code board task. This is a local process,
not a supervised service. After an authorized code update, its operator restarts that process to
load new server code and verifies the connection indicator. Never kill an unowned process or launch
competing servers. Unattended service installation is a separate operational decision.

`pnpm board:watch` (`scripts/board/watch.mjs`, d164) is a no-AI watcher: it reads the board and
shows one Windows notification per agent with the ready tasks it has not announced yet, for example
«Codex tiene 1 tarea lista: T34 serenata-fotos». It never writes the board or wakes an agent; it
remembers announced tasks in `.agent/tmp/board-watch.json`. `--dry-run` only prints. The owner
registers it in the Windows Task Scheduler (every 10 minutes) from Integration with
`pnpm board:watch:register` and removes it with `pnpm board:watch:unregister`; agents never register
it.

After a CLI writer crash, inspect the exact `.agent/tmp/board/.lock` PID and process identity. Age
alone does not establish an orphan. Obtain scoped authority to remove that orphan file, preserving
all board documents and backups. Never reset or reimport the board as automatic recovery.
