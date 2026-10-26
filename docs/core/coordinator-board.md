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
session starts and signals, cross review (d183, d282), board PRs (d270), language, board text and
closing — live in [the board rule](../../.agent/rules/board.md#working-rules-every-agent). This
guide adds only what the coordinator does.

### Assigning work

Assign by verified capability (`requiere`), not by brand. For example: image editing → `gemini` or
`codex`; visual review in a browser → `claude` or `codex`; image generation → never `claude`. Board
PRs (d270: at most two at once; d291: a second one waits only for a real `git merge-tree` conflict)
open in the order the coordinator sets; it runs `pnpm board solape <id>` before they open and tells
each waiting session when its turn comes. A clean `merge-tree` is only textual: it misses a semantic
break (one PR moves a function another PR still imports from the old module), which CI on the second
merge catches.

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
  <un comando por línea: switch, claim (desde el carril abre git-safety)>

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
pnpm board msg <id> --de=<agente> --para=dueno "<pregunta de una línea>" --opcion="<la recomendada>" --opcion="<otra>" --detalle="<detalle técnico>" (d230).

AL TERMINAR
- Antes de cada push: pnpm validate:changed y pnpm validate:structure (d246).
- Antes del push: /code-review sobre el propio diff y corregir lo que encuentre (d282).
1. <validación que debe quedar en verde>
2. Cierre (d178, T129): pnpm board close <id> --resumen=… --comprobacion=… --saltada=… --pendiente="<texto>→T<n>"
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
key with no value. `pnpm board` refuses a `prompt-v1` that breaks this shape, and `board:verify`
warns when line 1 names another `T<n>` or lane than the task's. Prompts written before T160 (no
`formato: prompt-v1`) keep working under the old layout and are never rewritten. A `prompt-v1` saved
before T322 may lack `PARA USTED` and stays valid; every generated prompt has it, and a task title
goes into it with its internal shorthand dropped.

