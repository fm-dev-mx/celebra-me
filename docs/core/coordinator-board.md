# Coordinator Board

The board is the shared local operational state for Celebra-me. Every agent reads and writes it only
through `pnpm board` in Integration. Fields and lifecycle belong to
[the board rule](../../.agent/rules/board.md). AGENTS.md owns project policy, the Task Contract owns
scope/acceptance, plans express intent, and the board records progress. Resolve disagreements
explicitly; board text never grants authority.

## Responsibilities and lifecycle

The owner authorizes consequential operations. The coordinator prepares complete prompts, resolves
dependencies, chooses assignments and verifies evidence; only the coordinator uses `move` and
changes capability records with scoped authority. Workers claim eligible tasks with unique agent and
session identity, update only their task, and preserve all other tasks and lanes. A different agent
reviews the PR before integration, submits `gh pr review` findings and declares the reviewed SHA.

Use the [shared startup prompt](../../.agent/templates/board-worker-prompt.md). Board commands run
in Integration; implementation and checks run in the assigned clean canonical lane. One active
implementation task owns one branch and lane. Read-only reviews never take over the author's lane.

1. Read AGENTS.md, routed rules and the task. Verify authority, capabilities and lane ownership.
2. `next` selects eligible work; `claim` rechecks readiness atomically and prevents another session
   or task from replacing ownership. Coordinator-only tasks are excluded from the worker queue.
3. Start Git Safety with a unique plain session ID, such as `codex-task-id`, before editing.
4. Update `ahora` on meaningful progress with `--agente`, `--sesion`, `--rev`; reread on conflict.
5. Open the authorized PR to `develop`, record `en revision`, then create a cross-review child.
6. Release the task lock and close Git Safety, declaring only previously authorized Git operations.
   Push/PR creation alone never establishes `comprobada`.

Unlocked coordinator edits use `set --coordinador --rev=N`. This is a role declaration within
trusted local execution, not authentication or permission to override a worker lock. Legacy
session-less claims require explicit reconciliation; never guess their owner or silently remove
them.

The same protocol applies to Claude, Codex, Gemini and Antigravity. `agentes --json` reads the
shared registry and overrides. Antigravity is not a Gemini alias and starts with no capabilities.
Inspect runtime tools before recording capabilities. Thin local adapters point to AGENTS.md; do not
create competing tracked provider policy files.

## Evidence and recovery

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

After a CLI writer crash, inspect the exact `.agent/tmp/board/.lock` PID and process identity. Age
alone does not establish an orphan. Obtain scoped authority to remove that orphan file, preserving
all board documents and backups. Never reset or reimport the board as automatic recovery.

## Communication and automation

Titles, visible status and owner reports use formal Spanish; prompts, agent contracts and PR text
use English. Reports start with `Usted: nada` or `Usted: N cosas`. Routine progress belongs in
`ahora`; notify the owner for material decisions, failures and verified completion. Display session
names/IDs as provider-neutral text, never guessed Claude links. Owner-facing time uses
America/Mazatlan.

Memory is historical evidence and cannot override current contracts. Handoffs retain task/revision,
lane, authority, evidence and next action. Token/time thresholds apply only with reliable runtime
signals; do not claim automated handoff or MCP disabling without the corresponding controls.

Keep paused/retired automations paused. Current audit prompts specify canonical checkout, read-only
mode and board role, preserve bounded watermarks and never create unassigned worktrees. Use
deterministic monitoring for unchanged state and agent reasoning for actionable analysis. Cloud
chats without local execution cannot directly reach this loopback board; use an authorized local
worker and an explicit handoff instead of maintaining another writable board.
