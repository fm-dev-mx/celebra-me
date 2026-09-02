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
- Never create `allow-git-write` or another filesystem authorization marker. Git authority remains
  task-scoped and explicit.

## Privacy

Do not store secrets, credentials, tokens, connection strings, private client data, full transcripts,
large assets, screenshots, or generated logs. Use runtime-managed storage for transcripts and the
repository's designated evidence locations for approved artifacts.

The handoff directory is reserved for ephemeral role-chain artifacts and must remain empty when no
handoff is active. Its semantic fields follow the canonical Handoff Contract; it is not a second
template or source of truth.
