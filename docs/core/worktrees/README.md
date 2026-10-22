# Worktree lanes

The executable source of truth is [`worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts).
External paths use the sibling `<repo-dir>-worktrees/` directory.

| Key | Lane                          | Runtime | Port |
| --- | ----------------------------- | ------- | ---- |
| F4  | Integration (repository root) | Local   | 4321 |
| F5  | `f05-plataforma`              | Local   | 4325 |
| F6  | `f06-landing`                 | Local   | 4326 |
| F7  | `f07-invitaciones`            | Local   | 4327 |
| F8  | `f08-demos`                   | Local   | 4328 |
| F9  | `f09-docs`                    | Local   | 4329 |
| F10 | `f10-libre`                   | Local   | 4330 |
| F11 | `f11-preview`                 | Preview | 4331 |
| F12 | `f12-release`                 | Preview | 4332 |

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
