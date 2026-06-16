# Git Safety Rule — Celebra-me

This rule defines the Git safety policy for all AI agents working in this repository.

See also the human-facing commit policy at `docs/core/git-governance.md` and the review/remediation
contract at `.agent/rules/gatekeeper.md`.

---

## Default Behavior

Agents **may**:

- Inspect the repository (read files, search, diff, log, status).
- Edit working tree files when the task requires it.

Agents **must not** perform Git write operations unless the user explicitly authorizes them in the
current task. Authorization is **task-scoped** — permission from a previous task does not carry
over.

---

## Git Write Operations (Forbidden Without Authorization)

- `git add`
- `git commit`
- `git restore --staged`
- `git reset`
- `git stash`
- `git checkout`, `git switch`
- `git merge`, `git rebase`, `git cherry-pick`
- Any command that changes HEAD, the index, branches, tags, or history.

---

## Safe Read Operations (Always Allowed)

- `git status`
- `git diff`, `git diff --cached`
- `git log`, `git show`
- `git rev-parse HEAD`
- `git branch --show-current`
- Other read-only Git inspection commands.

---

## Staged Files Are User-Owned

Pre-existing staged changes are user state. Agents must:

- **Preserve** them during the session.
- **Not unstage** them unless explicitly authorized.
- **Not auto-remediate** if staged state changes unexpectedly — report and ask the user.

**Exception — Artifact hygiene:** The Gatekeeper (`.agent/rules/gatekeeper.md §2.1`) may unstage
forbidden artifacts (build outputs, scratch files). This is an authorized exception to the above
rule. All other unstaging requires explicit user authorization.

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

Git write operations are authorized only when the local marker file `.agent/tmp/allow-git-write`
exists. This file is unversioned and local-only.

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
