---
name: release-prepare
description: |
  DEPRECATED stub. Release candidate prep and develop/main lane operations moved to branch-lane
  (mode release-prepare). Load .agent/skills/branch-lane/SKILL.md instead.
domain: workflow
version: 2.0.0
when_to_use:
  - Legacy trigger only — immediately load branch-lane
  - User asks to prepare a release or release candidate
  - Phrases like "prepara release", "version bump", "release candidate"
preconditions:
  - Read AGENTS.md
  - Load .agent/skills/branch-lane/SKILL.md
related_skills:
  - branch-lane
  - commit-planner
  - documentation-governance
related_docs:
  - docs/core/release-process.md
  - docs/core/git-governance.md
  - CHANGELOG.md
---

# Release Prepare (deprecated)

**Superseded by [`branch-lane`](../branch-lane/SKILL.md).**

Do not follow this file as an operational procedure. When this skill name is triggered:

1. Load `.agent/skills/branch-lane/SKILL.md`.
2. Run **Mode B — `release-prepare`** (or Mode A / Mode C if the user actually asked for sync or
   fast-forward promotion).
3. Ignore any cached copy of the old standalone release-prepare workflow.

Canonical home: `.agent/skills/branch-lane/SKILL.md`.
