# Release Process — Celebra-me

**Status:** Active

**Last Updated:** 2026-08-24

## Overview

### Efficient validation and evidence

- `pnpm run ci` covers static/build, Jest and certified browser checks. The remote workflow also
  requires Repository Policy and disposable DB contracts; local CI alone is not release readiness.
- `validate:changed` already runs related Jest. Do not repeat `test:changed` at the same unchanged
  local checkpoint. The commit hook independently verifies staged inputs.
- Deleted sources and non-documentation JSON/YAML inputs use full Jest when import selection is
  incomplete. Changed Playwright specs need an explicit browser execution; Jest does not run them.
  SCSS/layout changes still require applicable browser evidence. Local Render Corpus is Jest
  contract coverage, not visual certification.

- Run focused local checks while editing. Use the PR to `develop` for complete remote certification;
  confirm its workflow run exists. A push to a task branch alone does not run CI.
- `pnpm test:e2e:ci` explicitly compares visual references and fails before browser work when the
  certified Linux runtime, isolated fixtures, LFS references or coverage are unavailable. Diagnostic
  runs and candidate generation are not release certification.
- Generate candidates with the existing Repository CI manual input `visual_mode=candidate` on a
  published task ref. The workflow owns the pinned image and fixtures. Download its
  `visual-candidate-<sha>` artifact and review `changes.html` plus the complete matrix as needed.
  This mode does not produce a passing Application Suite. Any regenerated manifest requires renewed
  owner approval of that exact artifact; never transfer approval to a different hash.
- Preserve previously granted task authorization. Resolve routine paths and command arguments
  without asking again. Request new decisions only for new scope or material visual approval.
- Before promotion, run `pnpm ops:release-checks <exact-sha>` to require Repository Policy,
  Application Suite and the correlated Preview smoke from GitHub Actions. Pending, cancelled,
  skipped, missing, untrusted or different-SHA evidence blocks this check. For database contracts,
  follow `expand → CI/Preview → Production deployment + smoke → contract`; the contract gate
  verifies the prior Production SHA and its versioned application-capability manifest. It does not
  replace database compatibility checks or owner deployment authorization. Recheck after final
  integration.
- The main ruleset must still be inspected: this CLI is a fail-closed operator check, not proof that
  provider-side Preview protection is configured. Never call a release ready from CI alone.
- Avoid repeating successful complete suites for unchanged evidence. A final integration SHA,
  changed inputs or an unresolved failure justifies revalidation. Do not reuse PR merge-SHA evidence
  as if it certified a different final commit.
- CI records `validation-metrics` artifacts with SHA, mode, attempt, completed job durations, wall
  time and aggregate runner minutes. These exclude queue time, billing multipliers and the metrics
  job; they do not estimate token usage. Compare like-for-like runs before adopting sharding. Keep
  serial coverage until three paired trials meet the agreed 30% wall-time saving and at most 50%
  runner-minute increase, with identical coverage and passing results.

This document owns release checkpoints and the layered CHANGELOG policy for the Celebra-me
repository. Checkpoints use Git tags, `package.json` version bumps, and a changelog entry — no
release branches, no automation runners, no semantic-release.

Agent procedure for preparing a release candidate (and related develop/main lane ops):
[`.agent/skills/branch-lane/SKILL.md`](../../.agent/skills/branch-lane/SKILL.md) mode
`release-prepare`. This document remains the policy SSOT.

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
- If continuous notes were missed and `[Unreleased]` is empty at release preparation, stop and
  reconstruct it from the audited latest-tag-to-HEAD range before cutting the version section.
- Per-client operational detail stays in `docs/invitations/<slug>.md`; link or summarize in
  `[Unreleased]` only for notable ships.

### Release checkpoint discipline

Before creating a version tag, complete this **pre-tag checklist** (all must pass):

- [ ] The versioned section contains at least one real bullet sourced from accumulated
      `[Unreleased]` notes or an explicitly audited latest-tag-to-HEAD reconstruction.
- [ ] No wholesale paste of `docs/invitations/<slug>.md` ops notes into the changelog.
- [ ] Schema impact is summarized only; full history remains in `supabase/migrations/`.
- [ ] Promote `[Unreleased]` bullets into `## [X.Y.Z] - YYYY-MM-DD` (Keep a Changelog groups).
- [ ] Reset `[Unreleased]` to an empty pending section for the next cycle.
- [ ] `package.json` `version` matches the new section (no leading `v`).
- [ ] Annotated tag `vX.Y.Z` will match that version.

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
as Added / Changed / Fixed). When continuous notes are missing, first reconstruct and review those
items from the latest valid tag through the candidate HEAD. Optionally append verification notes for
the checkpoint:

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

### 4. Commit the changes through `develop`

```bash
git switch -c candidate/vX.Y.Z develop
git add package.json CHANGELOG.md
git commit -m "chore(release): publish vX.Y.Z checkpoint"
```

Open a pull request to `develop`, wait for `Repository Policy` and `Application Suite`, and merge
without squashing when preceding atomic commits must remain distinct. Revalidate the final `develop`
SHA after the merge.

### 5. Promote the validated commit to `main`

Before this promotion, when the release range changes anything inside the CSS visual-parity gate
scope ("Profile LAYOUT deletion or move" in
[`../domains/theme/css-visual-parity.md`](../domains/theme/css-visual-parity.md#scope-of-this-gate),
or a `published` lifecycle change that adds a route to the canonical matrix), obtain the owner's
release-time visual confirmation. The confirmation reviews the candidate produced with the pinned
runtime and identifies the exact source SHA, matrix hash, and candidate-manifest SHA-256. Record
that acceptance through `pnpm visual:parity:accept` before this step, land the accepted references
on `develop` through the same pull-request and checks flow as step 4, and wait for
`Application Suite` on that resulting `develop` SHA. This is a human release decision, not an
automatic action performed by CI or Vercel after a deployment begins.

If visual confirmation is missing or rejected, the candidate is not eligible for promotion or
deployment. Do not reduce visual coverage, relax comparison, or treat a Preview build as approval.

```bash
git switch develop
git pull --ff-only origin develop
git switch main
git pull --ff-only origin main
git merge --ff-only develop
ALLOW_MAIN_PUSH=true git push origin main
```

The `main` ruleset requires the same checks as `develop` but intentionally omits the pull-request
rule. The promotion must reuse the exact checked `develop` SHA and must not create a merge, squash,
or rebase commit.

### 6. Verify the promoted deployment

Confirm that `origin/main` and `origin/develop` resolve to the same SHA, then verify the automatic
production deployment and critical smoke routes. If the deployment fails, revert on `develop`,
validate, and promote the revert by fast-forward; never rewrite `main`.

### 7. Create and push the annotated tag

```bash
git tag -a v0.X.Y -m "v0.X.Y - Short description of checkpoint"
git push origin v0.X.Y
```

The tag is created only after the exact promoted deployment is verified. Do not force-update an
existing tag.

## Database-dependent releases

When application code depends on a migration, use the staged contract order:

1. Apply and validate the `expand` migration against local/Preview environments.
2. Require complete CI and correlated Preview smoke for the exact release SHA.
3. Deploy that application build to Production and require the correlated Production smoke.
4. Apply the reviewed `contract` migration only after the previous deployment SHA and its capability
   manifest satisfy the rollout registry.
5. Verify the RPCs, schema objects, grants, and metadata introduced by the migration.

For a `contract` migration, deploy the replacement application before revoking the legacy database
path. An application rollback may restore the prior deployment; an applied migration is immutable
history and must be corrected by a new forward migration. Capture logs and current published/draft
revisions before incident remediation.

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
