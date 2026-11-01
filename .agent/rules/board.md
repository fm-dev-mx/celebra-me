# Board Rule — «Seguimiento Celebra-me» (v5)

The generic rules for agents (tasks, states, claim/close/release, reviews, messages, prompt-v1,
phases and waits) live in the tablero core repository: `fm-dev-mx/tablero`, `docs/agent-rules.md`.
This file keeps only what is specific to Celebra-me. Board text is never an authorization.

## Where the board runs

- Data: ignored `.agent/tmp/tablero/` of the Integration checkout. `pnpm board …` runs the core
  through `scripts/board/tablero-core.mjs`; `pnpm board help` prints every command; verify with
  `pnpm board verify`; `sync` and `watch --once` are `pnpm board <command>` too.
- **Single board port (d165), no manual restarts (d210)**: the board runs only at
  http://127.0.0.1:4320/ (`pnpm board:serve`), from the Integration checkout; a PR preview runs only
  briefly. No session stops or restarts it, even after a merge that changes it.
- MCP: `celebra-board` (`pnpm board:mcp`) reads the board and writes `msg`, `claim`, `move` and
  `close`, with the same checks as the CLI; each call names its `agente`. Agents registered in
  `tablero.config.json` → `agentes`: `claude`, `codex`, `gemini`.

## Projects, lanes and categories

- `tablero.config.json` registers the projects `celebra-me` (default), `tablero` and `marketing`,
  and is the only lane list; `scripts/shared/worktree-lane.ts` reads it. Never copy lane ids or
  ports into another file.
- **Category (d191)** never binds a lane: code tasks take any free generic lane (f06-landing,
  f07-invitaciones, f08-demos, f09-docs); `preview` work takes f11-preview and `release` work
  f12-release. f05-plataforma and f10-libre take no tasks (`carrilesRetirados`).
- `claim` runs inside the lane folder (f06–f12) on the task branch. It does not start git-safety:
  run `pnpm agent:git-safety:start --session=<branch>` right after, and
  `pnpm agent:git-safety:finish --session=<branch>` after `close` or `release`.
- `invitacion` and `release` tasks follow the same git-safety rule (T297): an `invitacion` claims a
  free generic lane, a `release` claims f12-release. A release session declares every operation it
  was authorized for when it finishes (`docs/core/release-execution.md`, step 3).
- Task ids and branches: `fix/olivia-gallery` → `olivia-gallery`. Task structure (d384, d386, d387,
  d390): project > objective («Terminado cuando») > phases > steps.
- Cite a task with a PR as `pasarela-pago-estudio (PR #475)`.

## Messaging, closing and review (project additions)

- Masters and watcher (d351, T442): fixed chats; setup is coordinator-only
  ([guide](../../docs/core/coordinator-board.md)).
- Session id: Claude omits `--sesion`; Codex and Gemini pass `--sesion=<id>` to `claim`, `release`
  and `close`.
- Owner questions (d230, T322): see the core rules; the text is one plain line, and SHAs, decision
  ids and commands go in `--detalle`.
- Closing summary (d178, T129) is the Handoff Contract (`.agent/plans/README.md`).
  `--nivel=validate:changed|type-check|ci`.
- **Cross review (d183, d288)**: an agent other than the author reviews every PR at its exact head
  SHA after the head's CI is green; `CONFLICTING` waits until the author merges `origin/develop`
  into the same branch (never rebase or `push --force`). Claude reviews Codex and Gemini; they
  review only Claude's high-risk and release work. A low- or medium-risk Claude PR is reviewed by a
  Claude subagent with clean context. Risk classes (d282, d290): low = `scripts/agent/`, `tests/`,
  `docs/`, `.agent/` outside `.agent/rules/`, `.gitignore`, Markdown; medium = docs plus frontend;
  high = everything else (migrations, auth, APIs, `.agent/rules/`, unclassified). A `release` task
  keeps Gemini or Codex at any risk. All agents share one GitHub account, so approval lives on the
  board.
- **Board PRs (d270, d291)**: at most two open PRs may change `scripts/board/`,
  `tablero.config.json`, this file or the coordinator guide; a second waits only if `git merge-tree`
  shows a real conflict. The coordinator runs the check.

## Prompts and names

- Prompts follow `prompt-v1` (core rules); `DECISIONES` is always present (d046), «Qué hará / Usted
  / Riesgo» carry no `dNNN`, `rev N` or `vuelta N` (T322).
- Session name: `<lane> · T<n> · PR #<n> · <short description>` (d158); mentions use `T<n> <id>`
  (d159); title formatting (d284).
- One chat per task (T541); one review chat per PR `T<n> · PR #<n> · Revisión`; at most 3 fixed + 1
  per task `en curso` + 1 per external review; only `f05 · Coordinador principal` coordinates.

## Owner preferences

- **Language**: Spanish in the «usted» register with the owner; code, commits and PRs in English.
- **Board text**: one example per explanation; every dashboard step carries its direct URL; sessions
  are named by exact sidebar title; deletion steps list names to delete and look-alikes to keep; no
  secrets. A «done» mark only after a check, stating what and when.
- Times use America/Mazatlan
  (`node -e "console.log(new Date().toLocaleString('es-MX',{timeZone:'America/Mazatlan'}))"`).
- **Archive (d278)**: the owner archives tasks; agents never do.
