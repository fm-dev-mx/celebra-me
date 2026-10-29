# Agent permission adapters

The versioned source is [policy.json](../permissions/policy.json). Generate native approval rules
with `pnpm agent:permissions` (dry-run). Only the owner or an explicitly authorized coordinator runs
`pnpm agent:permissions -- --apply`. Implementation and review sessions must not apply it to the
owner's configuration. See [the runbook](../../docs/core/agent-permissions.md) for targets, backups,
reapplication and coverage limits.

An `allow` entry reduces host approval prompts; it never grants task authority. Reuse the current
task's explicit `AUTORIZO` and answered decisions without asking again. Ask only for missing scope,
an applicable safety gate, or unexpected protected-state drift. Preserve Git Safety, task/lane
ownership, environment boundaries and all non-overridable repository rules.

Always deny forced pushes, pushes to `main`, agent Production mutations, unguarded migrations and
reading `.env*`, `.secrets/`, `.vercel/` or `.backups/`. `gh pr merge` is denied for Codex/Gemini
and routed to interactive Ask for Claude so the coordinator can merge approved PRs with owner
approval; it is never auto-allowed. Native syntax cannot enforce every form of these operations. In
particular, Codex prefix rules cannot express path-based file denies or arbitrary argument
positions. Never interpret an adapter's coverage gap as permission. Keep the repository's guarded
workflows and host sandbox/file-access controls in place.

Do not enable bypass/YOLO/Turbo modes, weaken existing denies, install an unverified App/IDE
configuration key, or remove user-owned approvals as part of synchronization.
