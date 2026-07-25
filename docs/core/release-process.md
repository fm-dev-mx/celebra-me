# Release Process — Celebra-me

**Status:** Active  
**Last Updated:** 2026-07-25

## Overview

This document owns release checkpoints and the layered CHANGELOG policy for the Celebra-me
repository. Checkpoints use Git tags, `package.json` version bumps, and a changelog entry — no
release branches, no automation runners, no semantic-release.

## Layered CHANGELOG Policy

Keep one history owner per change type. Do not dump every commit, migration, or invitation edit into
`CHANGELOG.md`.

| Level             | Source of truth                                         | What belongs in `CHANGELOG.md`                                                        |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| System / product  | `CHANGELOG.md` + annotated tag + `package.json` version | Notable features, breaking changes, infra, dependency milestones                      |
| Client invitation | `docs/invitations/<slug>.md` (+ SQL patches / manifest) | Only publishable milestones (new client invitation shipped, major theme/content ship) |
| Database schema   | `supabase/migrations/` (+ manual SQL manifest rules)    | Product/ops impact summary only — never a full migration inventory                    |
| Agents / docs     | Usually omit                                            | Only when a human-facing operational contract changes                                 |

### Continuous discipline (`[Unreleased]`)

- Add a bullet under `CHANGELOG.md` → `[Unreleased]` when a **product-visible** or
  **operator-visible** change lands and is intended for the next checkpoint.
- Do **not** require a changelog entry for every commit.
- Prefer updating `[Unreleased]` in the same milestone PR/work unit that ships the behavior, not
  only at tag time.
- Per-client operational detail stays in `docs/invitations/<slug>.md`; link or summarize in
  `[Unreleased]` only for notable ships.

### Release checkpoint discipline

Before creating a version tag:

1. Move `[Unreleased]` bullets into a new `## [X.Y.Z] - YYYY-MM-DD` section (Keep a Changelog).
2. Leave a fresh empty `[Unreleased]` section for the next cycle.
3. Confirm invitation-only detail was not pasted wholesale from ops notes.
4. Confirm schema detail is summarized, with migrations remaining the schema history.

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

Promote accumulated `[Unreleased]` items into a dated version section (Keep a Changelog groups such
as Added / Changed / Fixed). Optionally append verification notes for the checkpoint:

```markdown
## [0.2.0-beta.1] - 2026-05-23

### Added

- Summary of product-visible work stabilized since the last checkpoint.

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

Reset `[Unreleased]` to an empty pending section after the promotion.

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

## Database-dependent releases

When application code depends on a migration, use this order:

1. Validate the complete migration chain against local Supabase.
2. Apply the reviewed required migrations to production with explicit owner authorization.
3. Verify the RPCs, schema objects, grants, and metadata introduced by those migrations.
4. Deploy the dependent application build.
5. Run the production smoke and cache-isolation checks from
   [`../domains/intake/production-flow.md`](../domains/intake/production-flow.md).

Never deploy dependent code before its database contract. An application rollback may restore the
prior deployment; an applied migration is immutable history and must be corrected by a new forward
migration. Capture logs and current published/draft revisions before incident remediation.

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
