# Cheat sheet — `db:sync` (automation facade)

**Purpose:** Diagnose / compare / plan / apply invitation **content** by delegating to domain
engines. Not schema migrate, Git `lane:sync`, or dump restore.  
**User:** Agents/automation primary; humans should prefer specialized CLIs for mutations.  
**Prerequisites:** Credentials per direction; write targets schema `CURRENT`; headless apply needs
`--expected-plan` + `--apply` + `--no-interactive`.

## Commands

```bash
pnpm db:sync -- --mode diagnose --strict --json
pnpm db:sync -- --mode compare --slug <slug> --event-type boda --envs local,preview
pnpm db:sync -- --mode plan --direction definition-to-preview --slug <slug> --package <path>
pnpm db:sync -- --mode apply --direction … --expected-plan <id> --apply --no-interactive
```

TTY wizard remains a **compatibility window** (Cancelar default). Prefer explicit `--mode`.

**Expected result:** Read-only modes emit evidence; apply revalidates plan identity then delegates
(`invitation-content-apply`, promotion orchestrator, or Preview mirror).

**Failures:** `FORBIDDEN_DIRECTION`, `SCHEMA_INCOMPATIBLE`, `PLAN_DRIFT` / `PLAN_EXPIRED`,
availability blockers, delegated auth failures.

**Recovery:** Rebuild plan from current evidence. Schema behind →
[schema-migrate](./schema-migrate.md). Human Local/Preview edits →
[invitation-update](./invitation-update.md). Production content →
[promote-cheatsheet](../../intake/promote-cheatsheet.md).
