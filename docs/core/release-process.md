# Release Process — Celebra-me

**Status:** Active

This document owns release checkpoints, version tags and the layered CHANGELOG policy. Checkpoints
use an annotated Git tag, a `package.json` version bump and a changelog entry — no release branches,
release automation or semantic-release.

Related owners:

- Branches, task integration and the release pull request:
  [Git governance](git-governance.md#production-promotion).
- Validation tiers, CI coverage, evidence reuse and visual certification:
  [validation procedures](validation-procedures.md#remote-ci-coverage-and-efficiency).
- Code delivery to Preview or Production (`publish-preview` / `publish-production`):
  [release execution](release-execution.md).
- Agent preparation of a release candidate:
  [`branch-lane`](../../.agent/skills/branch-lane/SKILL.md) mode `release-prepare`.

## Canonical operation map

Diagnosis never authorizes mutation. `CURRENT`, green CI, an accessible deployment, lifecycle
`published`, a `READY` dry-run, or Local preparation is evidence for only its own gate.

- **Schema migration:** diagnose with `pnpm dbs` and
  `pnpm db:migrate -- --target <target> --dry-run`; Production mutates only through
  `pnpm prod:apply -- --schema`. Require pending set, compatibility, disposable/Preview proof and,
  for contract, capability manifest, exact Production deployment and smoke, owner permit and backup.
- **Tooling-only release:** diagnose with `pnpm ops:classify-release -- --base <sha> --head <sha>`.
  The result is advisory and retains Repository Policy and Application Suite, but indicates no DB
  apply, migration or backup.
- **Application release:** diagnose with `pnpm ops:release-checks <exact-sha>` and use the
  owner-authorized deployment workflow. Require exact trusted checks, deployment/environment and
  smoke; schema evidence remains separate.
- **Preview invitation update:** diagnose with
  `pnpm invitation:release -- --slug <slug> --targets preview --dry-run`; use `--apply` instead of
  `--dry-run` only with scoped Preview authorization. Require canonical package, lifecycle,
  provenance, asset namespace, three-way plan and hosted approval bound to current hashes.
- **Production invitation publication:** use `pnpm prod:apply -- --slug <slug>` for preflight and
  the same owner-only entrypoint with `--apply`. Require `published`, current hash-bound approval,
  provenance/baseline, resolved conflicts, assets, backup and owner permit.

Terminal evidence is always explicit: verified/ready/applied plus post-audit, or `BLOCKED`, `STALE`
or `UNVERIFIED`.

After a timeout or unknown result following an initiated write, observe status, receipt/provenance
and parity first (`OBSERVE_FIRST`). Repeat the same command only for a transient failure proven to
have occurred before writes (`RETRY_SAFE`). Missing authorization, approval, lifecycle, conflict,
quota or evidence is `BLOCKED_UNTIL_INPUT`; repetition cannot change it. A backup is reused only
while its target, fingerprint, integrity, encryption, recovery profile, migration history and
15-minute RPO remain valid, and is revalidated immediately before the owner permit.

## Release gates

- `Repository CI` is the only remote validation authority. A push to `develop` runs the complete
  integration suite; `develop` may be temporarily red after a push. `main` stays fail-closed: the
  release pull request must pass `Repository Policy` and `Application Suite` before merge.
- Before promotion, run `pnpm ops:release-checks <exact-sha>` to require Repository Policy,
  Application Suite and static capability evidence. Pending, cancelled, skipped, missing, untrusted
  or different-SHA evidence blocks this check. Recheck after final integration.
- This CLI is a fail-closed operator check, not proof that branch rules or provider-side Preview
  protection are configured; inspect the `main` ruleset. Never call a release ready from CI alone.
- Database-dependent ranges follow [Database-dependent releases](#database-dependent-releases); the
  contract gate does not replace database compatibility checks or owner deployment authorization.

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
- Prefer updating `[Unreleased]` in the same task branch that ships the behavior, not only at tag
  time.
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

Integrate the candidate into `develop` from Integration as the
[task lifecycle](git-governance.md#task-lifecycle) defines, then push `develop`. Wait for
`Repository Policy` and `Application Suite` on that exact SHA before opening the release pull
request.

### 5. Promote the validated commit to `main`

Before this promotion, when the release range changes anything inside the CSS visual-parity gate
scope ("Profile LAYOUT deletion or move" in
[`../domains/theme/css-visual-parity.md`](../domains/theme/css-visual-parity.md#scope-of-this-gate),
or a `published` lifecycle change that adds a route to the canonical matrix), obtain the owner's
release-time visual confirmation. The confirmation reviews the candidate produced with the pinned
runtime and identifies the exact source SHA, matrix hash, and candidate-manifest SHA-256. Record
that acceptance through `pnpm visual:parity:accept` before this step, land the accepted references
on `develop` through the same integration as step 4, and wait for `Application Suite` on that
resulting `develop` SHA. The commit that changes the matrix (for example the `published` flip) is
committed first with normal hooks; the matrix pin is a branch gate (`validate:changed`, CI), so the
accepted references land in the following commit of the same task branch. This is a human release
decision, not an automatic action performed by CI or Vercel after a deployment begins.

If visual confirmation is missing or rejected, the candidate is not eligible for promotion or
deployment. Do not reduce visual coverage, relax comparison, or treat a Preview build as approval.

Then open the release pull request from `develop` to `main`, merge it once the required checks pass,
and fast-forward `develop` back to `origin/main`, as
[Git governance](git-governance.md#production-promotion) defines. Agents prepare the pull request
with the [`production-pr`](../../.agent/skills/production-pr/SKILL.md) skill.

### 6. Verify the promoted deployment

Verify the automatic Production deployment and critical smoke routes for the merged `main` SHA. If
the deployment fails, revert on a task branch, integrate it into `develop`, and release again; never
rewrite `main`.

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
2. Require complete CI and review the automatic Preview for the release branch.
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
