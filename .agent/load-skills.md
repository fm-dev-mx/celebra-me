# Universal Skill Loading Protocol

This file defines how any agent (opencode, antigravity, codex, or other) loads and uses skills in
this repository.

## Prerequisites

Before loading skills, read:

- [`AGENTS.md`](../AGENTS.md) — entry point
- `.agent/index.md` — discovery map for all skills and workflows

## Loading Protocol

1. Load only the skills relevant to the current task (never preload all).
2. Follow `related_skills` links only when the task requires additional context.
3. Respect the frontmatter schema in `.agent/skills/SCHEMA.md`.

## Constraints

- Do NOT require global skills, provider-specific configuration, remote lock files, or remote
  loaders.
- Do NOT load skills from outside the repository.
- Do NOT assume a specific agent provider or runtime.
- If a skill contradicts the live codebase, the live codebase wins.