A task with a `tipo` (T130) does not get this template by hand: add it with its kind and its
`QUÉ SE BUSCA`, for example
`pnpm board add <id> titulo=… urgencia=alta actor=sesion agente=claude tipo=codigo rama=feat/<id> carrilPlaneado=f05-plataforma busca="…\nTerminado cuando: …" --coordinador`,
and the board builds the rest from `.agent/kinds/codigo.yaml` and the board. Check it with
`pnpm board prompt <id>`; see [Task kinds](#task-kinds).

## Evidence and recovery

Before running `pnpm board:verify` in a board review, write `sesiones.json` in the board directory
(`.agent/tmp/board/sesiones.json` in Integration) with the raw `list_sessions` result,
`include_archived: true` and a limit that covers every session. Pass another file with
`--sesiones=<file>`. The `DESFASES` block then lists, report only:

| Section                          | Rule                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| SESIONES SIN TAREA               | open session whose title has no `T<n>`, or a `T<n>` not on the board |
| CANDADO CON SESIÓN INEXISTENTE   | Claude lock whose `sesion` is not in `sesiones.json`                 |
| NOMBRE DISTINTO                  | session title not `<lane> · T<n> · PR #<n> · <description>` (d158)   |
| TAREAS EN CURSO SIN SESIÓN       | `en curso` without a lock                                            |
| UNIDAS CON CANDADO               | `unida`/`hecha` still locked, so its lane looks busy                 |
| RAMAS UNIDAS SIN BORRAR          | remote or lane branch whose PR is `MERGED`                           |
| PR CERRADO SIN UNIR              | PR `CLOSED` without merge, branch still on origin, its task closed   |
| CANDADO SIN CHAT DE CODEX/GEMINI | Codex/Gemini lock with no open chat naming its `T<n>` (source read)  |
| CHATS POR ARCHIVAR               | Codex/Gemini chat whose task finished, or older dispatcher runs      |

Example: `NOMBRE DISTINTO: «f08 · T11 · Demos en usted» (le falta «PR #485»)`. The coordinator
session itself is never listed as a session without a task. Without `sesiones.json` the first three
sections are skipped with a notice and the rest still run. The Codex and Gemini stores are read live
(`external-sessions.mjs`, as `pnpm board sesiones`); a missing or busy one prints `NO DISPONIBLE`
and its lock check is skipped.

`AVISOS` also crosses every `en curso`/`en revision` task by the files its PR
(`gh pr view --json files`) or pushed branch changes. The branch is diffed at the SHA
`git ls-remote --heads origin` reports (`git diff --name-only origin/develop...<sha>`), never the
local `origin/<rama>` ref, which verify does not fetch. It warns about a file shared by tasks in
different lanes (lockfiles and Markdown excepted: every lane touches them and Git merges them), more
than two tasks changing `scripts/board/` (d270), and a task changing `supabase/migrations/` without
`toca: ["migracion"]`. A query that fails, a branch head not fetched locally, or a PR that reaches
the 100 files `gh pr view` lists leaves `archivos` coverage `UNVERIFIED`.

The owner registers the board server once from Integration with `pnpm board:serve:register`
(`scripts/board/serve-register.ps1`): a Windows Task Scheduler task «Celebra-me servidor del
tablero» starts `pnpm board:serve` at sign-in and retries every 5 minutes, so the page comes back
«En vivo» after the server stops. A retry while the server runs, or while a manual
`pnpm board:serve` holds port 4320, does nothing. `pnpm board:serve:unregister` stops and removes
it; agents never register it. Without the task, start `pnpm board:serve` from Integration or use the
VS Code board task. A merge that changes the board needs no restart (d210): the supervisor swaps in
the new code by itself (see [The view](#the-view)). Only the coordinator may restart the server, and
only while that swap does not work, after telling the owner first. Never kill an unowned process or
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

## Board internals

The operational contract every agent follows is [the board rule](../../.agent/rules/board.md). This
section keeps how the board works inside: the view, the derived queue, lanes, sessions, the sync,
review routing and the modules that own each rule. Agents read it only when they change the board
code or need the detail behind a command.

### The view

The owner's view is the local page `pnpm board:serve` (http://127.0.0.1:4320/, VS Code task «Tablero
(board:serve)»), the only view: it shows each write live. Its only write is the «Archivar» /
«Desarchivar» button of the «Finalizadas» tab (d167), accepted only as a same-origin JSON `POST` on
127.0.0.1 and run through the same function as `pnpm board archive`. No agent is ever launched from
the view.

Layout (T268): a left sidebar lists the views with quiet gray counts that match the rows each view
lists («General», the default, then Para usted, Cola, Calendario, Bloqueadas, Finalizadas, Carriles,
Historial) and holds the production strip in its foot; below 800 px it slides over. «General» shows
the owner's actions on top and a compact Cola below. «Para usted» shows only the owner's actions,
each led by its verb (Pegar en Gemini, Responder a Codex, Archivar), and never counts messages
addressed to the coordinator; a message card reads «sender → reader: question» with its relative
time, and its technical detail (SHA, branches, commands) folded below. «Le toca al coordinador» and
«Detenidas» are collapsible groups of the Cola, whose rows are grouped by color and filtered by
agent and state chips. A row is the title, then place · ID · state tag · lane; the urgency is the
ring of the row's circle (red urgente, amber alta, gray otherwise; never green) plus its icon for
urgente and alta. Where it runs, the agent and the rest sit in the task sheet's «Propiedades». The
header search (Ctrl+K) is global: without changing tab it lists matches from every section, each
with a gray section label, by task number (T295), id, title or PR (#594); clearing it or Escape
returns to the previous tab. Historial keeps its own search box. The view shows titles in normal
weight and backticked text as inline code (d284).

Supervisor (d210): `pnpm board:serve` runs `scripts/board/view-supervisor.mjs`, which keeps the port
open, watches `scripts/board/` and `scripts/shared/`, and swaps in a new worker once the new code
starts; code that fails to start leaves the previous version serving. The page reconnects by itself
and reloads when the code version changes.

Live updates: the page uses SSE and shows a live or degraded indicator. Events settle for 150 ms;
reconciliation and the redraw of time-dependent views run every 30 seconds. A degraded snapshot
stays visible with a warning and `/api/board` answers 503 until reconciliation succeeds; slow
clients are disconnected and reconnect to a full snapshot; backup events do not reload it.
Sub-second delivery is a measured target, not an availability guarantee. The «Sincronizar» button's
POST needs the page's per-process token and its own `Origin`, and every request needs a local
`Host`.

### Fields

`titulo`, `estado`, `urgencia`, `actor`, `agente`, `toca`, `requisitos`, `requiere`, `categoria`,
`carril`, `ahora`, `pr`, `rama`, `sesion {id, agente, nombre}`, `hasta`, `orden`, `origen`, `padre`,
`grupo`, `fase`, `plan`, `vuelta` (review round), `fila`, `evidencia {cmd, salio}`,
`chequeo {cmd, espera}`, `prompt`, `tipo` and its hand-written fields (see
[Task kinds](#task-kinds)); `rev` and `actualizado` are set by the command, `agregadaPor` and
`seguimientoPor` by the commands that add or follow up a task (T172), `archivada` (date) only by
`archive`/`unarchive`, `entregada {agente, desde}` only by `entregada` and the view's «Copiar
prompt» (d249), `cierre` only by `close`, `prsPrevios` only by `close` of a periodic task. `espera`,
`usted` and `deps` no longer exist.

### Queue, stages and tabs

- **Requisitos**: a `tarea` is met by an explicit `archivo` record too; absent or canceled tasks do
  not satisfy it. A pending task without a prompt waits for one automatically, except
  `actor: coordinador`.
- **Stage and color**: green = ready and the owner acts, or ready and unlocked with only Codex or
  Gemini able to finish it: the owner pastes its prompt there, labeled «Pegar en Codex/Gemini» with
  «Copiar prompt» (d169, `ownerLaunches`; `claim` and `next` are unchanged); violet = ready and an
  agent that starts alone (Claude, or the coordinator) finishes it (it has every capability in
  `requiere`); gray = blocked; blue = `en curso`; teal = `hecha`/`unida`/`en revision`. Urgency is
  an icon, never green.
- **Execution number**: the owner's ready tasks (d163) → urgency → lane (`laneRank`: its category's
  lane free, a review or the lane a task's own lock holds; then another free planned lane; then a
  lane another task's lock holds; then no lane) → ready before blocked → `hasta` → `orden` → title;
  an open task it waits for goes right before it. Blocked tasks take part in that order, so an
  urgent blocked task still lifts its prerequisites, and are then left out (T258).
- **Calendario (d276)**: a `pendiente`, unlocked task whose only unmet requisitos are `fecha` leaves
  the queue and `pnpm board list` for the «Calendario» tab (by date, grouped by week, its count on
  the tab). A task that also waits for a task, a decision, an owner answer or its prompt is blocked
  instead. `pnpm board list` ends with `Calendario (N): próxima T<n> el <fecha>` (model `calendar`,
  `calendarWeeks`, `calendarLine`).
- **Bloqueadas (T258)**: any other blocked open task (`isBlocked`: stage `bloqueada` and not in the
  Calendario; or marked `bloqueada` by hand) leaves the queue for the «Bloqueadas» tab, between
  Calendario and Finalizadas, with its count, the search box and every unmet requisito as «Espera …»
  («Marcada como bloqueada» when none). An owner answer it waits for still shows in «Le toca a
  usted» (`ownerAsks`). `pnpm board list` adds `Bloqueadas (N): T<n>, …` after the Calendario line;
  `--json` lists blocked tasks after the queue with `n: null` (`blocked`, `blockedLine` in
  `subtasks.mjs`).
- **Subtasks (d174)**: `padre=T12` is stored as the mother's id. A task's subtasks are those whose
  `padre` or `grupo` is its id, archived and compacted ones included (`subtasksOf`, ordered by
  `fase`, `orden`, number); a `grupo` no task heads shows under its own header. `groupProgress`
  counts `{total, hechas, enCurso, enRevision, pendientes, pct, faseActual, totalFases}` without
  cancelled subtasks. The queue shows the mother's bar («Fase N de M · X de Y completadas (Z %)»)
  and folds blocked subtasks into «Ver N subtareas» (✓ done, ● running or in review, ○ pending); a
  subtask ready or running now keeps its card (and stays in «Le toca a usted» and `next`), each with
  its `F<n>` tag. The sheet and `pnpm board show` list a mother's «Subtareas · X/Y (Z %)» and give a
  subtask «Parte de T<n> · <título> · X/Y listas». `pnpm board:verify` reports a bad `padre`.
- **What is next**: `pnpm board sigue` (and the page) prints «Le toca a usted», «Le toca al
  coordinador» and «Detenidas». The coordinator sees reviews approved at the PR's current SHA
  (merge), blocked reviews, reviews with findings `close` did not send (legacy rounds), «Pedir el
  resumen de cierre de T<n>» for every task `en revision` or `unida` without a valid `cierre` (d255;
  a merged PR still moves a task to `unida`, because the merge is a fact), open PRs without a task,
  ready Claude tasks without a session and messages for it. `list` prints the same sections without
  reading GitHub. «Le toca a usted» leaves out a message to the owner once its task is finished or
  archived (d265), or once `pnpm board atendido <id> --para=dueno` marks it handled (d291, an
  `atendido {para, mensajes}` bitácora row; `--para=coordinador` does the same for the coordinator's
  messages); `inbox --agente=dueno --todos` still lists it. An agent may read `inbox --agente=dueno`
  without hiding anything: only `--leido`, which the owner passes, marks the owner's messages read.
  A ready Codex or Gemini task idle for 30 min shows in «Le toca a usted» as «Correr el despachador
  de Codex (T<n>)»; an idle Claude task goes to the coordinator.
- **Owner tasks** (`actor: dueno`) show only what to do and where (`donde`, else the first line
  under «DÓNDE CORRE» of an older prompt), never a suggested lane. The coordinator records every
  owner action as an `actor: dueno` task with a short prompt, so it appears in «Le toca a usted».

### Lanes

- **Planned lane (d177)**: `plan --carril=` clears the lane, only without a lock;
  `add … carrilPlaneado=<lane> --coordinador` works too. Only `plan`/`add --coordinador` write
  `carrilPlaneado`; `set` refuses it. The card, `show` and `next` show «Corre en: <lane> · carpeta
  celebra-me-worktrees/<lane>», «Codex/Gemini: abra el proyecto <lane>» and, when another task's
  lock holds that lane, «f10 ocupado por T55; espere o pida otro carril», else «carril libre» while
  the task is unlocked. «Copiar prompt» and `next` add these lines as `corre:` lines at the end of a
  `prompt-v1`'s `METADATOS` (first under `CARRIL` in an older prompt), so the prompt never repeats
  the lane by hand. Review children show «Corre en: Integración (carpeta celebra-me), solo lectura»
  and always resolve to `integration` in `taskLane`. A `soloLectura: true` task is refused a planned
  or explicit lane by `plan`, `add` and `claim`; a legacy planned lane is cleared with
  `plan --carril= --coordinador`. `board:verify` warns about every open task, read-only tasks aside,
  with neither a planned lane nor a lock on one, naming its T<n>.
- **Category (d191)**: the map is `CATEGORIA_CARRIL` in `model.mjs`. `plan`, `show` and the card
  warn, without refusing, when the planned lane is not the category's. A task without a planned lane
  or lock shows «Carril sugerido» on the card, `show` and `next`: its category's lane when free,
  else the first free one.
- **Claims and lanes**: a planned task's `claim` takes `carrilPlaneado` without `--carril`; a
  different `--carril` is refused unless `--coordinador`. `pnpm board verify` warns about a ready,
  unlocked session task without a planned lane and about two ready tasks planned in the same lane.
  Claims use the explicit `--rama` or the task's declared branch; they never infer the caller's
  branch. Read-only work may remain without a branch. Only `actor: coordinador` with `--coordinador`
  may claim the canonical `integration` lane; `f04-integracion` is not a canonical id.
- **Lane and git-safety from the lane (T297)**: `claim`, `close` and `release` run inside a lane
  folder (f05–f12) read that checkout (`lane-session.mjs`). `claim` refuses when the folder is
  another lane or its branch is not the claim's `rama` (detached included), and then opens
  `git-safety start --session=<rama>` there unless that session is already open; a repeated claim
  reopens a session closed in between. `close` and `release` refuse from a lane other than the
  lock's; with `--git-safety=commit` (or `commit,history`) they run
  `git-safety finish --session=<rama> --authorized-operation=…` after the board write, and without
  it they remind that the session is still open. A branch switch is finished by hand. A git-safety
  step that fails prints its reason and exits 1, but the board write stands. Run from Integration or
  an unknown folder, nothing is checked; a test board (`CELEBRA_BOARD_DIR`) reads a checkout only
  when `CELEBRA_BOARD_CHECKOUT` names one.
- **Lane inventory**: `pnpm board carriles` (and the page's lane table) reads each lane from Git:
  branch, clean or not, and the task holding its lock. `carril` without an id reads the lanes live
  the same way: the catalog (`uso`, `tecla`, `puerto`, order and canonical ids) comes from
  `WORKTREE_LANES`, and runtime state comes from task locks and `git worktree list`. In that catalog
  `orden` is the lane's function key (4–12, not the old 1–9 position) and `puerto` is a number, not
  a string; consumers only sort and print them. Stored `carriles/*.json` records are ignored; update
  the code-owned catalog through a pull request. `estado` without fields is read-only too.

### Agents and sessions

- **Agents**: `next --agente=<a>` gives the first ready, unlocked task that agent can finish.
  `claim`/`release` hold a lock (`candado {agente, desde, sesion, carril, rama}`) for one agent at a
  time, each with its bitácora row (T172); `move` hands a task over only without a lock, logs it and
  warns when the new agent lacks a `requiere` capability. Rules are the same for every agent.
- **Delivered prompt (d249)**: «Copiar prompt» on a ready, unlocked task an agent does writes
  `entregada {agente, desde}` too (`delivery.mjs`). The task then leaves «Le toca a usted» and shows
  «Entregada a <agente> · <hora> · esperando que la tome»; after 30 min without a claim it comes
  back as «Entregada hace 30 min y nadie la tomó». A task the owner does or one with a lock refuses
  it.
- **Claim title (T126)**: tasks added after T126 carry `contrato: 1`, and their `claim` requires
  `--titulo="<lane> · T<n> · …"`, stored in the lock. Another session of the same agent cannot
  replace a lock.
- **Session id**: the lock records the id the agent's app knows, so the session can later be found,
  renamed and archived. A Claude `claim` with an id that does not start with `local_` is refused;
  `CLAUDE_CODE_SESSION_ID` is the process id and the app does not know it.
- **Who added and followed up (T172)**: `add` and `review` stamp `agregadaPor`; `set`, `plan`,
  `move`, `close` and `merged` stamp `seguimientoPor`. The writer is a real agent
  (`claude|codex|gemini`) from `--quien` or `--agente`, also with `--coordinador`; else `--quien`
  (`dueno`, `coordinador`) or the coordinator flag. `set` cannot write either field. Tasks saved
  before T172 fall back to the bitácora. The view shows it as a quiet `.by` note after the time, the
  sheet under «Versión», and `show` as a line under the title.
- **Session history**: `release` and `merged` copy the lock's session into
  `sesion {id, agente, nombre}`; `--nombre=<session title>` sets the name, otherwise the recorded
  name stays. Nobody writes `sesion` by hand.
- **Coordinator edits**: unlocked coordination edits require `--coordinador`; the flag declares a
  role, never grants authority or overrides a lock. A legacy lock without `sesion` is freed by
  `release <id> --agente=<its agent> --coordinador`; a lock with `sesion` still needs that session
  while its last heartbeat (`latido`, else `desde`) is under 2 h old. d274: once it is 2 h silent,
  the same command frees it only if the task already has a valid `cierre` (`cierreIssues`); without
  one it is refused and the session must run `close` first. A review released this way with its
  verdict becomes `hecha`, like `close`. d290: `set` and `close` with `--coordinador` may write over
  a lock silent for 30 min (`isInactiveLock`) or whose session the coordinator found archived
  (`--sesion-archivada`); each write sends the lock's agent and session a message row, and a `set`
  to `pendiente` or an end state frees the lock. `release` keeps the d274 rule.
- **Heartbeat**: every successful command renews `candado.latido` on the caller's locks (`--agente`
  or `--de`, with its session); `move`, `review`, `view` and `verify` do not. Read messages are
  marked in `bandejas/<a>.json` (`inbox --todos` lists read ones too).
- **Registry**: `agentes --json` discovers the shared registry and capability overrides. Only
  explicit coordinator updates use `agentes <id> --coordinador --rev=N capacidades=[...]`; inspect
  actual tools before declaring them.
- **Codex and Gemini chats (d211)**: `pnpm board sesiones [--json]` opens `~/.codex/state_5.sqlite`
  and `~/.gemini/antigravity/conversation_summaries.db` read-only, crosses each open chat's `T<n>`
  with the board and says «archivar» (task finished or archived), «dejar» or «sin tarea»; the
  dispatcher's runs fold into one line. A chat without a task is listed only when it has a title, a
  person opened it and it was used in the last 48 h; the rest only count in the last line («Omitidos
  sin tarea», `omitidosSinTarea` in `--json`). It writes nothing: the owner archives by hand.

### Writes, decisions and archive

- **Writes**: lanes: `pnpm board carril`; Production strip: `pnpm board estado`; decisions:
  `pnpm board decide` (a newer one names the old with `reemplaza=dNNN`, which turns
  `vigente: false`; a `decision` text that cites `(reemplaza dNNN)` without the field links that
  decision, and one that cites several, or another than `reemplaza=`, is refused — T172). Aliases:
  `get`, `update`, `decision`, `log`, `verify`. Each overwrite keeps the previous copy in
  `.agent/tmp/board/.respaldos/` (newest 2 per document, none for a finished task, d185);
  `pnpm board prune-backups --dry-run` lists the copies over that rule and only `--aplicar` removes
  them.
- **Archive (d167)**: `pnpm board archive <id> [--rev=<n>]` and `unarchive <id>` hide or show a
  finished task (`hecha`/`unida`/`comprobada`/`cancelada`) without a lock in «Finalizadas»; open or
  locked tasks are refused and the task file is never deleted. Archived tasks leave the review group
  of «Cola» and the «Carriles» view. Only the owner archives (d278), from «Finalizadas» or
  `pnpm board archive`, to watch progress; no command or routine archives on its own.
- **Monthly archive (d187)**: `pnpm board compact --antes=7d [--dry-run]` takes every task archived
  7 or more days ago: one line in `.agent/tmp/board/mensual/resumen-<YYYY-MM>.md` (for example
  `T31 tablero-arreglos-cli · unida · PR #492 · 2026-10-24`), the whole task file in
  `mensual/<YYYY-MM>.zip` (`tareas/<id>.json`) and a small `archivo` record that keeps its number,
  estado and PR for requisitos and numbering; the task file leaves `tareas/` only after the `.zip`
  holds an identical copy. Run `--dry-run` first. `pnpm board restore <id> [--dry-run]` puts a
  compacted task back exactly as the `.zip` kept it. Replaced decisions (`vigente: false`) leave
  `pnpm board history` (`--todas` shows them) and the view's default history.

### Closing internals

- **Closing summary (d178)**:
  `cierre {resumen, pr?, commit?, comprobaciones, saltadas, pendientes, en, quien}` plus the T129
  lists `fallidas`, `riesgos`, `dudas`, `excepcion` and the typed `resultado`. A `pendiente` is
  stored as the task id; one without a task, with a task not on the board or pointing to itself is
  refused. The lock owner writes it; `--coordinador` completes it later (for example the merge
  commit), and flags not given keep their previous value. «Finalizadas» shows it above «Archivar»,
  the sheet shows it too, and `archive` is refused with «Falta el resumen de cierre» while it is
  missing or invalid. Tasks created under `contrato: 2` or later must name every T129 field or
  `close` and «Archivar» refuse; older tasks may add them. Tasks archived before d178 are left as
  they are; `unarchive` never needs it. `pnpm board verify` warns about each finished, unarchived
  task without a valid one.
- **Review close (d274)**: `close` of an open review round whose cierre has a verdict (any of the
  three: after `cambios` the next round is another task) moves it to `hecha` and frees its lock,
  keeping its session in `sesion`. An approved last round at the PR's current SHA shows its origin
  as «Lista para unir». Cancelling with `set <id> estado=cancelada --motivo=<reason>` writes the
  cierre in the same command (the reason is the summary); `review` cancels an open earlier round the
  same way when it opens the next one.
- **Close finishes (d290)**: outside review rounds, periodic tasks and finished tasks, a `close`
  whose cierre names the four Handoff lists moves the task to `en revision` when it has a PR (task
  `pr`, `--pr` or `resultado.pr`; the lock stays) and to `hecha` otherwise (the lock goes). A
  coordinator close over a live lock writes the cierre and keeps the estado.
- **Release note (T297)**: `close --changelog="<Grupo>: <una línea>"` stores
  `cierre.changelog {grupo, texto}` with a Keep a Changelog group (`Added`, `Changed`, `Deprecated`,
  `Removed`, `Fixed`, `Security`, any case); `--changelog=ninguno` stores `"ninguno"`. A close
  without the flag keeps the previous note. Lanes never edit `CHANGELOG.md` for it, so parallel
  branches do not conflict there; `pnpm board changelog [--desde=<fecha>]` prints the notes of
  `unida`/`comprobada` tasks as `[Unreleased]` Markdown (each bullet ends in its PR) and
  `--faltan [--archivo=CHANGELOG.md]` lists the ones `[Unreleased]` does not mention yet, exiting 1
  while any is missing. A compacted task (`compact`, archived 7+ days) no longer reports its note.
- **PR states**: `unida` always needs `pr`; `en revision` needs it only when the task has a `rama`
  (audits and handoffs go to review without one). The command refuses a pull URL from another
  repository.
- **Periodic tasks (d268)**: `close` of a started cycle (any open estado but `pendiente`) ends only
  that cycle: the task goes back to `pendiente` without its lock, `carril`, `pr`, `rama` or delivery
  mark (the lock's session stays in `sesion`), its PRs (the task's `pr` and the one this
  `close --pr` names, never one inherited from an earlier cierre) join `prsPrevios`, every `fecha`
  requisito moves forward by whole cycles until it is in the future (a task without one gets
  `now + cada`), and `close` prints `cada 7d: vuelve a pendiente hasta <fecha>`. A second `close`
  while it is `pendiente` keeps the date. The sync never matches a periodic task by id and skips the
  PRs in `prsPrevios`. Review rounds and finished tasks ignore `cada`.
- **Closing cleanup (d186)**: every write that leaves a task `comprobada` or `unida` moves its
  `prompt` to `.agent/tmp/board/mensual/<YYYY-MM>.zip` (`prompts/<id>.rev<n>.md`) and drops its
  `carril` and lock (the lock's session stays in `sesion`); the closing summary stays.
  `board:verify` warns when the prompt's «DÓNDE CORRE» section (in a `prompt-v1`, `ANTES DE EMPEZAR`
  and `carril:`; else the whole prompt) names a canonical lane other than the task's lane.
- **Findings to the author (d251, T212)**: `close --veredicto=cambios` writes one message about the
  origin task to its author (`authorOf`), from the reviewer, naming the round (`mensaje.revision`)
  and the author's session (`mensaje.sesion`), with every finding as `P2 archivo:línea texto`;
  closing again with the same findings writes nothing new. While the PR head is still the round's
  SHA the coordinator lists «Avisar al autor de T<n> (PR #n): T<m> pidió cambios en <sha7> y el PR
  sigue en ese SHA» (d269), and the row goes once the author pushes a new SHA (then «Nueva vuelta de
  revisión»).

### Review routing

- **Rounds**: `review` generates an English prompt and records `revisionSha` (from GitHub, or
  explicit `--sha`). Every round is a new task with `vuelta`, the short SHA in the title and its own
  prompt; from the second round on the prompt opens with «SEGUNDA VUELTA» («TERCERA»…), names the
  previous round's SHA and the new one and starts from `git diff <previous>..<new>`. d291
  (`rounds.mjs`): when the rounds since the last verdict have none (cancelled, or open and replaced
  now), the prompt reviews the whole PR instead and lists their bitácora messages, any findings in
  their cierre and the `.agent/tmp/reports/` paths they named. Earlier rounds are never rewritten,
  except that a still-open one is cancelled with its cierre (T129); the same SHA again creates
  nothing. `review` refuses an origin without a valid `cierre` and prints the
  `pnpm board close <id> …` to run first; `--coordinador` gets no bypass.
- **CI first (d288)**: before the merge preflight, `review` reads the head's `statusCheckRollup`
  (`reviewCi`, `ciOf`). Green creates the round; red refuses and names the failed checks; running or
  not started yet (no checks listed) polls every 30 s (`CELEBRA_BOARD_CI_POLL_MS`) with the board
  unlocked for `--espera-min` minutes (30 by default), then refuses with «la vuelta queda en
  espera». A PR whose workflows never start (GitHub lists no checks at all) gets its round with
  `--sin-ci` (T312): the round's bitácora row records it, and the flag is refused while any check
  exists, red, running or green.
- **Reviewer choice**: without `--agente` the reviewer follows d183: work by Codex or Gemini goes to
  Claude; low- and medium-risk work by Claude outside release (`tipo` or `categoria` `release`) goes
  to a Claude subagent (d288, printed with the author session's steps; `.agent/rules/` counts as
  high risk, d290); other work by Claude goes (d209, d240) to whichever of Gemini and Codex has less
  load (reviews open or updated in the last 7 days plus open normal tasks; a tie goes to Gemini),
  and to Gemini while Codex's last `rate_limits` in `~/.codex/sessions` shows ≥ 80 % weekly or ≥ 90
  % 5-hour use before its reset; the message prints the risk level, both loads and the quota. An
  explicit `--agente` always wins; any other pairing is refused (Claude on Claude's work only at low
  or medium risk). The author is the task's `agente`, else its lock's or last session's. `show` and
  the sheet list the rounds one below another. Reviews become executable before merge and do not
  inherit the author's lane. Completion declares `--sha=<reviewed SHA>`; the verifier compares it
  against the current PR head.
- **Reviewer duties**: a reviewer keeps its round's task and assigned reviewer, inspects the exact
  PR head of that round, binds findings and completion to the full SHA, and challenges scope,
  regressions, invariants and missing evidence. A finished chat or green CI is not independent
  acceptance. If Integration still runs an older CLI, use only its commands and a revision-checked
  task write; never copy candidate tooling into Integration to unlock a review.
- **Pre-flight**: before creating a round, `review` checks GitHub's open PR, current `headRefOid`
  and `mergeable`; an explicit `--sha` must still match that live head. Unavailable, malformed or
  `UNKNOWN` merge evidence is `UNVERIFIED` and refuses the round until retried. `CONFLICTING`
  refuses the round without replacing any earlier review and writes a bitácora message to the
  author's agent and recorded session. Read-only `git merge-tree` against GitHub's exact base and
  head supplies the conflict paths when those objects are local; unavailable paths are explicitly
  `UNVERIFIED`, never inferred from all changed files. No merge, fetch or checkout is performed by
  this pre-flight. An already existing round for the same SHA stays idempotent.
- **Review tiers**: review prompts classify the complete PR file inventory conservatively: Tier 0
  for metadata/docs (agile validation, a lightweight model suggested), Tier 1 for UI/frontend
  (interaction, accessibility and regression checks), Tier 2 for DB/auth/APIs and unclassified or
  incomplete file evidence (deep review). Mixed changes take the highest risk. These tiers guide
  review effort and never replace Gatekeeper validation tiers A/B/C or waive the task contract's
  required checks. Generated rounds record `revisionFiles` only from a complete GitHub inventory.
  From round 2 onward, focus on `prev.revisionSha..HEAD`, pinned in the prompt to the current full
  `revisionSha`; verify prior findings and expand to related context when necessary.

### Sync and hygiene

`pnpm board:sync [--dry-run] [--json] [--horas=<n>]` (the view's «Ver cambios» / «Sincronizar»
buttons) is a no-AI script: after `git fetch --prune origin` it reads `git worktree list`, local and
origin branches and `gh pr list --state all`, matches each open task by `pr`, then `rama`, then the
id convention, then the only open PR that names it canonically (d159: `T<n> <id>` in its title, or a
`Board task: T<n> <id>` body line; any other mention, or two such PRs, link nothing). A task with a
`rama` matches only a PR from that branch: a PR naming it from another head is reported as «rama …
sin PR, pero el PR #N (rama …) nombra la tarea», never linked. It writes only with
`pnpm board set --coordinador` at the rev it read: an open PR sets `pr` (and a missing `rama`) and
moves `pendiente`/`en curso`/`bloqueada` to `en revision`; a merged PR moves the task to `unida`.
**d170**: a merged PR also drops the task's lock, whoever holds it, through
`pnpm board merged <id> --coordinador`, which re-checks the PR is `MERGED` (finished tasks that
still hold a lock included). Closed-unmerged PRs, branches without a PR and locked tasks with an
open PR are only reported; review children are never touched. A lock older than `--horas` (default
`STALE_LOCK_HOURS` = 6 in `model.mjs`, the same threshold `pnpm board verify` warns at, or
`CELEBRA_BOARD_LOCK_HOURS`) whose branch got no commit on origin since `candado.desde` is flagged
«posible sesión cerrada» and never released by the sync (the owning session or the coordinator with
authority does).

**Hygiene (d268)**: after those writes, on the board as they left it, the sync moves every unlocked
`unida`/`hecha` task whose check passes (the verifier's `checkTask`; a PR state comes from the list
it already read) to `comprobada` with that `evidencia`, runs `compact --antes=7d` (it only
summarizes tasks the owner already archived) and `prune-backups --aplicar`, and detaches each free,
clean lane f05–f12 at `origin/develop` (`git switch --detach`), then deletes the branch it left with
`git branch -d` when `origin/develop` already contains it (a branch not merged there, or still
checked out elsewhere, stays and is reported). A lane is free when no lock and no open task's
`carril` holds it and it is detached or on a branch whose newest PR merged; a free lane with
uncommitted or untracked changes, or on a branch without a merged PR, is only reported. Right before
each switch, inside the store lock (so no `claim` can take the lane in between), the sync reads the
board, the lane's branch, HEAD and `git status` again and skips the lane, reporting why, when any
changed. `--dry-run` lists every step and writes nothing; the result carries them under `higiene`.
The sync never archives a task (d278).

### Checks and bitácora

- **Check**: without `chequeo`, the verifier uses `gh pr view <pr> --json state` → `MERGED`, or
  `git ls-remote origin <rama>` when there is no PR. Prefer structured `chequeo: {tipo: pr, pr: N}`
  or `{tipo: rama, rama: type/id}`. Legacy `cmd` is accepted only by the finite `commandArgs`
  grammar, executed as argument arrays without a shell. Arbitrary HTTP/API commands are rejected.
  Failures/timeouts/malformed PR responses are `UNVERIFIED`; inventory coverage is separate: check
  it before reading an empty PR or branch list as healthy. A review's `revisionSha` must match the
  PR head; a round a later round of the same task superseded only needs the PR state. Branch
  existence or MERGED alone does not prove every task criterion, and GitHub state never replaces
  task-specific validation or human acceptance.
- **Bitácora**: the command writes one row per `estado` change, per `move`, per `plan` and per
  archive or unarchive; no rows for reviews or notes. Rows live in one JSONL file per UTC day,
  `bitacora/2026-10-24.jsonl`: `{tarea, en, quien, corrio?, salio?}` plus exactly one change —
  `de`/`a` (estados, `archivada` for archive/unarchive, `''` before the task existed),
  `agente {de, a}` or `carril {de, a}` (`''` = none), or a `mensaje` (`pnpm board msg`). `quien` is
  required and is one of `claude`, `codex`, `gemini`, `coordinador`, `dueno`: `--quien`, else
  `--coordinador`, else `--agente` (in `move` and `review` `--agente` names the new agent or
  reviewer, so only `--quien`/`--coordinador` count); a write without it, or with an unknown estado,
  writes nothing. `pnpm board migrate-log [--dry-run]` converts the old one-file-per-row documents
  without dropping any: estados normalized, agent and lane hand-overs moved to their own field,
  `legado: true`, the file name in `archivo` and an unmapped `quien` kept as `quienTexto`; the old
  files move to `.respaldos/bitacora-legado/`. The verifier reports rows still in the old format and
  every invalid new row.
- **Prompt checks**: `board:verify` warns when a `prompt-v1`'s line 1 names another `T<n>` or lane.
  Prompts without `formato: prompt-v1` predate T160, keep their old layout (opening
  `T<n> · <título>`, or English «Follow .agent/rules/board.md…» for reviews) and are never
  rewritten. `pnpm board review` writes its prompts in `prompt-v1` too.

### Task kinds

`tipo` says what a task does (`codigo`, `revision`, `release`, `invitacion`, `creativo`,
`auditoria`, `operacion`); `categoria` only picks its lane. Each kind is one short
`.agent/kinds/<tipo>.yaml` (d290: `operacion` adds `operacion-cloudflare.yaml`, picked by the task's
`destino` and carrying a matching `destino` key): `lee` (routing-matrix `task_type` names, never
copied lists), `pasos_inicio`, `pasos`, `autorizado_por_defecto`, `no_hagas`, `pare_si`, `devuelve`
(the T129 `resultado` fields), `listo_si` (validation level), `al_terminar` (steps before the close
line) and the optional `tras_cierre` (steps after it: `codigo` puts there `pnpm board review`, d255;
`close` already left it `en revision`, d290). The coordinator writes only `busca` (the
`QUÉ SE BUSCA` text, with «Terminado cuando:») and, when the task needs them, `corto` (the session
name's description), `pasos`, `autorizo`, `noHagas`, `lee` and `decisiones` (dNNN ids; decisions
naming the task in `tareas` and `decision` requisitos count too). `add`, `set` and `plan` regenerate
the prompt-v1 when one of those fields, the lane or the branch changes, and refuse a hand-written
`prompt` on a typed task; `pnpm board prompt <id>` prints it and `--guardar --rev=<n>` saves it
after a decision or kind file changed. `board:verify` checks the kind files and warns when a saved
prompt is not the one its kind generates now. Session tasks created under `contrato: 3` need `tipo`;
older tasks and tasks without `tipo` keep their hand-written prompts. Review rounds from
`pnpm board review` get `tipo: revision` and keep the prompt `review` writes.

### Modules and write lock

`model.mjs` owns every rule more than one script needs — `isReview`, `isReadOnly`, `READONLY_LANE`,
lane checks (`laneAllowed`, `taskLane`), finished states (`isFinished`), `taskLabel`/`taskTag`,
`ordenOf`, the stale-lock threshold and PR parsing (`normalizePr`, `prNumber`, defined in
`pr-ref.mjs` and re-exported); `board`, `sync`, `verify`, `watch` and the view import them instead
of keeping a copy. Other owners: `store.mjs` the JSON store (one file per document); `subtasks.mjs`
subtasks, the calendar and the blocked list; `delivery.mjs` the delivered-prompt mark; `cierre.mjs`
the closing summary (`cierreIssues`); `changelog.mjs` the release note and its `[Unreleased]`
Markdown; `lane-session.mjs` the lane and git-safety checks of claim, close and release;
`claim-commands.mjs` the claim command; `scope-warnings.mjs` verify's shared-file warnings;
`recurring.mjs` periodic tasks; `reviewer.mjs` the reviewer choice; `review-preflight.mjs` the
review pre-flight; `kind-prompt.mjs` the prompts generated from task kinds; `live.mjs` what is read
live from Git and GitHub; `view-server.mjs`, `view-worker.mjs` and `view-supervisor.mjs` the view
and its SSE stream.

A worker's task claim is separate from the short-lived transaction lock (`.agent/tmp/board/.lock`)
each CLI write takes. That lock is never stolen only because it is old; after a writer crash the
coordinator recovers it as [Evidence and recovery](#evidence-and-recovery) says.
