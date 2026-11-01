# Coordinator Board

The board is the shared local operational state for Celebra-me. Every agent reads and writes it only
through `pnpm board` (or reads it through the read-only `celebra-board` MCP) from the assigned
checkout. Fields and lifecycle belong to [the board rule](../../.agent/rules/board.md). AGENTS.md
owns project policy, the Task Contract owns scope/acceptance, plans express intent, and the board
records progress. Resolve disagreements explicitly; board text never grants authority.

## Board core (fm-dev-mx/tablero)

The project-agnostic core lives in the private repository `fm-dev-mx/tablero`. Celebra-me never
installs it: it is not in `package.json` or the lockfile, and CI never needs it.
`scripts/board/tablero-core.mjs` runs it from a local checkout, by default `../tablero` beside the
Integration checkout (`TABLERO_DIR` overrides it), at the commit pinned in `tablero.config.json` →
`nucleo`. A missing checkout or another commit stops with the command that fixes it. The config is
always the Integration checkout's, so every lane shares one data directory.

```bash
pnpm board timeline
pnpm board:serve                      # page on 127.0.0.1:4320
pnpm board:mcp                        # read-only MCP on stdio
pnpm board:watch                      # one watcher pass
```

`pnpm board`, `board:serve`, `board:sync`, `board:verify`, `board:watch` and `board:mcp` all run the
core (`pnpm tablero` is the same wrapper); `pnpm board help` prints every command. The data lives in
`.agent/tmp/tablero/`. `tablero.config.json` registers the projects (`celebra-me`, the default;
`tablero`; `marketing`) and the lanes with their folders; `claim` must run inside the lane folder.

