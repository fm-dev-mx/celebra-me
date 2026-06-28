# Agent Workflow Rules — Celebra-me

**Status:** Active **Last Updated:** 2026-06-28

This document defines the operational Git workflow for AI agents in this repository.

---

## Core Workflow

The repository uses a **linear two-branch model**:

- **`develop`** is the active trunk for daily development. Work here by default.
- **`main`** is the protected production branch. Never commit or push directly to `main` without
  explicit override.
- **Annotated tags** (`vX.Y.Z`) mark versions and checkpoints, not branches.

---

## Agent Rules

### Working Branch

- Work on the current branch, normally `develop`.
- Do not create feature, fix, chore, deps, release, checkpoint, backup, or any other branches
  automatically. Branches are an exception for complex or explicitly requested work, not the
  default.
- If a short-lived branch is genuinely needed, clean it up immediately after merging.

### Integration Method

- Do not use `git merge` as the default integration method.
- Use `git pull --rebase` for synchronization with upstream.
- Prefer `git rebase` for integrating local changes onto an updated `develop`.
- Prefer **fast-forward-only** promotion (`git merge --ff-only`) from `develop` to `main`.

### Safety Rules

- Never force-push (`git push --force` or `git push --force-with-lease`) without explicit user
  approval.
- Never rewrite `main` or shared history without explicit approval.
- Never delete local or remote branches without:
  1. A complete inventory of what exists.
  2. An archive-tag strategy to preserve branch tips.
  3. Explicit user approval for each batch.
- Branch cleanup is always a separate, explicitly approved operation — never bundled with
  implementation work.

### Versioning

- Use annotated tags for versions and checkpoints: `git tag -a vX.Y.Z -m "..."`
- Tag names follow semantic versioning: `v<major>.<minor>.<patch>` or
  `v<major>.<minor>.<patch>-beta.<N>`
- Do not create `release/*` or `chore/release-into-main-*` branches for releases.
- Update `CHANGELOG.md` before tagging a release.

### Overrides

- Commit to `main` override: `SKIP_BRANCH_PROTECTION=true git commit`
- Push to `main` override: `ALLOW_MAIN_PUSH=true git push origin main`
- These overrides require explicit user direction — never use them autonomously.

---

## Relationship to Other Rules

| Rule                          | Relationship                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agent/rules/git-safety.md`  | Git write operations still require explicit user authorization. Workflow rules define _which_ operations are correct; git-safety defines _when_ they are allowed. |
| `AGENTS.md`                   | Entry point — workflow rules flesh out the "Work directly on `develop` by default" policy.                                                                        |
| `docs/core/git-governance.md` | Human-facing policy document. These rules are the agent-facing operational version.                                                                               |
