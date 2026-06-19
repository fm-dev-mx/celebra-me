# Git Safety Rule — Celebra-me

This rule defines the Git safety policy for all AI agents working in this repository.

See also the human-facing commit policy at `docs/core/git-governance.md` and the review/remediation
contract at `.agent/rules/gatekeeper.md`.

---

## Default Behavior

Agents **may**:

- Inspect the repository with read-only commands (read files, search, diff, log, status).
- Edit working tree files when the task requires it.

Agents **must not** perform Git operations that modify the index, history, stash state, branch
state, or unrelated working-tree files unless the user explicitly requests that exact Git operation
in the current task. Authorization is **task-scoped** — permission from a previous task does not
carry over.

---

## Git Write Operations (Forbidden Without Current-Task Authorization)

- `git add`
- `git add -A`
- `git add .`
- `git commit`
- `git commit --amend`
- `git restore --staged`
- `git reset`
- `git reset --hard`
- `git restore <file>`
- `git checkout -- <file>`
- `git clean`
- `git stash`
- `git checkout` or `git switch` when changing branches
- `git merge`, `git rebase`, `git cherry-pick`
- Any other command that changes HEAD, the index, branches, tags, history, stash state, or unrelated
  working-tree files.

---

## Safe Read Operations (Always Allowed)

- `git status`
- `git status --short`
- `git diff`
- `git diff --staged`
- `git diff --cached`
- `git log`
- `git show`
- `git rev-parse`
- `git branch --show-current`
- Other read-only Git inspection commands.

---

## Worktree State Is User-Owned

Pre-existing staged, unstaged, and untracked changes are user-owned state. Agents must:

- **Preserve** them during the session.
- Work only in the requested file-edit scope.
- **Not unstage** them unless explicitly authorized.
- **Not discard, reset, stash, clean, remove, or overwrite** them unless explicitly authorized.
- **Not auto-remediate** if staged state, unstaged changes, untracked files, or HEAD change
  unexpectedly — report the drift and ask the user.

Plan rollback snippets, release instructions, hook behavior, and cleanup guidance do not authorize
agents to run Git write operations. Authorization must come from the user's explicit request in the
current task.

---

## Agent Session Workflow

### Start Task

```sh
pnpm agent:git-safety:start
```

Captures current HEAD and a content hash of the staged state into
`.agent/tmp/git-safety-baseline.json`. The underlying command is:

```
node scripts/agent/git-safety.mjs start
```

### Before Final Report

```sh
pnpm agent:git-safety:check
```

Compares current staged state against the baseline. Fails if the staged state or HEAD changed
without authorization. If it fails, the agent must report the drift and ask the user how to proceed
— not auto-unstage. The underlying command is:

```
node scripts/agent/git-safety.mjs check
```

### Close Session (Still Before Final Report)

```sh
pnpm agent:git-safety:end
```

Removes the baseline file. Does not remove `.agent/tmp/allow-git-write`. The underlying command is:

```
node scripts/agent/git-safety.mjs end
```

---

## Authorization

Git write operations are authorized only when the user explicitly requests that exact Git operation
in the current task. The local marker file `.agent/tmp/allow-git-write` is only a harness signal for
an explicitly authorized current task. This file is unversioned and local-only, and its presence
must not be treated as standing permission for future Git write operations.

---

## Check Results

| Situation                                  | Result                                      |
| ------------------------------------------ | ------------------------------------------- |
| Staged state unchanged from snapshot       | PASS                                        |
| Staged state changed without authorization | FAIL — agent must report drift and ask user |
| Staged state changed with authorization    | PASS with warning                           |
| HEAD changed without authorization         | FAIL                                        |
| HEAD changed with authorization            | PASS with warning                           |
| No active session (no baseline)            | PASS (no session = no guard)                |
