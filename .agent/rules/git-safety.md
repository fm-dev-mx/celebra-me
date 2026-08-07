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

## Agent Session Lifecycle (interactive plumbing)

Git Safety is **interactive Agent OS plumbing** for a mutable session. Operators should not need to
manually maintain baselines as routine ceremony. Agents establish and close the session.

Protected hard-fail state is limited to the current mutable task/session:

- current HEAD (including unborn/null HEAD);
- current symbolic branch / detached state;
- index (staged) state via semantic index metadata (blob OIDs / modes / paths — never buffered
  binary patch contents).

Other local heads, tags, and stash refs may be recorded as diagnostics only. Unrelated multi-worktree
or concurrent-task mutation of those global refs must **not** cause an unconditional session failure.

Working-tree content remains intentionally editable during implementation. The detector does not
prove absence of remote pushes or of transient mutate-then-restore activity.

### Start mutable session

```sh
pnpm agent:git-safety:start
```

Fails closed if a baseline already exists (never overwrites). Writes
`.agent/tmp/git-safety-baseline.json` with schema version, creation time, HEAD, branch/detached
state, and index fingerprint. Underlying command:

```
node scripts/agent/git-safety.mjs start
```

### Finish session (verify, then clean on PASS)

```sh
pnpm agent:git-safety:finish
```

Fails if no baseline exists. Compares protected state. On unexpected drift: FAIL, preserve the
baseline and evidence, report, and perform **no** remediation. On PASS: remove the baseline and leave
no task-authorization state. Underlying command:

```
node scripts/agent/git-safety.mjs finish
```

There is no separate operational `check` / `end` pair. CI does **not** invoke this interactive
session guard; hermetic tests verify the implementation.

---

## Authorization

Git write operations are authorized only when the user explicitly requests that exact Git operation
in the current task (Task Contract). No filesystem marker provides standing Git-write authority.

When `finish` must interpret an already-authorized mutation for detection only, pass an ephemeral
declaration for that invocation:

```sh
pnpm agent:git-safety:finish -- --authorized-operation=stage --paths=path/a,path/b
pnpm agent:git-safety:finish -- --authorized-operation=unstage --paths=path/a
pnpm agent:git-safety:finish -- --authorized-operation=commit
pnpm agent:git-safety:finish -- --authorized-operation=branch-switch --branch=feature/x
```

Rules:

- Supported operations are exactly: `stage`, `unstage`, `commit`, `branch-switch`.
- Unknown operations fail closed.
- One operation never implies adjacent operations.
- Path scope is required and enforced for `stage` / `unstage`.
- Extra protected drift outside the permitted operation fails.
- The CLI declaration is **not** proof of human authorization — only a detector hint for authority
  already granted by the Task Contract.
- Nothing from this declaration is persisted.

Provider environments, worktrees, cloud execution, elevated modes, or external integrations do not
imply additional Git authorization. Path is isolation, not privilege (see Path Authorization
Invariant).

---

## Finish Results

| Situation                                         | Result                                      |
| ------------------------------------------------- | ------------------------------------------- |
| Protected state matches baseline                  | PASS — baseline removed                     |
| Protected drift without matching authorization    | FAIL — baseline preserved; ask the user     |
| Authorized operation with only permitted drift    | PASS — baseline removed                     |
| Authorized operation plus adjacent protected drift| FAIL — baseline preserved                   |
| No active session (no baseline)                   | FAIL                                        |
| Active baseline already present at `start`        | FAIL — refuse overwrite                     |
| Legacy / incompatible baseline (e.g. v1)          | FAIL — preserve file; one-time operator remove |

### Legacy baseline (one-time migration)

Pre-v2 baselines (no `version`, or fields like `stagedDiffHash`) are not sessions under this
lifecycle. `start` and `finish` refuse them without deleting or rewriting the file.

Operator one-time cleanup when no valid v2 session should continue:

1. Inspect `.agent/tmp/git-safety-baseline.json`.
2. Delete that file only with explicit intent (not via a new lifecycle command).
3. Run `pnpm agent:git-safety:start` to open a v2 session.

Do not recreate `allow-git-write` or any persistent Git-write authorization marker.
