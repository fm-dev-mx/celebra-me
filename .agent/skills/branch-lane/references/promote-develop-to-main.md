# Default mode — `promote-develop-to-main`

Load after `.agent/skills/branch-lane/SKILL.md`. **Follow Production Promotion in**
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md#production-promotion) — do
not invent a parallel promotion policy. Orchestration, statuses, and parity routing live in the
parent skill.

## Intent

**Default lane** for promoting validated work from `develop` to protected `main` through a pull
request from a fixed `candidate/vX.Y.Z` branch (d289). The candidate points at one `develop` SHA and
never receives commits; `develop` keeps receiving merges, which reach `main` with the next release.
GitHub branch rules are the authoritative write boundary. The mode keeps its historical name.

State every planned Git action with exact direction, for example:

`release PR candidate/vX.Y.Z@<releaseSha> into main@<mainSha>, then back-merge PR main into develop`.

## Preconditions

- Parent orchestrator discovery completed; mode selected as `promote-develop-to-main`.
- Working tree clean (or explicit exception authorized) — else `Hard blocked`.
- The release SHA is on `origin/develop` and contains `origin/main` (the previous back-merge
  landed). Else `Needs decision` → recovery sync first — never force-push.
- `pnpm db:branch:parity -- --base origin/main --head <release-sha> --json` completed.
  - `identityStatus: fail` → do not promote (`Hard blocked` / `Fail` per findings).
  - `requiresParityAudit: true` → parent already invoked `database-parity`; all blocking read-only
    diagnosis finished; parity and diagnosis must have run for the exact SHAs before writes.
- Git-only promote without pending remote migrations is allowed only when compatibility is
  demonstrated; incompatible head↔remote schema is `Hard blocked`.
- User explicitly authorized the planned Git writes in this task (`Needs authorization` until yes).
  Do not request that authorization until diagnosis/authorization plan is stable.

## Procedure

1. Confirm parity and diagnosis ran for the current SHAs (parent handles). If HEAD moved, re-run
   affected checks — do not treat staleness alone as failure.
2. The release SHA is the `develop` merge commit of `chore/release-vX.Y.Z`
   ([release process](../../../../docs/core/release-process.md#5-cut-the-fixed-candidate-and-promote-it-to-main)).
   Cut the candidate at that SHA without switching `develop` or committing anywhere, then prove it:

```bash
git fetch origin
git push origin <release-sha>:refs/heads/candidate/vX.Y.Z
git fetch origin
pnpm ops:release-checks <release-sha> --candidate candidate/vX.Y.Z
```

Select local checks through validation procedures and reuse matching completed evidence. Local CI
does not replace the required integration and PR checks; red or missing required CI stops promotion.
Never move, rebase or commit on a candidate; a fix lands on `develop` and a new candidate is cut.

3. Open the release pull request through the `production-pr` skill, the canonical PR procedure
   (source `candidate/vX.Y.Z@<sha>`, target `main@<sha>`); do not create it here. Do not switch to
   or commit on `main` locally. If the pull request cannot be merged without violating repository
   rules: `Hard blocked` / `Needs decision` — suggest `sync-main-into-develop`.
4. Merges into `develop` continue during the release; they do not change the candidate.
5. Merge the pull request (merge commit, pinned to the release SHA) only after required checks and
   any required review pass, when the merge is authorized. Then run the `sync-main-into-develop`
   back-merge (a pull request from `main` into `develop`). Never push directly to `main`, use
   `--force` / `--force-with-lease`, or commit on `main`.
6. Tag only when separately authorized, and only after the automatic Production deployment of the
   merged `main` SHA is verified
   ([release process](../../../../docs/core/release-process.md#7-create-and-push-the-annotated-tag)):

```bash
git tag -a vX.Y.Z -m "vX.Y.Z - Short description of checkpoint"
git push origin vX.Y.Z
```

## Report

Use the parent nine-section report. Include parity JSON summary, the SHAs the evidence covers,
lane-direction SHA wording, diagnosis outcomes, and each finding's status fields.
