# Default mode — `promote-develop-to-main`

Load after `.agent/skills/branch-lane/SKILL.md`. **Follow the Fast-Forward Flow in**
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md) — do not invent a parallel
promotion policy. Orchestration, statuses, and parity routing live in the parent skill.

## Intent

**Default lane** for promoting validated work from `develop` to protected `main` through a pull
request. GitHub branch rules are the authoritative write boundary.

State every planned Git action with exact direction, for example:

`fast-forward main@<mainSha> to develop@<developSha> (source develop, target main)`.

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
2. On `develop`, update and validate before touching `main`:

```bash
git switch develop
git pull --ff-only origin develop
pnpm run ci
```

If `ci` is too heavy for the authorized scope, state that explicitly (`Skipped` with reason), run
the closest gatekeeper-appropriate substitute, and do **not** claim full CI passed. Red CI without
an explicit current-task override → `Fail` / stop (do not invent bypass authority).

3. Create or update a pull request from `develop` to `main` — source `develop@<sha>`, target
   `main@<sha>`. Do not switch to or commit on `main` locally.

```bash
gh pr create --base main --head develop
```

If the branch is not up to date or the pull request cannot be merged without violating repository
rules: `Hard blocked` / `Needs decision` — suggest `sync-main-into-develop`.

4. Tag only if separately authorized:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z <theme>"
```

5. Push `develop` only if authorized. Merge the pull request only after required checks and any
   required review pass:

```bash
git push origin develop
# if tag authorized:
git push origin vX.Y.Z
```

Never push directly to `main`, use `--force` / `--force-with-lease`, or commit on `main`.

## Report

Use the parent nine-section report. Include parity JSON summary, checkpoint/clearance validity,
lane-direction SHA wording, diagnosis outcomes, and each finding's status fields.
