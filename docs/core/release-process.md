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
- Prefer recording the note when the task closes, not only at tag time. A board task records it with
  `pnpm board close <id> --changelog="Added: <una línea>"` (any Keep a Changelog group: `Added`,
  `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) or `--changelog=ninguno`, so lanes F5–F12
  never edit `CHANGELOG.md` in parallel and never conflict there. A branch without a board task may
  still add its bullet under `[Unreleased]` directly.
- At release preparation (`release-prepare`), run
  `pnpm board changelog --desde=<date of the last tag>` from Integration to print the merged tasks'
  notes as `[Unreleased]` Markdown, each bullet ending in its PR, and paste them in;
  `pnpm board changelog --desde=<date> --faltan` then lists the notes `[Unreleased]` still lacks and
  exits 1 until none is missing. Edit the pasted bullets like any other: the board notes are a
  source, not the final wording.
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
- [ ] Every bullet still matches the code at the candidate HEAD; drop or correct bullets whose
      change was reverted later in the range.
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
# Run in an explicitly assigned external lane, including F12 when assigned.
git switch -c chore/release-vX.Y.Z develop
git add package.json CHANGELOG.md
git commit -m "chore(release): publish vX.Y.Z checkpoint"
```

Push the branch and land it in `develop` through its pull request, as the
[task lifecycle](git-governance.md#task-lifecycle) defines. The merge commit of that pull request is
the release SHA.

### 5. Cut the fixed candidate and promote it to `main`

The release leaves from `candidate/vX.Y.Z`, a branch that points at the release SHA and never
receives commits of its own (d289). `develop` stays open: pull requests that merge after the cut
belong to the next release.

```bash
git fetch origin
git push origin <release-sha>:refs/heads/candidate/vX.Y.Z
git fetch origin
pnpm ops:release-checks <release-sha> --candidate candidate/vX.Y.Z
```

`ops:release-checks --candidate` refuses a candidate that moved off the release SHA, a SHA outside
`origin/develop`, or a SHA that does not contain `origin/main` (the previous release has not merged
back into `develop` yet). Wait for `Repository Policy`, `Application Suite` and
`Application / static` on the release SHA: the `develop` push reports them, and the candidate pull
request reports them again on the same SHA if a later `develop` push cancelled that run.

Preview evidence is read for the same SHA with
`pnpm ops:release-status -- --sha <release-sha> --target preview --wait`. A later `develop` push can
supersede a Preview deployment still queued for the release SHA; then dispatch
`gh workflow run deploy.yml --ref candidate/vX.Y.Z` for it (the stable Preview host serves the
candidate until the next `develop` push) and read the status again.

A fix needed during the release lands in `develop` through its own pull request like any task. Then
close the release pull request, cut a new candidate at a `develop` SHA that contains the fix (for
example `candidate/vX.Y.Z-2`; everything merged up to that SHA joins the release) and update the
CHANGELOG through step 4 if the new range adds user-facing changes. Never commit on, rebase or move
a candidate branch.

Before the promotion, when the release range changes anything inside the CSS visual-parity gate
scope ("Profile LAYOUT deletion or move" in
[`../domains/theme/css-visual-parity.md`](../domains/theme/css-visual-parity.md#scope-of-this-gate),
or a `published` lifecycle change that adds a route to the canonical matrix), obtain the owner's
release-time visual confirmation. The confirmation reviews the candidate produced with the pinned
runtime and identifies the exact source SHA, matrix hash, and candidate-manifest SHA-256. Record
that acceptance through `pnpm visual:parity:accept` before cutting the candidate, land the accepted
references on `develop` through the same integration as step 4, and cut the candidate at a SHA that
contains them. The commit that changes the matrix (for example the `published` flip) is committed
first with normal hooks; the matrix pin is a branch gate (`validate:changed`, CI), so the accepted
references land in the following commit of the same task branch. This is a human release decision,
not an automatic action performed by CI or a deployment.

If visual confirmation is missing or rejected, the candidate is not eligible for promotion or
deployment. Do not reduce visual coverage, relax comparison, or treat a Preview build as approval.

Then open the release pull request from `candidate/vX.Y.Z` to `main`, merge it once the required
checks pass, and merge `main` back into `develop` through a pull request, as
[Git governance](git-governance.md#production-promotion) defines. Agents prepare the pull request
with the [`production-pr`](../../.agent/skills/production-pr/SKILL.md) skill.

### 6. Verify the promoted deployment

Upload the Production Worker through the manual workflow, obtain scoped activation approval,
activate the exact version and verify the domain smoke for the merged `main` SHA. Follow
[release execution](release-execution.md); an upload alone does not route traffic. If the deployment
fails, revert on a task branch, integrate it into `develop`, and release again; never rewrite
`main`.

### 7. Create and push the annotated tag

```bash
git tag -a v0.X.Y -m "v0.X.Y - Short description of checkpoint"
git push origin v0.X.Y
```

The release session creates and pushes the annotated tag as soon as `pnpm ops:release-status`
reports `VERIFIED` for the promoted `main` SHA, in the same turn and within the same release
authorization. The tag is part of the authorized release scope, so the session does not ask the
owner again and does not hand the tag back as a separate owner step. The tag is never created before
the exact promoted deployment is `VERIFIED`. Do not force-update an existing tag.

## Database-dependent releases

### Data prerequisites

A data prerequisite is a fact about stored data, not schema, that released code relies on: for
example "every account that logs in by alias has the alias in `app_metadata.login_alias`". No
migration or capability check sees it, and unit tests feed the code synthetic data, so the code can
be correct and still lock real accounts out. `supabase/data-prerequisites.json` is where those facts
are declared and where the evidence that each environment satisfies them is recorded.

These checks read the manifest or produce its evidence:

| Check                                   | When it runs                                             | What it refuses                                                                                          |
| --------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tests/unit/data-prerequisites.test.ts` | Every CI run                                             | Undeclared `app_metadata` key reads in `src/`, `scripts/` or `supabase/functions/`; an invalid manifest. |
| `pnpm ops:release-checks`               | Before promoting or activating an exact release SHA      | A release whose manifest has a prerequisite without evidence for Production.                             |
| `pnpm auth:check-login-alias`           | Every Preview and Production release upload, and by hand | A release while `legacyOnly` or `duplicates` is not 0, or the directory is empty (exit code 1).          |
| `pnpm auth:check-pending-passwords`     | By hand, against one environment, to produce evidence    | Nothing by default: reports open password changes and age in days; fails with `--strict` when pending.   |
| `pnpm auth:check-role-app-metadata`     | By hand, against one environment, to produce evidence    | Reports whether Auth metadata matches application roles (exit code 0) or not (exit code 1).              |

The `auth-role-app-metadata` prerequisite compares every Auth account's `app_metadata.role` with
`public.app_user_roles.role`, joined by `user_id`. The table is authoritative; its insert/update
trigger copies the role to Auth. Missing or invalid roles, differences, orphan table rows, or an
empty Auth directory fail the read-only check. It prints only the environment and totals; see
[`scripts/auth/README.md`](../../scripts/auth/README.md) for output and execution details. Preview
and Production remain `pending` until their own successful check is recorded. Do not mark them
verified based on the trigger's existence or unit tests. The command does not repair differences;
any repair needs separate authorization and the guarded workflow for that environment.

The release gate reads the manifest from GitHub at the exact SHA being released, so the evidence
must be merged before the release, not typed during it. A change to the manifest also adds the gate
"data prerequisites verified for Production" to the release classification; it never changes the
release category.

#### Declare an `app_metadata` key

Every key that code under `src/`, `scripts/`, or `supabase/functions/` reads from Auth
`app_metadata` needs one entry under `authAppMetadataKeys`, in the same pull request that adds the
read:

```json
"new_flag": { "migration": "none", "reason": "An absent value reads as false." }
```

Use `"migration": "none"` when accounts that already exist need no data for the new code to treat
them correctly; `reason` must say why, in one sentence a reviewer can check against the code. Use
`{ "prerequisite": "<id>" }` when existing accounts do need data, and add the prerequisite below.

#### Declare a prerequisite

Add an entry to `prerequisites` in the pull request that introduces the dependency:

```json
{
  "id": "auth-login-alias-app-metadata",
  "summary": "Every account that logs in by alias has the alias in app_metadata.login_alias.",
  "introducedBy": "https://github.com/fm-dev-mx/celebra-me/pull/866",
  "verify": "pnpm auth:check-login-alias",
  "environments": {
    "production": { "status": "pending" },
    "preview": { "status": "pending" }
  }
}
```

`verify` is the read-only command that proves the fact in one environment. A prerequisite that is
`pending` (or has no entry) for Production blocks the release on purpose: that is the state in which
the code must not be activated.

#### August 12, 2026 patch prerequisites

The manifest also declares these historical dependencies, initially `pending` for Production and
Preview. A historical patch or migration file is not evidence that its result exists in either
environment. Do not activate a release until the target's evidence has been reviewed and recorded.

| Prerequisite                                      | Source                                                                                              | Read-only verification file                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `20260812-itinerary-gallery-structural-contracts` | `scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql`          | `scripts/manual/data-prerequisites/20260812_itinerary_gallery.sql` |
| `20260812-thankyou-editorial-back-cover`          | `scripts/manual/production-patches/20260812_thankyou_editorial_back_cover_structural_contracts.sql` | `scripts/manual/data-prerequisites/20260812_thankyou.sql`          |
| `20260812-guest-invitation-phone-objects`         | `supabase/migrations/20260812210000_reconcile_guest_invitation_phone_objects.sql`                   | `scripts/manual/data-prerequisites/20260812_guest_phone.sql`       |

After the required-database availability preflight and target identity check in
`.agent/rules/database.md`, an authorized operator runs the manifest's `psql` command from the
repository root with the target connection supplied externally through PostgreSQL connection
variables. Use a role that can read all relevant rows without RLS filtering. Do not put credentials
in the command, evidence, or repository. Each SQL file starts a read-only transaction, returns one
row of totals and `ok`, then rolls back. Exit code 0 alone is insufficient: require `ok = true`. An
SQL error, missing result, unavailable connection, or `ok = false` leaves the entry `pending`.

The content queries require exactly one active published row per original target (four itinerary
targets and three Thank You targets). They check every active published row and every existing
active draft for the explicit variants set by the source patch; the itinerary query requires a
gallery variant only for the three celestial targets. Missing or ambiguous published targets fail
instead of silently passing an empty query. Drafts are optional, matching the original patches.
Share only `invalid_published_targets`, `checked_rows`, `mismatched_rows`, and `ok` as evidence.

The phone query checks the actual canonical nonunique, valid, nonpartial, single-column
`btree(phone)` index without included columns, absence of the legacy or unexpected equivalent index,
and the validated pair CHECK's normalized expression. Migration history alone cannot prove these
objects still exist or have the right definition. This is a schema postcondition rather than a data
backfill; it is declared here to cover the historical reconciliation explicitly. Share only
`target_tables`, `canonical_indexes`, `unexpected_indexes`, `validated_pair_checks`, and `ok`.

Do not rerun these historical content patches automatically. Resolve a mismatch through the current
guarded workflow (managed content or schema as appropriate), then verify again. If targets are
absent intentionally in an environment, keep the prerequisite pending until a reviewer accepts
specific `not-applicable` evidence; absence alone never proves the patch is applied.

#### Record evidence

1. Verify the current state first; a read-only check may already pass without repair. If a repair or
   backfill is needed, run it for the environment through its authorized guarded workflow
   (Production: the owner patch workflow below).
2. Run the `verify` command against that environment and confirm it exits with code 0 and, for the
   Auth checks, that `target` names that environment. For the SQL verifications, also require
   `ok = true` as described above. Its output contains totals only, so paste it into the pull
   request that records the evidence.
3. Set the environment to `verified` with the date and what was done:

   ```json
   "production": {
   	"status": "verified",
   	"verifiedAt": "2026-11-09",
   	"evidence": "Owner patch 20261109_auth_login_alias_app_metadata_backfill.sql applied on release 5716c7c24 with UPDATE 28."
   }
   ```

4. Merge that change before the release that activates the code. The order is always data first,
   evidence second, code third.

Use `"status": "not-applicable"` with an `evidence` sentence when the environment cannot hold the
affected data at all (for example, a table that exists only in another environment). It passes the
gate like `verified`, so do not use it to mean "not checked yet": that is `pending`.

#### Gate messages and how to unblock

- **Message starts with:** `Application code reads Auth app_metadata keys that are not declared:`
  - **Meaning:** CI found a new `app_metadata` read. The message lists key, file and line.
  - **Unblock:** Declare each key as described above. If existing accounts need data, this is the
    moment to plan the backfill.
- **Message starts with:** `Data prerequisites are not verified for production`
  - **Meaning:** The release SHA carries a prerequisite that is `pending` or missing for Production.
    The message lists each one and its `verify` command.
  - **Unblock:** Do not activate the release. Apply the backfill, run the `verify` command, record
    the evidence, merge it and release the SHA that contains it.
- **Message starts with:** `Data prerequisites are unknown`
  - **Meaning:** The manifest could not be read at the release SHA: the commit predates the
    manifest, or GitHub did not answer.
  - **Unblock:** Rerun `pnpm ops:release-checks`. If the SHA really has no manifest, release a newer
    SHA that has it; a SHA without the manifest cannot prove its data is ready.
- **Message starts with:** `supabase/data-prerequisites.json is invalid:`
  - **Meaning:** The manifest breaks its own rules; the message names the entry and the missing
    field (for example `verified` without `evidence`).
  - **Unblock:** Fix the named field. The same check runs in CI, so this normally fails the pull
    request, not the release.
- **Message starts with:** `Login alias prerequisite is NOT met` (from `auth:check-login-alias`)
  - **Meaning:** `legacyOnly` accounts have the alias only in `user_metadata`, `duplicates` aliases
    belong to more than one account, or the target returned no accounts.
  - **Unblock:** Run the backfill for that environment (see "Protected login aliases"); resolve
    duplicates by hand first; with `accounts: 0`, check `SUPABASE_URL` and the key. Until then,
    affected hosts can log in with the account email, not the alias.
- **Message starts with:** `Pending password check failed:` (from `auth:check-pending-passwords`)
  - **Meaning:** With `--strict`, accounts have `must_change_password` open, or the target returned
    no accounts.
  - **Unblock:** Review the open changes and their age; ensure affected users complete their
    password change or re-issue credentials. In advisory mode, verify totals and record evidence.

A gate that blocks is reporting missing evidence, never a judgment about the code. Do not unblock by
deleting an entry, marking `verified` without running the command, or bypassing
`pnpm ops:release-checks`.

#### What these checks do not see

- The key scanner uses TypeScript AST across `src/`, `scripts/` and `supabase/functions/` to detect
  property access, bracket access, local constants, imports using relative paths or `@/*` aliases,
  destructuring, and intra-file helpers or methods receiving or returning the metadata object. It
  enforces a fail-closed policy: unresolvable bracket accesses emit an `<unknown>` key read that
  blocks release until declared or resolved. Real boundaries that require reviewer attention:
  - **Cross-module helpers:** Helpers defined in another file detect reads only if their parameter
    or local variable uses canonical metadata naming (`app_metadata`, `appMetadata`,
    `raw_app_meta_data`); inter-module argument tracking is not performed across file boundaries.
  - **Cross-module methods and dynamic dispatch:** Method calls on objects or instances imported
    from other modules are not tracked across module boundaries.
  - **Custom path aliases:** Only the repository's canonical `@/*` alias (mapped to `src/*`) and
    relative paths are resolved; arbitrary external path aliases are not supported.
  - **Astro files:** Only the frontmatter script block (`--- ... ---`) is scanned; template markup
    is excluded.
  - **Runtime dynamic keys:** Keys computed dynamically at runtime from external data or string
    concatenation cannot be statically resolved and emit `<unknown>` if accessed via brackets.
    Reviewers still own those.
- Only Auth `app_metadata` is scanned. A new dependency on the shape of stored JSON anywhere else
  (invitation content, `user_metadata`, settings columns) must be declared as a prerequisite by its
  author; nothing detects it.
- The manifest records what a person verified. The gate checks that evidence is written down, not
  that it is true, and it does not query any database during the release: the review of the pull
  request that sets `verified` is the control. Evidence is also a point in time; data written later
  by another path is not re-checked unless someone runs the `verify` command again.
- The release gate checks Production only. A `pending` entry for Preview blocks nothing.
- A commit older than the manifest cannot pass the release gate, which includes rolling back to one
  through `pnpm ops:release-checks`.
- Alias login is exercised end to end only in Preview, and only when the repository variable
  `PLAYWRIGHT_HOST_LOGIN_ALIAS` holds the alias of the Preview account; otherwise the deploy run
  shows the warning "Alias login not checked" and skips that test.

### Protected login aliases

Before activating code that reads login aliases exclusively from `app_metadata`, the owner must
complete the alias backfill in the target environment. Run `pnpm auth:migrate-login-alias`
(dry-run), resolve any duplicate aliases, then apply and verify the backfill before activation.
Local and Preview use `pnpm auth:migrate-login-alias --apply` with their respective environment
credentials supplied externally. Do not put credentials in the PR or release evidence.

Production uses the owner patch workflow, because the script intentionally rejects direct Production
apply and this prerequisite does not authorize bypassing that guard. The owner plans and applies
`scripts/manual/production-patches/20261109_auth_login_alias_app_metadata_backfill.sql`:

```bash
pnpm auth:migrate-login-alias --dry-run
pnpm prod:apply -- --patch "scripts/manual/production-patches/20261109_auth_login_alias_app_metadata_backfill.sql"
pnpm prod:apply -- --patch "scripts/manual/production-patches/20261109_auth_login_alias_app_metadata_backfill.sql" --apply
```

The patch copies each legacy alias into `app_metadata` with the same normalization as the script,
never overwrites a protected alias, and stops without writing when two accounts share an alias. The
critical backup stores the previous `auth.users` metadata. After apply the plan must report zero
target rows and `pnpm auth:check-login-alias` must exit with code 0 and report `legacyOnly: 0`;
alias login returns within 30 seconds, once each Worker instance reloads its alias directory. Keep
administrative alias changes paused between plan and apply.

The check also runs on every release, so an account created later with its alias only in
`user_metadata` is caught: `.github/workflows/deploy.yml` (Preview) and
`.github/workflows/deploy-production.yml` (Production upload) run `pnpm auth:check-login-alias`
before publishing the Worker version and fail while `legacyOnly` or `duplicates` is not 0. The step
is read-only and prints totals only. Preview reads `vars.PUBLIC_SUPABASE_URL` with the
`PREVIEW_SUPABASE_SERVICE_ROLE_KEY` secret; Production derives its URL from
`PRODUCTION_SUPABASE_REF` and uses the `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` secret. Both secrets
must exist before the workflow runs. Account creation (`createAdminUser`) already writes
`app_metadata.login_alias`.

If the backfill evidence is unavailable, keep activation blocked. Record the target, successful
migration verification and ordering in both the application PR and release handoff. There is no
runtime fallback to user-editable `user_metadata` aliases; activating first prevents unmigrated
hosts from logging in by alias. Until the backfill is applied, an affected host can still log in
with the account email (`<alias>@clientes.celebra.invalid` for managed host accounts) instead of the
alias.

The login throttle also has operational limits: the identifier/account bucket (10 attempts per 900
seconds, without IP) lets a third party temporarily block a known host's login. The IP bucket (30
per 600 seconds) and account buckets use per-instance memory because Workers rate-limit bindings do
not support those windows. Limits are not shared across isolates, and the missing binding warning is
emitted once per isolate in Production.

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
