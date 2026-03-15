# Git Governance: High-Precision Commit Architecture

> **Status**: Active. **Last Updated**: 2026-03-15.

## Overview

This document is the source of truth for the commit-governance architecture in `celebra-me`. It
describes executable owners, command entrypoints, and the validation sequence. It does not duplicate
rule logic that is enforced in scripts or hooks.

---

## Executable Ownership

| Owner File                                      | Responsibility                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `.agent/governance/bin/gatekeeper.mjs`          | Governance findings, route computation, workflow route computation, ADU splits |
| `.agent/governance/bin/gatekeeper-workflow.mjs` | Workflow session lifecycle, autofix retries, deterministic split staging       |
| `commitlint.config.cjs`                         | Commit message structure and multi-file body enforcement                       |
| `.husky/pre-commit`                             | Final staged-state verification order                                          |
| `scripts/validate-commits.mjs`                  | Commit-range validation for local push and CI                                  |
| `.husky/pre-push` / CI workflow                 | Invocation order for commit-range validation and tests                         |

---

## Primary Commands

```text
pnpm gatekeeper                   → Strict Gatekeeper validation
pnpm gatekeeper:report            → Full JSON report
pnpm gatekeeper:report:workflow   → Lean workflow JSON report
pnpm gatekeeper:commit-ready      → Compatibility wrapper to workflow inspect
pnpm gatekeeper:commit-ready:create <branch> → Create explicit branch, then inspect
pnpm gatekeeper:workflow:inspect  → Quick workflow inspection + session file
pnpm gatekeeper:workflow:autofix  → Autofix loop + final strict pass
pnpm gatekeeper:workflow:cleanup  → Remove workflow-owned .git artifacts
node .agent/governance/bin/gatekeeper-workflow.mjs stage --domain <id>
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --domain <id>
```

---

## Validation Sequence

1. Stage files intentionally.
2. If you are on `main` or `develop`, Gatekeeper may auto-create or auto-switch to a safe feature
   branch during inspection.
3. Optionally, use `pnpm gatekeeper:commit-ready:create <branch>` when you want an explicit branch
   name instead of inferred auto-branching.
4. Run workflow inspection to compute `workflowRoute` and `adu.suggestedSplits`.
5. If `workflowRoute=auto_fix`, run workflow autofix.
6. Use workflow `stage --domain <id>` to isolate one domain and refresh S0 artifacts.
7. Commit normally; `commit-msg` enforces message structure and file-level body requirements.
8. `pre-commit` runs `lint-staged` first, then strict Gatekeeper verification on the final staged
   snapshot.
9. `pre-push` and CI validate commit ranges with `scripts/validate-commits.mjs` and then run tests.

---

## Commit Message Contract

The executable owner for commit-message rules is `commitlint.config.cjs`. At a high level:

- Conventional Commit header is required.
- Scope must be one of the governance domains.
- Vague subject language is rejected.
- Multi-file or complex commits require a body.
- Required bodies must use file-path bullets in `- path/to/file.ext: description` format.

If these rules change, update `commitlint.config.cjs` first and then update this document to match
the executable owner.

---

## ADU Contract

`gatekeeper.mjs` computes ADU splits through `DomainMapper`. `gatekeeper-workflow.mjs` is the only
supported owner for creating `.git/gatekeeper-session.json`, `.git/gatekeeper-s0.txt`, and
`.git/gatekeeper-s0-signature.json`.

Auto-branching from protected branches remains owned by `gatekeeper.mjs`. Explicit branch creation
for backward-compatible helpers remains owned by `gatekeeper-commit-ready.mjs`.

Session artifacts are invalidated when any of the following change:

- current branch
- current HEAD SHA
- staged signature
- workflow session version
- session TTL

Stale or corrupted session files must be cleaned by `gatekeeper-workflow.mjs`, not by ad hoc manual
edits.

---

## CI and Push Validation

- Local `pre-push` validates commit ranges and then runs tests.
- CI validates commit ranges on pull requests and then runs documentation integrity checks.
- Staged-only Gatekeeper reports are not used as post-commit validation gates.

---

## Changelog

- **2026-03-15**: Added lean workflow report profile, workflow-owned session lifecycle, and
  commit-range validation alignment.