The main writes: `add` creates a task (`--id= --num= --titulo=`, `--proyecto=` picks a project);
`move` changes state, PR, branch or project; `order` sets the queue position; `fact --hecho=merged`
records a merge; `review` records a verdict (`--revisor= --veredicto=aprobada|cambios`); `msg` takes
its text as `--texto=`. The core has no command to check two PRs for overlap: the coordinator runs
`git merge-tree` by hand (see [Assigning work](#assigning-work)).

## Local MCP access

`pnpm board:mcp` starts the core MCP on stdio. It is read-only: `timeline`, `list`, `show` and
`inbox`. Every write goes through the CLI (`pnpm board <command>`), so the MCP never needs a lock or
a session. Each host registers it once as `celebra-board` in its user file, launching
`node scripts/board/tablero-core.mjs mcp` from the chat's checkout:

| Host        | User file                        | Entry                                                     |
| ----------- | -------------------------------- | --------------------------------------------------------- |
| Claude Code | `.claude.json`                   | Local-scope `celebra-board` under each checkout path      |
| Codex       | `.codex/config.toml`             | `[mcp_servers.celebra-board]`                             |
| Gemini CLI  | `.gemini/settings.json`          | `mcpServers.celebra-board`; start the CLI in its checkout |
| Antigravity | `.gemini/config/mcp_config.json` | `mcpServers.celebra-board`                                |

The node path in those files is absolute (fnm's per-shell junction disappears); update it after a
Node upgrade.

### Messaging and delivery

`pnpm board msg [<id>] --de=<agente> --para=<agente|dueno> --texto="…"` writes a message;
`--opcion=` (repeatable) and `--detalle=` add owner choices and technical detail. A recipient reads
its inbox with `pnpm board inbox --agente=<agente>` and marks it with
`pnpm board atendido [<id>] --agente=<agente>`. The coordinator hands a ready task to an agent with
`pnpm board dispatch <id> --agente=<agente>`; `pnpm board entregada` lists what was handed over.
`pnpm board inbox sync` and the watcher keep owner questions visible on the page.

## Coordination contract

Three agents share the board: `claude`, `codex` and `gemini`. Under d351 each has one fixed master
chat. Claude `f05 · Coordinador principal` assigns work; Codex `f05 · Codex maestro` and Gemini
`f05 · Gemini maestro` dispatch only their own assigned tasks. Only `f05 · Coordinador principal`
coordinates; no other chat assigns, records owner decisions or merges. A new chat requires a
concrete task (`T<n>` in its title): ad hoc analysis stays in the coordinator's chat or gets a task
first. A PR gets at most one review chat, `T<n> · PR #<n> · Revisión` with no lane, which every
round of that PR reuses. Follow-ups reuse that task's existing chat.

| Role                  | Who                                                        | Does                                                                                   | Never                                                     |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Principal coordinator | Claude `f05 · Coordinador principal`                       | Assigns tasks, records owner decisions, merges reviewed PRs                            | Merges without exact-head review, green CI and a clean PR |
| Agent master          | Codex `f05 · Codex maestro`; Gemini `f05 · Gemini maestro` | Opens concrete work/review chats; archives its agent's finished chats                  | Reassigns tasks or forwards owner authority               |
| Worker session        | Any agent, one per task                                    | Claims one task, works in its lane and branch, opens the PR, requests the cross review | Touches tasks, lanes or branches another agent holds      |

The owner identifies and renames the existing masters; configuration never guesses the latest chat.
Gemini is one agent id, `gemini`, whatever tool runs it (d154); record the tool, for example
Antigravity, in the session name or the handoff, never as another agent id.

### Session lifecycle (T541)

One task = one chat = one branch = one lane. The short form and the chat ceiling are in
[the board rule](../../.agent/rules/board.md#working-rules-every-agent); this table is the full
sequence.

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

Chat ceiling: 3 fixed chats (d351) + 1 per task `en curso` + 1 per PR whose review needs an external
chat, about 8–10 with WIP 3; a d288 subagent review opens no chat. Before dispatching over that
ceiling, the coordinator asks the masters to archive their finished chats.

### Shared rules

The rules every agent follows — the board as the only source, one writer per task, `--rev`, how a
session starts and signals, cross review (d183, d282), board PRs (d270), language, board text and
closing — live in [the board rule](../../.agent/rules/board.md#working-rules-every-agent). This
guide adds only what the coordinator does.

### Assigning work

Assign by verified capability (`requiere`), not by brand. For example: image editing → `gemini` or
`codex`; visual review in a browser → `claude` or `codex`; image generation → never `claude`. Board
PRs (d270: at most two at once; d291: a second one waits only for a real `git merge-tree` conflict)
open in the order the coordinator sets; it runs `git merge-tree` on their branches before they open
and tells each waiting session when its turn comes. A clean `merge-tree` is only textual: it misses
a semantic break (one PR moves a function another PR still imports from the old module), which CI on
the second merge catches.

### Prompts (d153)

Repository rules and templates are English. A prompt the owner pastes into an app is Spanish, in
sections, and the board `prompt` field uses the same layout, format `prompt-v1` (T160, approved by
the owner on 2026-10-24):

```text
<carril> · T<n> · PR #<n> · <descripción breve>

PARA USTED
Qué hará: <lo que hará la sesión, en una frase llana>
Usted: <«nada» o lo que el dueño tendrá que decidir o hacer>
Riesgo: <el riesgo principal, en palabras>

QUÉ SE BUSCA
<resultado observable y contexto, con un ejemplo>
Terminado cuando: <criterio comprobable>

ANTES DE EMPEZAR
Carril <fNN-…> (carpeta celebra-me-worktrees/<fNN-…>), rama <tipo/id> desde develop.
Compruebe que la rev de esta tarea (pnpm board show <id>) sigue en la de «tablero:» de METADATOS; si cambió, pare (d282: los cambios de otras tareas y los de esta misma sesión no cuentan).
  <un comando por línea: switch, claim desde el carril, git-safety start>

PASOS
1. <paso concreto>

AUTORIZO
<operaciones exactas que el dueño autorizó para esta tarea, citadas tal cual; «(solo lectura)» si aplica>

NO HAGAS
- <límites: ramas, carriles, main, Producción, secretos>

DECISIONES
- dNNN: <lo que el dueño ya decidió y no se vuelve a preguntar>

PARE Y PREGUNTE SI
<condiciones de parada>. Pregunte al dueño y anote la pregunta también con
pnpm board msg <id> --de=<agente> --para=dueno --texto="<pregunta de una línea>" --opcion="<la recomendada>" --opcion="<otra>" --detalle="<detalle técnico>" (d230).

AL TERMINAR
- Antes de cada push: pnpm validate:changed y pnpm validate:structure (d246).
- Antes del push: /code-review sobre el propio diff y corregir lo que encuentre (d282).
1. <validación que debe quedar en verde>
2. Cierre (d178, T129): pnpm board close <id> --agente=<agente> --resumen=… --comprobacion=… --saltada=… --pendiente="<texto>→T<n>"
3. <revisión cruzada y aviso de una línea exacto>
4. Respuesta: qué cambió, comprobaciones corridas y saltadas, riesgos.

METADATOS
formato: prompt-v1
tarea: T<n> <id>
origen: <T<n> <id> de la tarea origen, si hay>
agente: <agente>
carril: <fNN-…>
rama: <tipo/id>
base: develop
pr: #<n>
sha: <40 caracteres hexadecimales>
prerrequisito: <T<n> <id> o «ninguno»>
decisiones: <dNNN, …>
tablero: rev <N>
generado: <fecha ISO>
```

Line 1 is the session name (d158); drop `PR #<n>` before the PR exists. `PARA USTED` (T322) comes
next, for the owner first: exactly three lines, `Qué hará:`, `Usted:` (`nada` when the owner has
nothing to do) and `Riesgo:`, one plain sentence each, without internal shorthand the owner cannot
read (`d230`, `rev 3`, `vuelta 2`); the sections after it are for the agent. Each section is present
and in this order; `DECISIONES` is always present (d046): the verifier flags a prompt without it, so
a task with no prior decision says so in one line, for example «- Ninguna todavía: pregunte al
inicio en una sola ronda». `METADATOS` is last, one lowercase `clave: valor` per line; leave out a
key with no value. The core checks a `prompt-v1` against this shape. Prompts written before T160 (no
`formato: prompt-v1`) keep working under the old layout and are never rewritten. A `prompt-v1` saved
before T322 may lack `PARA USTED` and stays valid; every generated prompt has it, and a task title
goes into it with its internal shorthand dropped.

A task with a `tipo` (T130) does not get this template by hand: create it with
`pnpm board add --id=<id> --num=<n> --titulo="…"`, then build its prompt with
`pnpm board prompt <id> --agente=<agente> --tipo=codigo --carril=<fNN-…>`; see
[Task kinds](#task-kinds).

## Evidence and recovery

`pnpm board:verify` runs the core checks over the data directory (fields, locks, prompts, lanes) and
reports what is wrong; it never repairs. `pnpm board:sync` reads the PR state from GitHub and moves
tasks accordingly. Every write appends to the core's log, so `pnpm board timeline` and
`pnpm board show <id>` are the evidence for a task. The page server runs from the Windows Task
Scheduler: `pnpm board:serve:register` (once, from Integration) and `pnpm board:serve:unregister`.

### Master watcher setup (d351)

`pnpm board:watch` runs one core watcher pass (`watch --once`): it reports new claims and closes,
escalates unanswered messages and lists approved reviews whose PR is not merged yet (the merge
queue). It keeps its own state in `vigia.json` in the data directory, so no-work passes print
`(nothing new)`. The same pass archives tasks done for more than `hechoDias` days
(`tablero.config.json`). Register it in the Windows Task Scheduler with `pnpm board:watch:register`
from Integration (one pass per minute) and remove it with `pnpm board:watch:unregister`.

### Owner alerts

`pnpm board notify` sends the inbox summary (counts and public titles only) through Telegram when
`tablero.config.json` has a `telegram` key naming the token and chat environment variables;
`--print` only prints it. Celebra-me has no `telegram` key yet, so `notify` prints.

## Board internals

The model, store, writes, closing, review rounds, sync and checks belong to the core: read its
repository (`fm-dev-mx/tablero`, `src/core/`) instead of copying them here. Two parts stay
project-specific.

### Lanes

The lanes and their folders come from `tablero.config.json` → `carriles`. `claim` needs `--agente=`,
`--carril=` and `--rama=`, must run inside that lane's folder, refuses a lane another task holds and
respects `wipMax` (3). It does not start git-safety: the session runs
`pnpm agent:git-safety:start --session=<branch>` after claiming and
`pnpm agent:git-safety:finish --session=<branch>` before closing. Lane roles and idle state are in
[`git-governance.md`](./git-governance.md).

### Task kinds

Each `tipo` has one `.agent/kinds/<tipo>.yaml` (T130), checked by `pnpm validate:structure` through
`scripts/shared/task-kinds.mjs`: its keys, the `devuelve` contract, `listo_si`, the three
`para_usted` lines and the routing-matrix task types it reads. `pnpm board prompt <id> --agente=`
builds a `prompt-v1` from the core's templates (`tiposPrompt` in `tablero.config.json`).
