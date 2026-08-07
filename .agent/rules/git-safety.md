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

Without explicit current-task authorization for that exact operation, do not:

- stage or unstage (`git add`, `git restore --staged`, pathspecs that alter the index);
- commit or amend;
- create or switch branches (`git checkout` / `git switch` when changing branches; branch create);
- stash or apply/drop stashes;
- restore or checkout files in a way that discards working-tree changes;
- reset or clean;
- merge, rebase, or cherry-pick;
- push or otherwise update remotes;
- create a pull request;
- otherwise mutate Git state (HEAD, index, branches, tags, history, stash, or unrelated
  working-tree files).

If an otherwise restricted action is explicitly authorized for the current task, perform only that
authorized operation and do not infer adjacent permissions.

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

## Four-Lane Worktree Structure & Path Privilege Invariant

The repository operates with four native Git worktree lanes:

- **Integration**: canonical root worktree (the repository root, trunk `develop`). Runtime default: Local.
- **dev-local**: persistent reusable worktree in the sibling `<repo-dir>-worktrees/` directory
  (segment `dev-local`) using ephemeral task branches. Runtime default: Local.
- **dev-preview**: persistent reusable worktree in the sibling `<repo-dir>-worktrees/` directory
  (segment `dev-preview`) using ephemeral task branches. Runtime default: Preview Supabase via
  `.env.preview.local`.
- **dev-extra**: persistent reusable worktree in the sibling `<repo-dir>-worktrees/` directory
  (segment `dev-extra`) using ephemeral task branches. Runtime default: Local.

The tooling derives lane paths from the checkout root (`scripts/shared/worktree-lane.ts`) and does
not require any specific parent directory. See `docs/core/git-governance.md` for the labeled
reference-machine example layout.

### Path Authorization Invariant

Being located inside a development worktree (`dev-local`, `dev-preview`, or `dev-extra`) **does not
grant** Git write permissions or environment/database mutation authority.

```text
Environment authorization =
task scope
+ target environment
+ operation risk
+ existing repository safety rules
```

Worktree path is an isolation directory, not an authorization token. Preview runtime connectivity on
`dev-preview` is not Preview administrative privilege. Agents inside any lane remain bound by
task-scoped authorization for Git writes, database mutations, and remote operational calls.

### Multi-Agent Lane Ownership & Preflight

Before making any file edits or running commands inside a worktree lane, agents **must** establish
the following state:

```text
1. worktree path
2. current branch / detached state
3. working-tree cleanliness (clean / dirty)
4. active task ownership
5. target environment
```

**Lane Invariants:**

- `1 active task = 1 branch = 1 worktree`
- An agent can claim a lane only if it is **idle (clean persistent lane branch aligned with develop,
  or detached HEAD on develop)** and **clean**, or already assigned to the **current task**.
- If a lane is occupied by another active task or contains pre-existing/unrelated dirty changes:
  **STOP** — do not switch, stash, reset, clean, overwrite, or repurpose the lane. Use another
  available lane or report the conflict to the user.

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

Provider environments, worktrees, cloud execution, elevated modes, or external integrations do not
imply additional Git authorization. Path is isolation, not privilege (see Path Authorization
Invariant).

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
