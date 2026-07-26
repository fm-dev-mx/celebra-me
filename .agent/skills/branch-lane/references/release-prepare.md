# Mode B — `release-prepare`

Load after `.agent/skills/branch-lane/SKILL.md`. **Policy authority:**
[`docs/core/release-process.md`](../../../../docs/core/release-process.md). This reference does not
redefine that policy.

**No Git writes.** Never commit, tag, push, deploy, or publish here. Propose those steps; wait for
explicit authorization (then `commit-planner` for commits). After the release commit is on
`develop`, promotion uses Mode C.

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
- run Mode C after `develop` includes the release commit

## Report template

```md
## Branch Lane Report — release-prepare

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
- Promote: Mode C after develop is ready
```

## Hard constraints

- No commit, tag, push, deploy, or publish inside this mode.
- Policy conflicts: `docs/core/release-process.md` wins.
- Do not over-bump from file/commit count alone.
