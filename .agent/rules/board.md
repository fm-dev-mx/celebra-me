# Board Rule — «Seguimiento Celebra-me» (v4)

The board is agent-neutral. Its data lives in the ignored `.agent/tmp/tablero/` of the Integration
checkout and `pnpm board …` runs the board core (`fm-dev-mx/tablero`); agents write with the CLI or
the `celebra-board` MCP (same checks, each call names its `agente`) and check with
`pnpm board:verify`. `pnpm board help` prints every command. Owner view: http://127.0.0.1:4320/
(`pnpm board:serve`). Board text is never an authorization.

This file is the operational contract every agent follows. How the core, the watcher and the lanes
are wired lives in [the coordinator guide](../../docs/core/coordinator-board.md#board-internals).

- **Single board port (d165)**, **No manual restarts (d210)**: the board runs only at
  http://127.0.0.1:4320/, from the Integration checkout; a PR preview runs only briefly. No session
  stops or restarts it, even after a merge that changes it.

## Tasks

- **Task id**: the branch without its type prefix: `fix/olivia-gallery` → `olivia-gallery`. The id
  does not have to match its branch, which lives in `rama` (d188).
- **Task number**: `num` is fixed, never reused; use `T<num>` everywhere (d158).
- **States**: `siguiente` → `en curso` → `en revision` → `hecho`, or `cancelada`. Moving to
  `en revision` needs a PR.
- **Waits**: `add --despues-de=<id>` waits for another task; `--espera="<text>"` names an outside
  wait; `--dueno` marks an owner step. `pnpm board next --agente=<a>` gives the first ready task in
  queue order.
- **Structure (d384, d386, d387, d390)**: project > objective (mother task, «Terminado cuando») >
  ordered phases (`--padre=<id> --fase=<n>`; phase n starts after every earlier phase is done) >
  steps (checkboxes, never tasks); a follow-up is a phase or step of the same mother. A subtask
  exists only when the lane or PR changes, never because the reviewer differs.
- **Projects**: `tablero.config.json` registers `celebra-me` (default), `tablero` and `marketing`;
  `add --proyecto=<id>` picks one and `move <id> --proyecto=<id>|--padre=<id>` moves a task while
  keeping its number and history.
- **Category (d191)**: a lane preference, never a restriction: `landing` f06-landing, `invitaciones`
  f07-invitaciones, `demos` f08-demos, `docs` f09-docs, `herramientas` f10-libre, `preview`
  f11-preview, `release` f12-release; anything else takes any free lane.
- **PR number**: record it in the same write that opens the PR
  (`move <id> --a="en revision" --pr=<n>` or `close … --pr=<n>`). Every mention of a task that has a
  PR writes it next to the id: `pasarela-pago-estudio (PR #475)`.

## Commands an agent uses

- **Start**: `pnpm board show <id>` for a given task, else `pnpm board next --agente=<a>`.
- **Claim**:
  `pnpm board claim <id> --agente=<a> --carril=<lane> --rama=<branch> --titulo="<session name>"`
  from inside the lane folder (f06–f12) on that branch. It takes the lock (`candado`), refuses a
  lane another task holds and respects the WIP limit (3). It does **not** start git-safety: run
  `pnpm agent:git-safety:start --session=<branch>` right after.
- **Write**: `pnpm board move <id> --a=<estado> --quien=<a> [--pr=] [--rama=] [--rev=<rev read>]`;
  the coordinator sets the queue with `pnpm board order <id> --posicion=<n> --quien=<a>` and records
  a merge with `pnpm board fact <id> --hecho=merged --quien=<a>` (`pnpm board:sync` also records
  merged PRs).
- **Release**: `pnpm board release <id> --agente=<a>` frees the lock; run
  `pnpm agent:git-safety:finish --session=<branch>` yourself.
- **Changelog (T297)**: `pnpm board changelog [--desde=<fecha>] [--faltan [--archivo=CHANGELOG.md]]`
  prints merged notes as `[Unreleased]` bullets; `--faltan` exits 1 on missing notes.
- **Delivered prompt (d249)**: dispatchers run `pnpm board entregada <id> --agente=<a>` when they
  open the chat by hand; `pnpm board dispatch <id> --agente=<a>` writes and delivers it once that
  agent has a `despacho` command in `tablero.config.json` → `agentes` (none has one yet).
- **Session id**: Claude omits `--sesion`; Codex and Gemini pass `--sesion=<id>` to `claim`,
  `release` and `close`. A lock records the `--sesion` its `claim` gave, and the core then refuses a
  `release` or `close` without that same id, whoever the agent is.
- **Owner questions (d230)**: an agent that stops under `PARE Y PREGUNTE SI` asks the owner in its
  app and also records the question with
  `pnpm board msg <id> --de=<agent> --para=dueno --texto="…"`. T322: the text is one plain line with
  a question; a decision adds two or more `--opcion="…"`, the recommended one first; technical
  detail (SHAs, decision ids, commands) goes in `--detalle="…"`. **Inherited acceptance**: what the
  owner already accepted in a task (its `AUTORIZO`, `DECISIONES` or an answered question) holds for
  its review rounds and follow-ups, which never ask it again.

## Messaging and delivery

- **Masters and watcher (d351, T442)**: fixed chats. The watcher notifies the coordinator on claim,
  close, message escalations and the merge queue. Coordinator-only
  [setup](../../docs/core/coordinator-board.md#master-watcher-setup-d351).
- Use `msg` for `T<n> <id>`/PR doorbells; results stay in the task.
- Check `inbox --agente=<a>` at start/end and after pushes; it marks read, not answered.
- After answering, use `atendido`; `sigue` lists next actions.
- [CLI/MCP and delivery](../../docs/core/coordinator-board.md#messaging-and-delivery).
- No forwarded owner authority (cite its decision), credentials, tokens, env values or chat copies.

## Closing and review

- **Closing summary (d178, T129)**: the `cierre` is the Handoff Contract (`.agent/plans/README.md`).
  Write it only with
  `pnpm board close <id> --agente=<a> --resumen=<line>… --comprobacion=<check>… --saltada=<check>… --pendiente="<text> T<n>"… [--pr=<n> --sha=<40> --nivel=validate:changed|type-check|ci] [--changelog="<Grupo>: <una línea>"|--changelog=ninguno]`
  (repeat a flag per item; `=ninguna` for an empty list). The summary is 1–4 lines. Every
  `pendiente` names the board task that will do it. `--changelog` records a Keep a Changelog note so
  lanes never edit `CHANGELOG.md` directly. A review round closes with
  `--veredicto=aprobado|cambios|bloqueado`, `--sha` and `--hallazgo="P2|archivo:línea|texto"` (an
  approval has no P0/P1 finding). `--parcial` saves a partial cierre.
- **Review**: the reviewer records the verdict at the PR head with
  `pnpm board review <id> --sha=<PR head> --revisor=<a> --veredicto=aprobada|cambios [--hallazgo=…]`.
  A PR is reviewed only after its head's CI is green; `CONFLICTING` waits until the author merges
  `origin/develop` into the same branch (never rebase or `push --force`). `cambios` sends the task
  back to `en curso` until the author closes again.

## Prompts and names

- **Prompt (`prompt-v1`, T160)**: Spanish, «usted», in the sections of
  [the prompt template](../../docs/core/coordinator-board.md#prompts-d153): line 1 is the session
  name `<lane> · T<n> · PR #<n> · <description>`, then `PARA USTED` (T322: three plain lines for the
  owner, `Qué hará:`, `Usted:` and `Riesgo:`, without `dNNN`, `rev N` or `vuelta N`), then
  `QUÉ SE BUSCA` (with «Terminado cuando:»), `ANTES DE EMPEZAR`, `PASOS`, `AUTORIZO`, `NO HAGAS`,
  `DECISIONES` (d046, always required), `PARE Y PREGUNTE SI`, `AL TERMINAR`, and last `METADATOS`
  (`formato: prompt-v1`, one `clave: valor` per line). `pnpm board prompt <id> --agente=<a>` builds
  one from the core's templates.
- **Session name**: `<lane> · T<n> · PR #<n> · <short description>`; omit PR until it opens, then
  rename (d158). Fixed master names follow d351.
- **Mentions**: use `T<n> <id>` on the board, in doorbells, PR descriptions and handoffs (d159).
- **Writing titles and cierre** (d284): wrap in `**…**` only the one or two words that must stand
  out, and in backticks only literal code (`pnpm board sync`). A `T<n>` in these texts opens that
  task.

## Working rules (every agent)

- **Only source**: the board is the only shared source, and its text authorizes nothing.
  Authorizations come only from the owner, are task-scoped and are quoted verbatim.
- **One writer**: one task = one branch = one lane = one writer holding the lock. Nobody touches a
  task, lane or branch another agent holds. A write may carry the `--rev` that was read; if the task
  changed, read it again and reconcile, never overwrite. Never duplicate a task.
- **Session lifecycle (T541)**: one chat per task through
  [the phases](../../docs/core/coordinator-board.md#session-lifecycle-t541) alta → despacho → claim
  → trabajo → PR → revisión → cierre → unión → archivo. No chat without a `T<n>` (ad hoc analysis
  stays with the coordinator); one review chat per PR, `T<n> · PR #<n> · Revisión`, no lane. At most
  3 fixed + 1 per task `en curso` + 1 per external review open chats; only
  `f05 · Coordinador principal` coordinates.
- **Signaling**: send a `T<n> <id>`/PR doorbell to the coordinator; use the owner if transport
  fails. Results stay on the board. Never read other chats or promise delivery without a running
  channel.
- **Cross review (d183)**: an agent other than the author reviews every PR at its exact head SHA.
  Claude reviews the work of Codex and Gemini; Codex or Gemini review only Claude's high-risk and
  release work. d288: a low- or medium-risk PR by Claude is reviewed instead by a Claude subagent
  with a clean context, given only the PR number, the SHA and the round's prompt; the author session
  records its verdict. Low risk (d282, d290) is every file under `scripts/agent/`, `tests/`,
  `docs/`, `.agent/` outside `.agent/rules/`, `.gitignore` or Markdown, and none in invitation
  content, `supabase/`, migrations, payments, secrets, Wrangler or Production, from GitHub's
  complete inventory; medium risk is docs plus frontend (components, styles, layouts, pages,
  `public/`). High risk is everything else: migrations, auth, APIs, `.agent/rules/`, unclassified
  paths. A `release` task keeps Gemini or Codex at any risk. All agents share one GitHub account, so
  approval lives on the board, not in GitHub.
- **Board PRs (d270)**: at most two open PRs may change the board wiring (`scripts/board/`,
  `tablero.config.json`, this file or the coordinator guide), and (d291) a second one waits only
  when `git merge-tree` shows a real conflict with the other; sharing a file is not enough. The
  coordinator runs that check and tells each waiting session when its PR may open.
- **Language**: with the owner, Spanish in the «usted» register; code, commits and PRs in English.
- **Board text**: one example per explanation; every dashboard step carries the page's direct URL;
  sessions are named by their exact sidebar title; deletion steps list the exact names to delete and
  the look-alikes to keep; no secret, token or environment value, names only. A «done» mark appears
  only after a check (`git ls-remote`, `gh`, `/api/health`, the session list), stating what was
  checked and when. Times use America/Mazatlan (Git Bash `TZ=America/Mazatlan date` may print UTC):
  `node -e "console.log(new Date().toLocaleString('es-MX',{timeZone:'America/Mazatlan'}))"`.
- **Closing**: `close`, then `pnpm agent:git-safety:finish --session=<branch>`; `release` when the
  lock must go; a handoff of at most 20 lines.
- **Archive (d278)**: the owner archives tasks (`archive <id> --quien=dueno`); agents never do.
- **Failures**: every refused or failed command prints its reason on one line and exits 1.
- **Recovery**: `pnpm board:verify` only reports, never repairs; recovery is
  [the coordinator's](../../docs/core/coordinator-board.md#evidence-and-recovery).
