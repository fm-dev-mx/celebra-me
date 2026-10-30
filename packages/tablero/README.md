# tablero

A small task board for one project: tasks as JSON files, every change as one JSONL log line, an
owner inbox, and a local page that updates over SSE. Nothing in the package names a project; all
project specifics live in `tablero.config.json`.

```bash
node packages/tablero/src/cli.ts timeline
node packages/tablero/src/cli.ts serve          # http://127.0.0.1:<puerto>
node packages/tablero/src/cli.ts migrate --dry-run
```

Run `node packages/tablero/src/cli.ts help` for every command. Node 22.18+ runs the TypeScript
sources directly; there is no build step and no runtime dependency.

## Model

- **States:** `siguiente`, `en curso`, `en revision`, `hecho`, `cancelada`.
- **`orden`:** integer position in the `siguiente` queue, kept contiguous. Only the actors listed in
  `ordenan` may reorder. Positions given to `order` count the visible Siguiente strip.
- **`espera`:** a dependency (`{ "tarea": "<id>" }`) or an external condition
  (`{ "externa": "<text>", "hasta"?: "<ISO date>", "dueno"?: true, "cumplida"?: true }`). A task
  waiting only on external conditions is shown under **Estacionadas**.
- **Reviews** are records inside the task
  (`revisiones: [{ sha, revisor, veredicto, hallazgos, en }]`).
- **Merged / verified** are facts in the log, not states.
- **WIP:** starting a task fails when `wipMax` tasks are already `en curso`.
- **Concurrency:** writes take a lock file and accept an optional `rev` for optimistic checks.

## Owner inbox

| Type      | Row shows                                | Answers                   |
| --------- | ---------------------------------------- | ------------------------- |
| `decidir` | question and 2+ options                  | one of the options        |
| `aprobar` | «Ver PR» link                            | `aprobar`, `cambios`      |
| `hacer`   | something the owner does outside the app | `hecho` (clears the wait) |

Repeated questions for the same task collapse into one row. `inbox sync` opens a `hacer` row for
every owner wait (`dueno: true`) whose date has come.

## Modules

| Path                       | Role                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `src/core/model.ts`        | task type, transitions, waits, review records                              |
| `src/core/order.ts`        | queue ordering                                                             |
| `src/core/inbox.ts`        | inbox rows, answers, owner waits, counts                                   |
| `src/core/store.ts`        | JSON files + JSONL log on disk, lock, WIP, `rev` checks                    |
| `src/core/timeline.ts`     | the one projection: Hecho by day, En curso, Siguiente, Estacionadas, inbox |
| `src/view/`                | page and SSE server, bound to 127.0.0.1 only                               |
| `src/mcp/server.ts`        | read-only MCP server on stdio (`timeline`, `show`, `inbox`)                |
| `src/adapters/github.ts`   | `RepoHost` interface; minimal `gh` CLI implementation                      |
| `src/adapters/telegram.ts` | `Notificador` interface; sends counts and public `aviso` texts only        |
| `src/config.ts`            | config loading and validation                                              |
| `src/migrar.ts`            | dry-run import from a one-file-per-task legacy layout; never writes        |

## Data layout

```
<datos>/tareas/<id>.json      one task per file
<datos>/bitacora/<day>.jsonl  append-only log
<datos>/bandeja.json          owner inbox rows
```

## `tablero.config.json`

| Key           | Type                          | Default           | Notes                                        |
| ------------- | ----------------------------- | ----------------- | -------------------------------------------- |
| `proyecto`    | string                        | required          | the only project text sent in notifications  |
| `datos`       | relative path                 | required          | resolved against the config file             |
| `puerto`      | 1024–65535                    | required          | page port on 127.0.0.1                       |
| `wipMax`      | 1–50                          | 3                 |                                              |
| `hechoDias`   | 1–365                         | 7                 | days shown in Hecho                          |
| `zonaHoraria` | IANA zone                     | UTC               | groups Hecho by local day                    |
| `ordenan`     | string[]                      | `["coordinador"]` | actors allowed to reorder                    |
| `carriles`    | `{ id, carpeta?, puerto? }[]` | `[]`              | work lanes                                   |
| `tiposPrompt` | string[]                      | `[]`              | prompt kinds tasks may declare               |
| `github`      | `{ repo: "owner/name" }`      | —                 | enables the GitHub adapter                   |
| `telegram`    | `{ tokenEnv, chatEnv }`       | —                 | names of environment variables, never values |
| `migracion`   | `{ desde: relative path }`    | —                 | source for `migrate --dry-run`               |

See `tablero.config.example.json`.
