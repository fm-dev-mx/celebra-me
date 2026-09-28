---
name: production-pr
description: |
  Prepare and open a production pull request with an explicit release range, current validation evidence, and task-scoped Git authorization. Stops before merge or deployment.
domain: workflow
version: 1.1.0
when_to_use:
  - Prepare or open a pull request intended for production
  - Audit the scope and evidence for an existing production pull request
preconditions:
  - AGENTS.md
  - .agent/routing-matrix.yaml
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - docs/core/git-safety-session.md
  - docs/core/git-governance.md
  - docs/core/release-process.md
related_skills:
  - commit-planner
  - branch-lane
related_docs:
  - docs/core/validation-procedures.md
  - .agent/plans/README.md
---

# Production PR

When used inside explicitly invoked `publish-production`, its documented invocation authority covers
scoped PR creation/update and subsequent merge. Reuse it without another approval prompt; return to
that skill for deployment verification. Standalone PR preparation still ends at the PR.

Prepare a reviewable release comparison and open its PR when the required evidence and authority are
present. Repository policies own branch strategy, validation, and authorization; this skill only
assembles their PR preparation steps.

Use [commit-planner](../commit-planner/SKILL.md) for atomic commits when needed.
[Branch-lane](../branch-lane/SKILL.md) owns promotion, branch recovery, and versioned release
preparation. Do not activate those broader operations merely to write a PR description.

## Establish scope and state

1. Resolve the Task Contract: requested outcome, included changes, allowed Git operations, target
   environment, and stop conditions. Reuse explicit current-task authorization; ask only for missing
   scope or authority.
2. Stay in the assigned checkout. Inspect current branch/detached state, HEAD, upstream, remote
   identity, staged and unstaged diffs, untracked files, and any in-progress Git operation. Record
   the initial state and ownership before writes. Stop on unrelated work, ambiguous ownership,
   unexpected drift, or an occupied checkout; never stash, reset, clean, or unstage to make room.
3. Read the [session procedure](../../../docs/core/git-safety-session.md). Start Git Safety before
   edits. Reuse a baseline only when this same task started it; an existing baseline from another
   task or a failed start blocks mutations and must be preserved.
4. Resolve the production base and allowed source from current
   [Git governance](../../../docs/core/git-governance.md) and
   [release policy](../../../docs/core/release-process.md). The documented release comparison is
   `develop` into `main`; verify those refs live instead of inferring a base from the default
   branch, branch name, local `main`, or worktree location. If policy is missing or contradictory,
   report the exact conflict and ask before dependent Git writes.
5. Compare remote tips with local refs, ancestry, exclusive commits, and the complete proposed PR
   diff. Inspect both commits and file changes: a clean working tree does not imply an empty
   release. List included commits/files, excluded work, and why the boundary is justified. A PR
   includes all differences between its refs; if that range contains unauthorized work, stop. Never
   rewrite shared history to manufacture a smaller release.

## Prepare only the authorized changes

- Discover an existing open PR for the exact source/base pair before creating another. Updating an
  existing PR requires authority for that update; report it if only creation was requested.
- Inspect repository PR templates in `.github/`, `docs/`, and the root, including template
  directories. Use the applicable template. If none exists, use the content contract below and state
  that fallback; do not create a template as an incidental change.
- Make only the required task edits. Apply the matching context routes and keep prior work intact.
  Do not add version bumps, tags, changelog entries, or release automation unless the requested
  checkpoint and its owning policy require them. Report the layered changelog verdict.
- When commits are authorized, use explicit file paths and the commit-planner boundary. Inspect the
  staged diff before committing; preserve meaningful prior commits and run the normal hooks. Stop if
  mixed hunks, unrelated staged work, or a hook failure requires additional authority.
- Git Safety declarations describe one already-authorized operation, not a general bypass. A branch
  switch and a commit cannot share one `--authorized-operation` declaration. Close the branch-switch
  session with its exact branch, then start the commit session before continuing. Use the existing
  lifecycle; never overwrite a baseline or change the detector to get a pass.

## Collect evidence for the exact range

Read [validation procedures](../../../docs/core/validation-procedures.md) and available
`package.json` scripts. Select checks for the entire PR range, distinguishing earlier application
commits from new documentation edits. Record commands, exit results, checked SHA/range, skipped
checks, and environment limitations.

- Use `pnpm validate:changed` when working-tree files match the task; otherwise use explicit task
  paths. Add structure and link validation for skill/governance changes. Apply TypeScript, domain,
  browser, and visual checks when the actual changed surfaces require them.
- Inspect the release classifier and use
  `pnpm ops:classify-release -- --base <base-sha> --head <head-sha>` for advisory impact
  classification. A tooling-only result does not waive required remote CI. Database-sensitive or
  visual ranges retain their owning evidence and human gates; report missing evidence without
  applying migrations, publishing content, or accepting images.
- Before an authorized push, recheck scope, remote tips, fast-forward compatibility, and effective
  branch rules. Honor the normal pre-push checks, including exact-SHA visual certification when
  selected. Push only the intended source ref; never force, bypass hooks, merge, or push `main`.
  Report automatic Preview/CI effects inherent in the authorized push or PR.
- Follow the release policy's integration gate: `Repository Policy` and `Application Suite` must
  pass on the exact integrated `develop` SHA before opening its release PR. Confirm trusted
  workflow/ref/SHA evidence; missing, pending, skipped, cancelled, or different-SHA results are not
  success. Do not use a draft PR to bypass a prerequisite for opening the release PR.
- Keep local checks, integration CI, PR CI, visual acceptance, and deployment/smoke evidence
  distinct. Preparing or opening a PR does not establish production readiness. Run release readiness
  checks when required by the owning checkpoint; do not infer deployment approval.

## PR content and creation

Use the repository template if present. Otherwise provide a concise body containing:

- The concrete change and why it is needed; title the PR for the primary outcome.
- Exact base/source branches and audited SHAs, included commits or PRs, and the scope boundary.
- Validation commands actually run and their results, linked CI evidence, and explicit pending,
  failed, or unverified checks. Recheck evidence after any source update.
- Material visual, schema, content, or operational impact; risks and remaining human acceptance.
- Separately authorized follow-up operations and the evidence still required before merge,
  production deployment, or publication. Do not present those future operations as completed.

With creation authorized and prerequisites satisfied, create the PR using explicit `--base` and
`--head` (or equivalent structured fields). For a multiline CLI body, save exact text in a local
scratch file (under `.git/` or `.tmp/`) and use `--body-file`; exclude that file from the commit.
After an uncertain network result, inspect the remote PR before retrying. Verify its URL, state,
refs, head SHA, and changed files against the audited range. Attach the PR to the current task when
the host supports it.

## Close and hand off

Recheck the local state and close the session with `pnpm agent:git-safety:finish`, using only the
matching already-authorized operation when required. On failure, preserve the baseline/evidence and
report the blocker; never repair protected state automatically.

Return the PR URL (or the concrete reason it was not opened), base/source branches and SHAs,
included changes, validation results, pending acceptance, and Git Safety result. Stop after PR
preparation/opening: merging, auto-merge, tags, deployment, database changes, published content,
environment settings, and remote protection changes require separate scope and authorization.
