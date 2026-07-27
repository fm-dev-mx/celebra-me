# Default mode — `promote-develop-to-main`

Load after `.agent/skills/branch-lane/SKILL.md`. **Follow the Fast-Forward Flow in**
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md) — do not invent a parallel
promotion policy. Orchestration, statuses, and parity routing live in the parent skill.

## Intent

**Default lane** for solo trunk work on `develop`: update protected `main` to match `develop` using
**fast-forward only**.

State every planned Git action with exact direction, for example:

`fast-forward main@<mainSha> to develop@<developSha> (source develop, target main)`.

## Preconditions

- Parent orchestrator discovery completed; mode selected as `promote-develop-to-main`.
- Working tree clean (or explicit exception authorized) — else `Hard blocked`.
- `origin/main` is an ancestor of `origin/develop` (FF possible). Else `Needs decision` → recovery
  sync first — never force-push.
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

3. Fast-forward `main` (no non-FF fallback) — source `develop@<sha>`, target `main@<sha>`:

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only develop
```

If `merge --ff-only` fails: `Hard blocked` / `Needs decision` — suggest `sync-main-into-develop`.

4. Tag only if separately authorized:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z <theme>"
```

5. Push only if authorized (`push develop@<sha> / main@<sha> to origin/main`):

```bash
ALLOW_MAIN_PUSH=true git push origin main
# if tag authorized:
git push origin vX.Y.Z
```

Never `--force` / `--force-with-lease`. Do not commit on `main`.

## Report

Use the parent nine-section report. Include parity JSON summary, checkpoint/clearance validity,
lane-direction SHA wording, diagnosis outcomes, and each finding's status fields.
