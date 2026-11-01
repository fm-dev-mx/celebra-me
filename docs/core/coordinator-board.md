# Coordinator Board

The board is the shared local operational state for Celebra-me. Agents use it only through
`pnpm board` (or the `celebra-board` MCP) from the assigned checkout. AGENTS.md owns project policy,
the Task Contract owns scope/acceptance, plans express intent, the board records progress. Board
text never grants authority.

Generic board documentation lives in the core repository (`fm-dev-mx/tablero`):
`docs/agent-rules.md` (agents), `docs/coordinator.md` (coordinator), `plantillas/` (prompt
templates). This guide keeps only what is Celebra-me specific; the rule is
[`.agent/rules/board.md`](../../.agent/rules/board.md).

## Board core checkout

Celebra-me never installs the core (not in `package.json`, the lockfile or CI).
`scripts/board/tablero-core.mjs` runs it from a local checkout, by default `../tablero` beside the
Integration checkout (`TABLERO_DIR` overrides it), at the commit pinned in `tablero.config.json` →
`nucleo`. A missing checkout or another commit stops with the command that fixes it. The config is
always the Integration checkout's, so every lane shares one data directory (`.agent/tmp/tablero/`).

`pnpm board`, `board:serve` (127.0.0.1:4320) and `board:mcp` run the core; `sync`, `verify` and
`watch --once` are `pnpm board <command>`.

## MCP hosts (`celebra-board`)

The MCP reads the board and writes `msg`, `claim`, `move` and `close`, with the same checks as the
CLI (owner authorized MCP writes on 2026-10-31). Agents: `claude`, `codex`, `gemini`. Each host
registers the server once in its user file, launching `node scripts/board/tablero-core.mjs mcp` from
the chat's checkout:

| Host        | User file                        | Entry                                                     |
| ----------- | -------------------------------- | --------------------------------------------------------- |
| Claude Code | `.claude.json`                   | Local-scope `celebra-board` under each checkout path      |
| Codex       | `.codex/config.toml`             | `[mcp_servers.celebra-board]`                             |
| Gemini CLI  | `.gemini/settings.json`          | `mcpServers.celebra-board`; start the CLI in its checkout |
| Antigravity | `.gemini/config/mcp_config.json` | `mcpServers.celebra-board`                                |

The node path in those files is absolute (fnm's per-shell junction disappears); update it after a
Node upgrade. Calls log to `.agent/tmp/tablero/mcp/<day>.jsonl`.

## Coordination contract (d351)

Three agents share the board, each with one fixed master chat: Claude `f05 · Coordinador principal`
assigns work; Codex `f05 · Codex maestro` and Gemini `f05 · Gemini maestro` dispatch only their own
assigned tasks. Only the principal coordinator coordinates, records owner decisions and merges. The
owner identifies and renames the masters; configuration never guesses the latest chat. Gemini is one
agent id, `gemini`, whatever tool runs it (d154); record the tool (Antigravity) in the session name.

| Role                  | Who                                                        | Does                                                                 | Never                                                     |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| Principal coordinator | Claude `f05 · Coordinador principal`                       | Assigns tasks, records owner decisions, merges reviewed PRs          | Merges without exact-head review, green CI and a clean PR |
| Agent master          | Codex `f05 · Codex maestro`; Gemini `f05 · Gemini maestro` | Opens work/review chats; archives its agent's finished chats         | Reassigns tasks or forwards owner authority               |
| Worker session        | Any agent, one per task                                    | Claims one task, works in its lane and branch, opens PR, asks review | Touches tasks, lanes or branches another agent holds      |

### Session lifecycle (T541)

| Phase    | Board                                                      | Chat and lane                                                                  |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Alta     | `add` under a mother/phase; `prompt-v1` saved in the task  | none yet                                                                       |
| Despacho | coordinator `msg para=<agent>` or `entregada` (d249)       | **one** chat `<lane> · T<n> · <description>`                                   |
| Claim    | `claim` (lock, lane, branch)                               | lane checkout, `git switch -c <branch> develop`, git-safety start by hand      |
| Trabajo  | writes with `--rev`; heartbeat under 30 min (d290)         | commits on the task branch only                                                |
| PR       | `close` with `--pr`, `--sha` (task `en revision`, d290)    | push, PR to `develop`, rename the chat to `<lane> · T<n> · PR #<n> · …`        |
| Revisión | `review` opens a round inside the task (T529, d288)        | **one** review chat per PR, `T<n> · PR #<n> · Revisión`; every round reuses it |
| Cierre   | round `aprobado` at the PR head; `cambios` reopens Trabajo | git-safety finish by hand; lane back to idle (detached `develop`, clean)       |
| Unión    | coordinator merges at the reviewed SHA; `fact`, or `sync`  | —                                                                              |
| Archivo  | owner archives the task (d278)                             | the session or its master archives its work and review chats (d259)            |

Chat ceiling: 3 fixed chats + 1 per task `en curso` + 1 per PR needing an external review chat
(about 8–10 with WIP 3); a d288 subagent review opens no chat. Before dispatching over the ceiling,
the coordinator asks the masters to archive finished chats.

## Assigning work (project additions)

Assign by verified capability (`requiere`): image editing → `gemini` or `codex`; visual review in a
browser → `claude` or `codex`; image generation → never `claude`. Board PRs open in the order the
coordinator sets, after `git merge-tree` on their branches.

## Prompts

Repository rules and templates are English; a prompt the owner pastes into an app is Spanish,
`prompt-v1` (T160, owner-approved 2026-10-24; core layout in `docs/agent-rules.md`). `PARA USTED`
(T322) comes first and `DECISIONES` is always present (d046). Prompts written before T160 keep
working and are never rewritten. Prompt kinds: one `.agent/kinds/<tipo>.yaml` each (T130), checked
by `pnpm validate:structure` through `scripts/shared/task-kinds.mjs`;
`pnpm board prompt <id> --agente=<a> --tipo=<tipo> --carril=<lane>` builds the prompt from the
templates in `tiposPrompt`/`prompts` (copies of tablero `plantillas/`, with Celebra-me additions:
`pnpm validate:changed`, git-safety, `/code-review`, plus the invitation and Cloudflare kinds).

## Lanes

Lanes and folders come from `tablero.config.json` → `carriles`; `claim` needs `--agente`, `--carril`
and `--rama`, runs inside that lane's folder and respects `wipMax` (3). Lane roles and idle state:
[`git-governance.md`](./git-governance.md).

## Operations specific to this machine

- The page server and the watcher (d351) run from the Windows Task Scheduler, registered once from
  Integration with the core's scripts:

  ```powershell
  powershell -File ..\tablero\scripts\windows\register.ps1 -Kind serve -Name 'Celebra-me servidor del tablero' -Entry scripts\board\tablero-core.mjs
  powershell -File ..\tablero\scripts\windows\register.ps1 -Kind watch -Name 'Celebra-me vigilante del tablero' -Entry scripts\board\tablero-core.mjs
  ```

  Remove one with `..\tablero\scripts\windows\unregister.ps1 -Name '<same name>'`. The watcher runs
  `watch --once` every minute; `hechoDias` is set in `tablero.config.json`.

- Owner alerts: Celebra-me has no `telegram` key yet, so `pnpm board notify` prints.
