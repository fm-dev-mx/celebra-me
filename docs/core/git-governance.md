# Git Governance: High-Precision Commit Architecture

> **Status**: Active. **Last Updated**: 2026-03-16. **Subdomains**: Normalized to kebab-case.

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
node .agent/governance/bin/gatekeeper-workflow.mjs commit --domain <id>
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
6. If `workflowRoute=architectural_intervention`, stop and resolve the reported blockers before any
   `stage`, `scaffold`, or `commit` command.
7. Use workflow `stage --domain <id>` to isolate one domain and refresh S0 artifacts.
8. Use `scaffold --domain <id>` to generate a non-mutating commit message preview only after
   `workflowRoute=proceed_adu`.
9. Use `commit --domain <id>` to validate the generated message against commitlint and create the
   commit.
10. `pre-commit` runs `lint-staged` first, then strict Gatekeeper verification on the final staged
   snapshot.
11. `pre-push` and CI validate commit ranges with `scripts/validate-commits.mjs` and then run tests.

---

## Commit Message Contract

The executable owner for commit-message rules is `commitlint.config.cjs`. At a high level:

- Conventional Commit header is required.
- Scope must be one of the governance domains.
- Subject must use `type(scope): verb target` and describe the dominant change.
- `type` and `scope` remain deterministic. Optional AI may refine only the subject fragment after
  `type(scope):`.
- Process bookkeeping language such as `record ... scope` is rejected.
- Prefer decisive verbs such as `define`, `align`, `harden`, `extract`, `refactor`, or `clarify`
  when they better match the dominant change than `update`.
- Multi-file or complex commits require a body.
- Required bodies must use one exact changed-file bullet per touched file:
  `- path/to/file.ext: description`
- Bullet `pathSpec` values must use full relative paths; `...`, folder bullets, and grouped prefix
  bullets are not allowed.
- Bullet descriptions must describe the concrete file change, not generic placeholders.
- Deleted files must use the deleted path. Renamed files must use the new path and mention the old
  path in the description.
- `gatekeeper-workflow scaffold` must generate subjects and bullets that already satisfy this
  contract, using full relative paths, concrete descriptions, and safe truncation when needed.
- AI title assist is opt-in through policy and env configuration. Missing config, low-quality AI
  output, timeouts, or commitlint failures must fall back to the deterministic subject.
- `gatekeeper-workflow commit` validates the generated message against commitlint before invoking
  `git commit`.

Example:

```text
refactor(auth): standardize rsvp repository flows

- src/lib/rsvp/repositories/guest.repository.ts: refine guest persistence logic
- src/lib/rsvp/services/dashboard-guest-query.service.ts: align dashboard query orchestration
```

Docs-heavy example:

```text
docs(gov-workflows): clarify gatekeeper commit stop conditions

- .agent/workflows/gatekeeper-commit.md: require proceed_adu before scaffold and commit
- docs/core/git-governance.md: align workflow stop conditions and commit message rules
```

If these rules change, update `commitlint.config.cjs` first and then update this document to match
the executable owner.

### STRONG_VERBS Strategy

The `STRONG_VERBS` list in `commitlint.config.cjs` enforces the use of decisive, action-oriented
vocabulary in commit subjects. While specific verbs like `implement` or `refactor` are preferred,
generic verbs like `update` are permitted when used with a concrete target to maintain a balance
between precision and developer flexibility.

### Environment Configuration

Project-level configurations in `.npmrc` should prioritize standard, cross-tool compatible flags.
The use of `install-strategy=hoisted` replaces the deprecated `node-linker` setting to ensure
compatibility across modern versions of npm and pnpm while maintaining required hoisting behaviors.

---

## ADU Contract

`gatekeeper.mjs` computes ADU splits through `DomainMapper`, enforcing atomicity limits (default 12
files per split) during the inspection phase to prevent non-atomic commits.
`gatekeeper-workflow.mjs` is the only supported owner for creating `.git/gatekeeper-session.json`,
`.git/gatekeeper-s0.txt`, and `.git/gatekeeper-s0-signature.json`.

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

- **2026-03-16**: Added optional AI subject assist with deterministic fallback, tightened commit
  bodies to one exact bullet per changed file, and aligned validation ownership on commitlint.
- **2026-03-16**: Required full relative paths in commit body bullets, banned ellipsis path
  truncation, and aligned scaffold output with commitlint path validation.
- **2026-03-16**: Expanded STRONG_VERBS in commitlint to include 'update' and migrated .npmrc to
  modern install-strategy. Added documentation sections for verb strategy and environment config.
- **2026-03-15**: Added lean workflow report profile, workflow-owned session lifecycle, and
  commit-range validation alignment.

### Gatekeeper Workflow

The gatekeeper-workflow.mjs script manages the session-based commit lifecycle. It ensures that
changes are inspected, staged by domain, and committed with high-precision messages while
maintaining atomicity and schema alignment across the codebase during transition phases.

### Pre-flight Resolution

Manual pre-flight recommendations are resolved from `.agent/governance/config/policy.json`. The
workflow should prefer `workflow.inspect.preflightCommand` when it is configured and runnable. Each
`pnpm <script>` candidate must exist in `package.json`; operators and agents should not probe
missing scripts by trial. If the configured command is absent, the current fallback order is:

1. `pnpm turbo-all` when the script exists
2. `pnpm ci` when the script exists
3. `pnpm lint && pnpm type-check && pnpm test`

This prevents operators and agents from assuming commands that do not exist in the current repo.
