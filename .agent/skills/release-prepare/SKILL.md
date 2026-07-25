---
name: release-prepare
description: |
  Prepare a Celebra-me release candidate: resolve baseline, choose next version, update
  package.json and CHANGELOG.md, validate, and report — without committing, tagging, pushing,
  deploying, or publishing. Policy SSOT is docs/core/release-process.md.
domain: meta
version: 1.0.0
when_to_use:
  - User asks to prepare a release or release candidate
  - Version bump / changelog promotion for a checkpoint
  - Phrases like "prepara release", "version bump", "release candidate"
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read docs/core/release-process.md
related_skills:
  - commit-planner
  - documentation-governance
related_docs:
  - docs/core/release-process.md
  - docs/core/git-governance.md
  - CHANGELOG.md
---

# Release Prepare

Operational procedure for a Celebra-me release candidate. **Policy authority** for versions, tags,
and changelog shape is [`docs/core/release-process.md`](../../../docs/core/release-process.md). This
skill does not redefine that policy.

**Never** commit, tag, push, deploy, or publish from this skill. Propose those steps; wait for
explicit user authorization (then use `commit-planner` for the commit unit if asked).

## Allowed file edits

Only:

- `package.json` (`version` field, no leading `v`)
- `CHANGELOG.md` (promote `[Unreleased]` → dated version section; reset `[Unreleased]`)

Do not touch lockfiles, source, tests, or unrelated docs unless `release-process.md` explicitly
requires them and you cite that evidence.

## Workflow

### 1. Inspect state

```bash
git status --short
git tag --sort=-creatordate | head -20
git log --oneline --decorate -n 50
git diff --stat
```

Read `package.json` version and latest `CHANGELOG.md` entries. Note unrelated dirty files and leave
them untouched. Detect whether CHANGELOG uses bottom reference-style links (`[0.9.0-beta.1]: ...`);
if so, add a matching link for the new version.

### 2. Resolve baseline

Priority:

1. Latest valid git tag
2. Latest explicit CHANGELOG release entry
3. Latest release/baseline commit
4. Current `package.json` version only if nothing stronger exists

If sources disagree, report the conflict and justify the chosen baseline.

### 3. Diff baseline → HEAD

```bash
git diff --stat <BASELINE>..HEAD
git diff --name-status <BASELINE>..HEAD
git log --oneline <BASELINE>..HEAD
```

Summarize real changes into Keep a Changelog groups (Added / Changed / Fixed / etc.). Do not invent
user-facing impact. Note production risks only with evidence.

### 4. Select next version

Follow SemVer + pre-release rules in `docs/core/release-process.md`:

- fixes/docs/tests-only → bump patch or beta increment as appropriate
- meaningful product/system evolution → minor (or justified major)
- Never create a pre-release of an already-documented stable `X.Y.0` entry

`package.json` version: no leading `v`. Recommended tag: with leading `v`.

### 5. Release theme

Short factual phrase for the checkpoint summary (used in recommended commit/tag messages). Avoid
vague themes (`updates`, `improvements`, `version bump`).

### 6. Update release files

- Set `package.json` `version`
- Promote `[Unreleased]` bullets into `## [X.Y.Z] - YYYY-MM-DD` (or the repo's established heading
  style if already consistent — match existing CHANGELOG)
- Reset `[Unreleased]` to an empty pending section
- Optional Verification / Known issues tables when useful (see release-process examples)

### 7. Validate

Prefer gatekeeper-appropriate checks; typically:

```bash
pnpm type-check
pnpm test
pnpm build
```

Document pre-existing vs new failures with evidence (`git diff --name-only <BASELINE>..HEAD` on
failing test paths). Do not recommend production deploy if validation is red without clear
pre-existing caveats.

### 8. Final review

```bash
git diff -- package.json CHANGELOG.md
git status --short
```

Confirm only approved release files changed.

### 9. Publication recommendation (do not execute)

Report whether to:

- commit release files (suggested message via Conventional Commits / commitlint — prefer
  `chore(release): vX.Y.Z <theme>` when that matches repo history; otherwise follow
  `docs/core/git-governance.md` + `commitlint.config.cjs`)
- create annotated tag `vX.Y.Z`
- push / deploy / publish

If evidence for push/deploy is missing, do not assume it. Hand commit execution to `commit-planner`
only after the user authorizes commits.

## Output structure

```md
## Release Candidate Report

### Decision

Prepared / Corrected / Rejected

### Baseline

- Previous version:
- Baseline commit:
- Baseline source:
- Conflicts found:
- Final baseline decision:

### Selected Version

- New version:
- Recommended tag:
- Release theme:
- Reasoning:

### Change Summary

| Category                      | Summary |
| ----------------------------- | ------- |
| Added / Changed / Fixed / ... | ...     |
| Production Risks              | ...     |

### Files Changed

| File         | Status   | Notes               |
| ------------ | -------- | ------------------- |
| package.json | modified | version → X.Y.Z     |
| CHANGELOG.md | modified | promoted Unreleased |

### Validation

| Check      | Result |
| ---------- | ------ |
| type-check | ...    |
| test       | ...    |
| build      | ...    |

### Next Steps (not executed)

- Commit: <recommended message or "await authorization">
- Tag: <recommended annotated tag or none>
- Push / deploy: <only if evidenced>
```

## Hard constraints

- No commit, tag, push, deploy, or publish inside this skill.
- Policy conflicts: `docs/core/release-process.md` wins.
- Leave unrelated dirty files alone.
- Do not over-bump from file/commit count alone.
