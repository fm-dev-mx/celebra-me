# `.agent/tmp/` — Temporary Working Directory

`.agent/tmp/` contains ignored, short-lived execution artifacts. It is not a policy or authority
source; durable semantics live in [`.agent/rules/agent-routing.md`](../rules/agent-routing.md) and
the Handoff Contract in [`.agent/plans/README.md`](../plans/README.md).

## Lifecycle

- Create only task-scoped checkpoints, handoffs, or validation evidence that the owning workflow
  explicitly requires.
- Bind artifacts to the current worktree and invalidate them when their inputs or HEAD change.
- Delete task artifacts after verification; preserve them only when the owner explicitly requests
  retention.
- Never create a filesystem authorization marker. Git authority remains task-scoped and explicit.

## Point-in-time reports

`.agent/tmp/reports/` is the single location for point-in-time reports from every agent tool: Claude
sessions and subagents, Codex, the coordinator board and any other agent.

- Write to the directory in the **Integration checkout** (repository root), also from sessions that
  run in another worktree; lane and agent worktrees are removed, and their files with them. A
  session scratchpad is a draft area, not the report's home.
- Name each report `<YYYY-MM-DD>-<topic>.md`, for example `2026-10-16-git-audit.md`.
- Keep a report while it holds open owner decisions or pending actions. Once they are closed, move
  the durable outcome into policy, commits or plans, and delete the report.
- Generated evidence (screenshots, logs, JSON outputs of scripts) stays in the location its script
  defines; it is not a report.
- `handoffs/` is not a report location; it holds role-chain artifacts only.

## Privacy

Do not store secrets, credentials, tokens, connection strings, private client data, full
transcripts, large assets, screenshots, or generated logs. Use runtime-managed storage for
transcripts and the repository's designated evidence locations for approved artifacts.

The handoff directory is reserved for ephemeral role-chain artifacts and must remain empty when no
handoff is active. Its semantic fields follow the canonical Handoff Contract; it is not a second
template or source of truth.
