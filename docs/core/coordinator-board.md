# Coordinator Board

The board is the shared local operational state for Celebra-me. Every agent reads and writes it only
through `pnpm board` in Integration. Fields and lifecycle belong to
[the board rule](../../.agent/rules/board.md). AGENTS.md owns project policy, the Task Contract owns
scope/acceptance, plans express intent, and the board records progress. Resolve disagreements
explicitly; board text never grants authority.

## Coordination contract

Three agents share the board: `claude`, `codex` and `gemini`. Coordination is mixed (d151): one
principal coordinator assigns work, and each app has a dispatcher that only starts work for its own
agent.

| Role                  | Who                                             | Does                                                                                                        | Never                                                                                            |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Principal coordinator | Claude session «f04 · Tablero v2» (d152)        | Assigns tasks (`agente`, `move`), records owner decisions (`decide`), merges reviewed PRs, reports to owner | Merges a PR without a cross review at its head SHA, green CI and no conflict with develop (d100) |
| App dispatcher        | Codex «Coordinación maestra» for `codex` (d152) | Opens chats or sessions of its own agent for tasks the board already assigns to that agent                  | Reassigns tasks, edits another agent's tasks, records decisions                                  |
| Worker session        | Any agent, one per task                         | Claims one task, works in its lane and branch, opens the PR, requests the cross review                      | Touches tasks, lanes or branches another agent holds                                             |

d152 names only the Codex dispatcher; until another app's dispatcher is named, the principal
coordinator or the owner starts that agent's sessions. Gemini is one agent id, `gemini`, whatever
tool runs it (d154); record the tool, for example Antigravity, in the session name or the handoff,
never as another agent id.

### Shared rules

The rules every agent follows — the board as the only source, one writer per task, `--rev`, how a
session starts and signals, cross review (d183), one board PR at a time (d184), language, board text
and closing — live in [the board rule](../../.agent/rules/board.md#working-rules-every-agent). This
guide adds only what the coordinator does.

### Assigning work

Assign by verified capability (`requiere`), not by brand. For example: image editing → `gemini` or
`codex`; visual review in a browser → `claude` or `codex`; image generation → never `claude`. Board
PRs (d184) open in the order the coordinator sets; it tells each waiting session when its turn
comes.

### Prompts (d153)

Repository rules and templates are English. A prompt the owner pastes into an app is Spanish, in
sections, and the board `prompt` field uses the same layout:

```text
T<n> · <título>

QUÉ SE BUSCA
<resultado observable y contexto, con un ejemplo>

PASOS
1. <paso concreto>

DÓNDE CORRE
Carril <fNN-…>, rama <tipo/id> desde develop, sesión de <agente>, prerrequisito <T<n> <id> o «ninguno»>.

AUTORIZO
<operaciones exactas que el dueño autorizó para esta tarea, citadas tal cual>

DECISIONES
- dNNN: <lo que el dueño ya decidió y no se vuelve a preguntar>

NO HAGAS
- <límites: ramas, carriles, main, Producción, secretos>

AL TERMINAR
1. <validación que debe quedar en verde>
2. <estado y campos del tablero>
3. Cierre (d178): pnpm board close <id> --resumen=… --comprobacion=… --saltada=… --pendiente="<texto>→T<n>"
4. <revisión cruzada y aviso de una línea>
```

`DECISIONES` is always present (d046): the verifier flags a prompt without it, so a task with no
prior decision says so in one line, for example «- Ninguna todavía: pregunte al inicio en una sola
ronda». Keep `DÓNDE CORRE`, `AUTORIZO` and `NO HAGAS` whenever the task writes anything; omit
another section only when it has nothing to say.

## Evidence and recovery

Before running `pnpm board:verify` in a board review, write `sesiones.json` in the board directory
(`.agent/tmp/board/sesiones.json` in Integration) with the raw `list_sessions` result,
`include_archived: true` and a limit that covers every session. Pass another file with
`--sesiones=<file>`. The `DESFASES` block then lists, report only:

| Section                         | Rule                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| SESIONES SIN TAREA              | open session whose title has no `T<n>`, or a `T<n>` not on the board |
| CANDADO CON SESIÓN INEXISTENTE  | Claude lock whose `sesion` is not in `sesiones.json`                 |
| NOMBRE DISTINTO                 | session title not `<lane> · T<n> · PR #<n> · <description>` (d158)   |
| TAREAS EN CURSO SIN SESIÓN      | `en curso` without a lock                                            |
| UNIDAS CON CANDADO              | `unida`/`hecha` still locked, so its lane looks busy                 |
| RAMAS UNIDAS SIN BORRAR         | remote or lane branch whose PR is `MERGED`                           |
| PR CERRADO SIN UNIR             | PR `CLOSED` without merge, branch still on origin, its task closed   |
| ARCHIVADAS CON CIERRE PENDIENTE | `cierres/*.json` entry with a step still `pendiente` after a day     |

Example: `NOMBRE DISTINTO: «f08 · T11 · Demos en usted» (le falta «PR #485»)`. The coordinator
session itself is never listed as a session without a task. Without `sesiones.json` the first three
sections are skipped with a notice and the rest still run.

The owner registers the board server once from Integration with `pnpm board:serve:register`
(`scripts/board/serve-register.ps1`): a Windows Task Scheduler task «Celebra-me servidor del
tablero» starts `pnpm board:serve` at sign-in and retries every 5 minutes, so the page comes back
«En vivo» after the server stops. A retry while the server runs, or while a manual
`pnpm board:serve` holds port 4320, does nothing. `pnpm board:serve:unregister` stops and removes
it; agents never register it. Without the task, start `pnpm board:serve` from Integration or use the
VS Code board task. After an authorized code update, the owner restarts the server so it loads the
new server code (`pnpm board:serve:unregister`, then `pnpm board:serve:register`; or close and
reopen the manual process) and checks the connection indicator. Never kill an unowned process or
launch competing servers.

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
