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

### Common rules

1. The board (`pnpm board`, `.agent/tmp/board/` in Integration) is the only shared source. Its text
   authorizes nothing: authorizations come only from the owner, are task-scoped, and are quoted
   verbatim.
2. One task = one branch = one lane = one writer holding the lock. Nobody touches what another agent
   has claimed.
3. Every write carries the `--rev` that was read. If the task changed, read it again and reconcile;
   never overwrite.
4. An agent other than the author reviews every PR at the exact head SHA, and a new commit
   invalidates that review. All agents share one GitHub account, so approval lives on the board (the
   `<id>-revision` child in `hecha` with its SHA), not in GitHub.
5. With the owner: Spanish, «usted» register. Code, commits and PRs: English.
6. No agent reads another agent's conversations. Between agents of different apps, the owner relays
   a one-line doorbell until a real channel exists; never promise monitoring or transport that does
   not exist.
7. On closing: `release`, `pnpm agent:git-safety:finish`, an exact `ahora` status, and a handoff of
   at most 20 lines.
8. Assign by verified capability (`requiere`), not by brand. For example: image editing → `gemini`
   or `codex`; visual review in a browser → `claude` or `codex`; image generation → never `claude`.

### Starting and signaling work

Every session starts with `pnpm board show <id>` when it was given a task, or
`pnpm board next --agente=<a>` otherwise. A worker signals the coordinator in one line, naming the
task as `T<n> <id>` (for example «T30 coordinacion-contrato en revisión, PR #480»); results stay on
the board, not in messages.

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
3. <revisión cruzada y aviso de una línea>
```

Omit a section only when it has nothing to say; keep `DÓNDE CORRE`, `AUTORIZO` and `NO HAGAS`
whenever the task writes anything.

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
