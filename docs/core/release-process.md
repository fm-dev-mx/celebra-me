# Release Process — Celebra-me

**Status:** Active  
**Last Updated:** 2026-05-23

## Overview

This document defines a lightweight release checkpoint process for the Celebra-me repository.
Checkpoints use Git tags, `package.json` version bumps, and a changelog entry — no release branches,
no automation runners, no semantic-release.

## When to Create a Version Checkpoint

Create a checkpoint after any of these events:

- A completed stabilization or testing cycle (lint, type-check, tests, build all passing).
- A production-ready feature milestone (e.g., dashboard, RSVP, invitations).
- A significant correction to a critical flow (RSVP, invitation delivery, guest import).
- A production hotfix.
- Before a risky refactor that would benefit from a rollback point.

## How to Choose the Next Version

Follow [Semantic Versioning](https://semver.org/) with pre-release labels:

| Current state            | Next checkpoint example |
| :----------------------- | :---------------------- |
| After a stable milestone | `v0.X.0` / `v1.X.0`     |
| Pre-release / testing    | `v0.X.0-beta.Y`         |
| Hotfix on a tagged state | `v0.X.Z`                |

- If the changelog already contains an `X.Y.0` entry, the next pre-release should be `X+1.0-beta.1`
  — never a pre-release of an already-documented version.
- Pre-release labels sort _before_ the stable release in SemVer (e.g., `0.2.0-beta.1` comes before
  `0.2.0`).

## Release Checkpoint Steps

### 1. Ensure the working tree is clean

```bash
git status
```

### 2. Update `package.json`

Set the `version` field to the chosen version **without** the leading `v`:

```json
"version": "0.2.0-beta.1"
```

### 3. Update `CHANGELOG.md`

Add an entry under the `[Unreleased]` section with today's date and the chosen version:

```markdown
## [0.2.0-beta.1] - 2026-05-23

### Stable baseline

Summary of what was stabilized since the last checkpoint.

### Verification

| Check      | Result                     |
| :--------- | :------------------------- |
| Lint       | Passed — note any warnings |
| Type-check | Passed                     |
| Tests      | Passed — note any skips    |
| Build      | Passed                     |

### Known issues

- Document any known platform or environment limitations relevant to this checkpoint.
```

### 4. Commit the changes

```bash
git add package.json CHANGELOG.md docs/core/release-process.md README.md
git commit -m "docs(release): add release checkpoint process and v0.X.Y baseline"
```

### 5. Create an annotated Git tag

```bash
git tag -a v0.X.Y -m "v0.X.Y - Short description of checkpoint"
```

### 6. Verify before pushing

Re-run the full verification suite:

```bash
pnpm lint
pnpm type-check
pnpm test --runInBand
pnpm build
```

If any check fails, fix the issue or explicitly document the failure before tagging. Do not push a
tag over a failing verification without a clear record.

### 7. Push

```bash
git push
git push origin v0.X.Y
```

## What to Record as Known Issues

- Platform-specific skips (e.g., Windows tests skipped with `test.skip`).
- Tests that require external infrastructure not available in CI (e.g., Supabase, git in PATH).
- Pre-existing linter warnings that are acceptable and documented.

## What NOT to Do

- Do not add Changesets, semantic-release, or release branch tooling.
- Do not create GitHub Actions workflows for release automation unless the repo already has one.
- Do not modify app source files to display the version unless the app already has a version display
  component.
- Do not force-update an existing tag. If a tag already exists, stop and choose the next version.
