# `.agent/tmp/` — Temporary Working Directory

This directory stores short-lived files created during agent tasks.
Everything under `.agent/tmp/` is ignored by git except this README.

## Conventions

| Path | Purpose | Lifecycle |
|---|---|---|
| `handoffs/<task-id>/` | Structured handoff between sequential delegated tasks | Delete after task completes |
| Other files/dirs | Scratch work, scripts, screenshots, QA artifacts | Not tracked; clean up manually |

## Structured Handoffs

For sequential delegation (copywriter → builder → QA), use
`.agent/tmp/handoffs/<task-id>/` to pass approved outputs:

- `approved-copy.json` — copywriter output approved by Jeremías
- `visual-direction.md` — visual direction approved by Jeremías
- `implementation-spec.md` — spec for the builder
- `qa-checklist.md` — quality review expectations

See `celebra-delegation-patterns` skill for full guidance.

## Restrictions

Do NOT store in `.agent/tmp/`:
- Secrets, credentials, API keys
- Private client data (PII)
- Large assets, generated images, screenshots (use `screenshots/` or `logs/`)
- Full subagent transcripts (Hermes cache handles these)
- Anything that should be version-controlled

## Cleanup

Delete `handoffs/<task-id>/` after the task is complete and verified.
Preserve only if the user explicitly asks to keep the handoff for reference.
