# Optional mode — `release-prepare`

Load after `.agent/skills/branch-lane/SKILL.md`. **Policy authority:**
[`docs/core/release-process.md`](../../../../docs/core/release-process.md). This reference does not
redefine that policy.

**No Git writes.** Never commit, tag, push, deploy, or publish here. Propose those steps; wait for
explicit authorization (then `commit-planner` for commits). After the release commit is on
`develop`, promotion uses `promote-develop-to-main`.

## Allowed file edits

Only:

- `package.json` (`version` field, no leading `v`)
- `CHANGELOG.md` (promote `[Unreleased]` → dated version section; reset `[Unreleased]`)

Do not touch lockfiles, source, tests, or unrelated docs unless `release-process.md` explicitly
requires them and you cite that evidence. Leave unrelated dirty files alone.

## Workflow

### 1. Inspect state

```bash
git status --short
git tag --sort=-creatordate | head -20
git log --oneline --decorate -n 50
git diff --stat
```

Read `package.json` version and latest `CHANGELOG.md` entries. Detect bottom reference-style links
(`[0.9.0-beta.1]: ...`); if present, add a matching link for the new version.

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

Summarize into Keep a Changelog groups. Do not invent user-facing impact. Note production risks only
with evidence.

**Database-sensitive advisory (non-blocking for file edits):**

```bash
pnpm db:branch:parity -- --base <BASELINE> --head HEAD --json
```

If `requiresParityAudit` is true, report findings with status `Skipped` for promote-time parity
(file edits may continue) and require [`database-parity`](../../database-parity/SKILL.md) clearance
before a later database-sensitive promote. Do not treat healthy sensitive detection as a failure.

Release-file edits themselves still require explicit authorization (`Needs authorization`) before
writing `package.json` / `CHANGELOG.md`.

### 4. Select next version

Follow SemVer + pre-release rules in `docs/core/release-process.md`:

- fixes/docs/tests-only → bump patch or beta increment as appropriate
- meaningful product/system evolution → minor (or justified major)
- Never create a pre-release of an already-documented stable `X.Y.0` entry

`package.json` version: no leading `v`. Recommended tag: with leading `v`.

### 5. Release theme

Short factual phrase for checkpoint summary. Avoid vague themes (`updates`, `improvements`,
`version bump`).

### 6. Update release files

- Set `package.json` `version`
- Promote `[Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD` (match existing CHANGELOG heading style)
- Reset `[Unreleased]` to an empty pending section
- Optional Verification / Known issues tables when useful

### 7. Validate

Prefer gatekeeper-appropriate checks; typically:

```bash
pnpm type-check
pnpm test
pnpm build
```

Document pre-existing vs new failures with evidence. Do not recommend production deploy if
validation is red without clear pre-existing caveats.

### 8. Final review

```bash
git diff -- package.json CHANGELOG.md
git status --short
```

Confirm only approved release files changed.

### 9. Publication recommendation (do not execute)

Report whether to:

- commit release files (prefer `chore(release): vX.Y.Z <theme>` when that matches history; else
  `docs/core/git-governance.md` + `commitlint.config.cjs`)
- create annotated tag `vX.Y.Z`
- push / deploy / publish
- run `promote-develop-to-main` after `develop` includes the release commit

## Report

Use the parent nine-section orchestrator report. Include version selection evidence and any
database-sensitive advisory (`Skipped` until promote).
