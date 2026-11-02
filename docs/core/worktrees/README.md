# Worktree lanes

The single source of truth is `tablero.config.json`: `carriles` lists each lane's id, folder, key
(`tecla`), port, name and runtime (`entorno`), and `carrilesRetirados` lists folders that stay on
disk but take no tasks. The board and [`worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)
(guards, ports, doctor, VS Code task runner) both read it; only Integration is defined in code.
Adding or retiring a lane is one pull request that edits that file. External paths use the sibling
`<repo-dir>-worktrees/` directory.

| Key | Lane                          | Use          | Runtime | Port |
| --- | ----------------------------- | ------------ | ------- | ---- |
| F5  | Integration (repository root) | Coordination | Local   | 4321 |
| F6  | `f06-landing`                 | Generic      | Local   | 4326 |
| F7  | `f07-invitaciones`            | Generic      | Local   | 4327 |
| F8  | `f08-demos`                   | Generic      | Local   | 4328 |
| F9  | `f09-docs`                    | Generic      | Local   | 4329 |
| F11 | `f11-preview`                 | Preview      | Preview | 4331 |
| F12 | `f12-release`                 | Release      | Preview | 4332 |

The board assigns tasks only to these lanes: four generic lanes for a WIP of three, plus Preview and
release. A task's category never binds a generic lane.

Win + F4 opens the separate board project (`tablero`), not a lane. `f05-plataforma` and `f10-libre`
are retired (`carrilesRetirados`, owner 2026-10-31): their folders stay, the guards treat them as
unknown and refuse sessions there, and the worktree sweep (`pnpm ops:status`) does not flag them for
removal.

Roles are defaults, not permissions or domain restrictions. Explicit assignment and scoped
authorization are required before inspecting or changing a second checkout. Clean or detached does
not establish idle task ownership. Never allocate a lane or create a new directory automatically.

Local lanes use their own `.env.local` and share the protected persistent Local database. F11 and
F12 require a Preview overlay. No lane grants Production authority. Do not copy real configuration
as part of lane code validation or distribute Production/E2E credentials through bulk sync.

Specialized cards: [Integration](integration.md), [F11](f11-preview.md), [F12](f12-release.md). Task
lifecycle and release preparation follow [Git governance](../git-governance.md).

Temporary and unknown checkouts are read-only; mutable-session and commit guards refuse them.
Existing work remains user-owned. Cleanup, movement and migration require separate authorization.
