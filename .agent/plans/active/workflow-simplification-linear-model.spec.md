---
title: Workflow Simplification — Two-Branch Linear Model with Tags
status: active
plan_type: documentation, implementation
autonomy_level: 2
created: 2026-06-28
updated: 2026-06-28
related_rules:
  - .agent/rules/git-safety.md
  - .agent/rules/gatekeeper.md
  - .agent/rules/workflow.md
related_docs:
  - docs/core/git-governance.md
  - docs/core/architecture.md
  - CHANGELOG.md
supersedes: []
superseded_by: []
---

# Workflow Simplification — Two-Branch Linear Model with Tags

## 1. Goal

Replace the previous branch-per-task workflow with a simpler linear model: **`develop` as the active
trunk**, **`main` as a protected production branch**, and **annotated tags as the sole version
markers**.

## 2. Implemented Policy

### Branches

| Branch         | Role                  | Direct Commits Allowed                        | Push to Remote Allowed                                         |
| -------------- | --------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| `develop`      | Active trunk          | ✅ Yes (commitlint + lint-staged still apply) | ✅ Yes                                                         |
| `main`         | Protected production  | ❌ Blocked by pre-commit hook                 | ❌ Blocked by pre-push hook (override: `ALLOW_MAIN_PUSH=true`) |
| Other branches | Short-lived, optional | ✅ Yes                                        | ✅ Yes                                                         |

### Agent Behavior

- Work on `develop` by default.
- Do not create branches automatically.
- Use `git pull --rebase` for synchronization.
- Prefer fast-forward promotion (`git merge --ff-only`) from `develop` to `main`.
- Never force-push without explicit approval.
- Never delete branches without inventory, archive-tag strategy, and explicit approval.

### CI

- `commit-validation.yml` runs on **push to `develop`** and on **pull requests targeting `main`**.

### Versioning

- All versions are annotated tags (`git tag -a vX.Y.Z`).
- `CHANGELOG.md` is the human-readable release history.
- No `release/*` or `chore/release-into-main-*` branches should be created going forward.

### Overrides

- Commit to `main`: `SKIP_BRANCH_PROTECTION=true git commit`
- Push to `main`: `ALLOW_MAIN_PUSH=true git push origin main`

## 3. Validation Requirements

### 3.1 Hook Integrity

| Check                        | Method                                                                         | Expected                                           |
| ---------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `main` is still protected    | `git checkout main && git commit --allow-empty -m "test"`                      | ❌ Blocked by pre-commit hook                      |
| `develop` allows commits     | `git checkout develop && git commit --allow-empty -m "test(workflow): verify"` | ✅ Commit goes through                             |
| `commit-msg` still validates | `git commit --allow-empty -m "not conventional"`                               | ❌ Blocked by commitlint                           |
| `lint-staged` still runs     | `git commit --allow-empty -m "test(workflow): verify lint-staged"`             | ✅ lint-staged runs                                |
| `main` push is blocked       | Simulated via hook inspection (not executed)                                   | `.husky/pre-push` contains `refs/heads/main` guard |
| `develop` push is allowed    | `.husky/pre-push` analysis                                                     | No guard blocking `develop`                        |

> **Note:** Live hook tests use `--allow-empty` commits only, no files outside the repository. Any
> successful test commit must be rolled back immediately with:
>
> ```bash
> git reset --soft HEAD~1 && git checkout develop
> ```

### 3.2 Documentation Consistency

| Check                                             | Method                                                    | Expected                                            |
| ------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| AGENTS.md no longer forbids develop               | `grep "forbidding direct commits" AGENTS.md`              | No match for "forbidding direct commits to develop" |
| git-governance.md references only main protection | `grep -i "branch protection" docs/core/git-governance.md` | References only `main`, not `develop`               |
| workflow.md exists and is correct                 | `cat .agent/rules/workflow.md`                            | Valid YAML frontmatter, correct policy              |

## 4. Files Changed

| File                                                               | Change                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.husky/pre-commit`                                                | Removed `develop` from branch protection check. Only `main` is blocked now.                                                                                                                                                                               |
| `.husky/pre-push`                                                  | Added `refs/heads/main` push guard with `ALLOW_MAIN_PUSH=true` override. Moved `ZERO_SHA` before first loop.                                                                                                                                              |
| `.github/workflows/commit-validation.yml`                          | Added `push: { branches: [develop] }`. PR trigger now targets only `main`.                                                                                                                                                                                |
| `AGENTS.md`                                                        | Line 40: replaced "Do not commit directly to `main` or `develop`; use a feature branch" with "Work directly on `develop` by default. Do not commit directly to `main`. Use short-lived branches only when complexity or the task explicitly requires it." |
| `docs/core/git-governance.md`                                      | Overview now describes two-branch linear model. Active Validation Sequence updated. Guarantees section: only `main` is protected. Added Production Promotion section with fast-forward flow.                                                              |
| `.agent/rules/workflow.md`                                         | **Created.** Defines operational Git workflow for agents: working branch, integration method, safety rules, versioning, overrides.                                                                                                                        |
| `.agent/plans/active/workflow-simplification-linear-model.spec.md` | Updated to reflect implemented policy. (This file.)                                                                                                                                                                                                       |

## 5. Remaining Decisions Before Branch Cleanup

| #   | Decision                                        | Status                              |
| --- | ----------------------------------------------- | ----------------------------------- |
| 1   | Branch cleanup (88 local branches)              | Deferred to future task             |
| 2   | Keep/delete `release/internal-editor-prod`      | Pending                             |
| 3   | Keep/delete `checkpoint/broad-section-refactor` | Pending                             |
| 4   | Keep/delete `feature/intake-core`               | Pending                             |
| 5   | Vercel production branch confirmation (`main`?) | Pending — requires dashboard access |

Branch cleanup was explicitly scoped out of this implementation task.

## 6. Rollback

Every changed file is tracked in git. Rollback is a single checkout:

```bash
git checkout origin/develop -- \
  .husky/pre-commit \
  .husky/pre-push \
  .github/workflows/commit-validation.yml \
  AGENTS.md \
  docs/core/git-governance.md \
  .agent/rules/workflow.md \
  .agent/plans/active/workflow-simplification-linear-model.spec.md
```
