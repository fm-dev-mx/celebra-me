# `.agent/tmp/` — Temporary Working Directory

This directory stores short-lived files created during agent tasks. Everything under `.agent/tmp/`
is ignored by git except this README.

## Conventions

| Path                          | Purpose                                                                | Lifecycle                                          |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `handoffs/<task-id>/`         | Structured handoff between sequential delegated tasks                  | Delete after task completes                        |
| `branch-lane-checkpoint.json` | Partial read-only branch-lane evidence (SHAs/hashes + check summaries) | Overwritten or deleted on invalidate / session end |
| `branch-lane-clearance.json`  | Write-ready branch-lane clearance fingerprint (SHAs/hashes only)       | Overwritten or deleted on invalidate / session end |
| Other files/dirs              | Scratch work, scripts, screenshots, QA artifacts                       | Not tracked; clean up manually                     |

`branch-lane-checkpoint.json` and `branch-lane-clearance.json` must never contain credentials,
connection strings, dumps, or PII. They are bound to repository/worktree identity and are
invalidated when mode, SHAs, working tree, sensitive-file set, or audit contract version change.

**Checkpoint** = reusable partial discovery/audit progress (blockers may remain). **Clearance** =
validated evidence permitting the next authorized write.

## Structured Handoffs

For sequential delegation (copywriter → builder → QA), use `.agent/tmp/handoffs/<task-id>/` to pass
approved outputs:

- `approved-copy.json` — copywriter output approved by the orchestrator
- `visual-direction.md` — visual direction approved by the orchestrator
- `implementation-spec.md` — spec for the builder
- `qa-checklist.md` — quality review expectations

See `celebra-delegation-patterns` skill for full guidance.

## Restrictions

Do NOT store in `.agent/tmp/`:

- Secrets, credentials, API keys
- Private client data (PII)
- Large assets, generated images, screenshots (use `screenshots/` or `logs/`)
- Full subagent transcripts (use runtime-managed transcript storage)
- Anything that should be version-controlled

## Cleanup

Delete `handoffs/<task-id>/` after the task is complete and verified. Preserve only if the user
explicitly asks to keep the handoff for reference.
