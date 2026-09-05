# Git Safety Session Procedure

Git Safety owns authorization and protected state. Read this procedure before starting or closing a
mutable session or diagnosing a baseline. No baseline or CLI declaration grants permission.

## Agent Session Lifecycle (interactive plumbing)

Git Safety is **interactive Agent OS plumbing** for a mutable session. Operators should not need to
manually maintain baselines as routine ceremony. Agents establish and close the session.

Protected hard-fail state is limited to the current mutable task/session:

- current HEAD (including unborn/null HEAD);
- current symbolic branch / detached state;
- index (staged) state via semantic index metadata (blob OIDs / modes / paths — never buffered
  binary patch contents).

Other local heads, tags, and stash refs may be recorded as diagnostics only. Unrelated
multi-worktree or concurrent-task mutation of those global refs must **not** cause an unconditional
session failure.

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
baseline and evidence, report, and perform **no** remediation. On PASS: remove the baseline and
leave no task-authorization state. Underlying command:

```
node scripts/agent/git-safety.mjs finish
```

The read-only `check` command reports whether the active baseline still matches protected state; it
never removes the baseline. CI does **not** invoke this interactive session guard; hermetic tests
verify the implementation.

```sh
pnpm agent:git-safety:check
```

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

| Situation                                          | Result                                         |
| -------------------------------------------------- | ---------------------------------------------- |
| Protected state matches baseline                   | PASS — baseline removed                        |
| Protected drift without matching authorization     | FAIL — baseline preserved; ask the user        |
| Authorized operation with only permitted drift     | PASS — baseline removed                        |
| Authorized operation plus adjacent protected drift | FAIL — baseline preserved                      |
| No active session (no baseline)                    | FAIL                                           |
| Active baseline already present at `start`         | FAIL — refuse overwrite                        |
| Legacy / incompatible baseline (e.g. v1)           | FAIL — preserve file; one-time operator remove |

### Legacy baseline (one-time migration)

Pre-v2 baselines (no `version`, or fields like `stagedDiffHash`) are not sessions under this
lifecycle. `start` and `finish` refuse them without deleting or rewriting the file.

Operator one-time cleanup when no valid v2 session should continue:

1. Inspect `.agent/tmp/git-safety-baseline.json`.
2. Delete that file only with explicit intent (not via a new lifecycle command).
3. Run `pnpm agent:git-safety:start` to open a v2 session.

Do not recreate `allow-git-write` or any persistent Git-write authorization marker.
