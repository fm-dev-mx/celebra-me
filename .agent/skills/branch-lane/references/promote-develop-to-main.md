# Default mode — `promote-develop-to-main`

Load after `.agent/skills/branch-lane/SKILL.md`. **Follow Production Promotion in**
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md#production-promotion) — do
not invent a parallel promotion policy. Orchestration, statuses, and parity routing live in the
parent skill.

## Intent

**Default lane** for promoting validated work from `develop` to protected `main` through a pull
request. GitHub branch rules are the authoritative write boundary.

State every planned Git action with exact direction, for example:

`release PR develop@<developSha> into main@<mainSha>, then back-merge main into develop`.

## Preconditions

- Parent orchestrator discovery completed; mode selected as `promote-develop-to-main`.
- Working tree clean (or explicit exception authorized) — else `Hard blocked`.
- `origin/main` is an ancestor of `origin/develop`. Else `Needs decision` → recovery sync first —
  never force-push.
- `pnpm db:branch:parity -- --base origin/main --head origin/develop --json` completed.
  - `identityStatus: fail` → do not promote (`Hard blocked` / `Fail` per findings).
  - `requiresParityAudit: true` → parent already invoked `database-parity`; all blocking read-only
    diagnosis finished; clearance fingerprint must be valid before writes.
- Git-only promote without pending remote migrations is allowed only when compatibility is
  demonstrated; incompatible head↔remote schema is `Hard blocked`.
- User explicitly authorized the planned Git writes in this task (`Needs authorization` until yes).
  Do not request that authorization until diagnosis/authorization plan is stable.

## Procedure

1. Confirm checkpoint then clearance fingerprints still match (parent handles). If invalidated,
   re-run affected checks — do not treat staleness alone as failure.
2. In Integration (on `develop`), update and validate before touching `main`:

```bash
git pull --ff-only origin develop
```

Select local checks through validation procedures and reuse matching completed evidence. Require
`pnpm ops:release-checks <exact-integrated-sha>` before opening the release PR. Local CI does not
replace the required integration and PR checks; red or missing required CI stops promotion.

3. Push `develop` only if authorized, then wait for `Repository Policy` and `Application Suite` on
   that exact SHA (`pnpm ops:release-checks <40-hex-sha>`):

```bash
git push origin develop
```

4. Open the release pull request through the `production-pr` skill (source `develop@<sha>`, target
   `main@<sha>`); do not create it here. Do not switch to or commit on `main` locally. If the branch
   is not up to date or the pull request cannot be merged without violating repository rules:
   `Hard blocked` / `Needs decision` — suggest `sync-main-into-develop`.

5. Tag only if separately authorized, and push the tag only after that authorization. Merge the pull
   request only after required checks and any required review pass:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z <theme>"
git push origin vX.Y.Z
```

After the merge, run the `sync-main-into-develop` back-merge (a fast-forward). Never push directly
to `main`, use `--force` / `--force-with-lease`, or commit on `main`.

## Report

Use the parent nine-section report. Include parity JSON summary, checkpoint/clearance validity,
lane-direction SHA wording, diagnosis outcomes, and each finding's status fields.
