# Code release execution

Shared procedure for [publish-preview](../../.agent/skills/publish-preview/SKILL.md) and
[publish-production](../../.agent/skills/publish-production/SKILL.md). Branch and release policy
remain in [Git governance](git-governance.md) and [release process](release-process.md). These
skills execute code delivery, not database migrations or managed invitation publication. Auditing or
implementing these skills is never a live-release invocation.

## Preflight and scope

1. Verify assigned checkout, symbolic branch, HEAD, origin identity, upstream, index, unstaged and
   untracked files, active task ownership, in-progress Git operations, and target environment.
   Inspect effective branch rules read-only; unavailable rules cannot prove permission to bypass.
2. Record the requested commit/file boundary, excluded work, target and invocation authority in the
   Task Contract. Infer only an unambiguous scope from the current task. Stop on unrelated staged
   files, mixed ownership, unexpected drift or an incompatible assigned lane. Do not stash/reset/
   clean, overwrite work, enumerate sibling checkouts or create another checkout automatically.
3. Read [Git Safety sessions](git-safety-session.md). Start before edits; an existing baseline is
   reusable only if this task created it. Keep branch-switch and commit sessions separate. Close
   staging with its exact paths before starting the commit session; close a same-branch integration
   that changes HEAD using the commit declaration. Recheck the full diff after hooks/integration. A
   failed command that changed state requires inspection before any retry. Declarations describe
   existing authority and never grant it; preserve a failed baseline.
4. Fetch origin, resolve exact remote base/source SHAs and ancestry, and inspect the complete range.
   Fast-forward develop when possible. Integrate in-scope task commits without rewriting shared
   history. If switching to develop would violate lane assignment or another checkout owns it, stop
   and request assignment of that exact integration checkout. Do not evade the boundary with
   alternate worktrees or refspecs. Conflicts with ambiguous intent require a decision; never choose
   `ours`/`theirs` automatically. Recheck remote tips immediately before every write.

## Checks and evidence reuse

- Use `pnpm ops:classify-release -- --base <base-sha> --head <head-sha>` and the actual diff. Select
  local checks through [validation procedures](validation-procedures.md). Do not run full local CI
  merely because this is a release. Preserve normal pre-commit and pre-push hooks.
- Run `pnpm db:branch:parity -- --base <base-sha> --head <head-sha> --json` for the relevant range.
  Use branch-lane/database-parity read-only diagnosis and its fingerprinted checkpoint/clearance
  when sensitive. Do not inherit persistent DB or disposable mutation authority from those skills.
  Missing compatibility proof stops dependent deployment. Obtain separate scoped authority if a
  mutation is genuinely required, with its concrete plan already prepared.
- Reuse successful evidence only for matching SHA/range, files/artifacts, configuration, runtime,
  command and target. Uncommitted input checks need matching content, not just HEAD. A new merge
  SHA, changed lockfile, baseline, matrix or runtime invalidates affected evidence. Do not repeat
  `test:changed` after `validate:changed`; the normal commit hook remains a separate index gate.
- Let pre-push own exact-SHA visual certification, or precompute once with
  `pnpm validate:prepush -- --sha <head-sha> --base-sha <base-sha> --target-ref refs/heads/develop`.
  Always provide the base. Its existing cache is evidence, never authorization. Do not replace
  remote Repository CI with a local cache or substitute PR merge-SHA evidence for develop evidence.
- Coverage changes require a complete new candidate and exact hash-bound human acceptance. Existing
  approval must match reference SHA, matrix hash and candidate-manifest hash. Do not transfer
  approval after regeneration or infer it from this invocation. Accepted files and their recorded
  integrity must match. Use `visual:parity:candidate:certified -- --sha <sha>` for missing review
  evidence; retain the returned attempt directory. Human acceptance stays outside these skills.
  Never edit a manifest to manufacture coverage or relax comparison thresholds.

## Preview integration

1. Stage only named scope, commit only when needed, and inspect resulting commit/working tree.
   Already committed scope requires neither staging nor a new commit.
2. Push only the validated `develop` ref with normal hooks and Git LFS. If origin already points at
   the intended SHA, skip the push and discover the existing CI/deployment.
3. Wait for Repository CI on that exact integrated SHA. Use `pnpm ops:release-checks <exact-sha>`
   for trusted policy/application/static evidence. Missing, skipped, cancelled, pending or failed
   checks are not success. Task-branch CI is insufficient.
4. Inspect Vercel through an available authenticated read-only connector/API/CLI. Resolve project,
   deployment ID, Git SHA/ref, environment, readiness and immutable deployment URL from provider
   evidence. Do not infer identity from URL spelling or a successful push. Require Preview,
   `develop`, the expected SHA and READY. Compare any requested serving alias to that deployment.
   Run `pnpm ops:post-deploy -- verify` with the provider-sourced `VERCEL_DISPATCH_EVENT`,
   `VERCEL_DISPATCH_ENVIRONMENT`, `VERCEL_DISPATCH_PROJECT_ID`, independently resolved
   `VERCEL_DISPATCH_EXPECTED_PROJECT_ID`, `VERCEL_DISPATCH_DEPLOYMENT_ID`, `VERCEL_DISPATCH_URL`,
   `VERCEL_DISPATCH_COMMIT_SHA`, `VERCEL_DISPATCH_GIT_REF`, and `VERCEL_DEPLOYMENT_STATE`. Set
   `RELEASE_EXPECTED_SHA` and `RELEASE_EXPECTED_ENVIRONMENT` from the Task Contract, not the
   returned deployment. Use ready/Preview and promoted/Production dispatch transitions respectively.
   The verifier checks correlation/readiness only; provider authenticity, alias and smoke are
   independent requirements. Never synthesize provider evidence or set READY to make this pass.
5. Run the read-only Preview smoke with `pnpm test:e2e:preview:public` against the verified URL. Use
   `scripts/playwright/preview-environment.ts` for exact host/project/bypass prerequisites; never
   run provisioning/publication suites to make smoke pass. Reuse prior smoke only when its SHA,
   deployment ID, URL and relevant runtime configuration still match.

## Production promotion

1. Complete or reuse Preview integration and required visual acceptance. Check live main rules;
   missing required PR/check protection is a blocker requiring separate administrative action.
2. Require main ancestry and schema compatibility using branch-lane. Reuse its valid checkpoint, not
   its prompts for authority already carried by this invocation. No unconditional local
   `pnpm run ci` replay. Main-only work or divergent scope requires a decision before recovery.
3. Find the existing open PR for `develop` → `main` before creating/updating it. Use production-pr
   for scope, template and evidence; this invocation continues beyond that helper's PR-only end.
   Attach the PR when the host supports it. Wait for required checks/reviews for the current PR head
   and merge candidate; recheck source/base before merge. Never use admin/bypass/force options.
4. Merge through the permitted PR method, pinned to the reviewed head (for example the supported CLI
   head-match option). Read the merge result and actual main SHA; do not assume SHA equality.
5. Verify Vercel project, actual main SHA/ref, Production environment, READY result, promotion and
   production alias routing. Require the trusted `Vercel - celebra-me production smoke` result for
   this deployed SHA and correlate its deployment ID/URL. The existing Post-deploy Smoke workflow
   owns HTTP and image-delivery checks; inspect all required steps, not just the push or build. An
   old successful smoke on a different deployment of the same SHA is insufficient.

## Recovery, stops and completion

Diagnose the primary failure before retrying: code/test, visual diff, coverage/manifest, runtime
infrastructure, report generation, deployment or smoke. Preserve evidence before rerunning. Routine
reversible fixes within the release scope are included; validate changed inputs, commit with normal
hooks and resume only the invalidated steps. No speculative fix/commit chains.

Allow one retry for a proven transient transport/infrastructure failure after checking remote state.
For an uncertain push/PR/merge result, query the exact ref or PR before retrying; never duplicate an
already completed operation. Respect the existing CI infrastructure retry workflow instead of
triggering another full run. Pixel differences and approval gaps cannot be retried away. For code
remediation use at most three diagnosed fix/verify cycles; stop if still failing.

Poll boundedly (up to 20 minutes per CI/deployment phase, intervals up to 60 seconds). A timeout is
pending/unverified, not success and not permission to redeploy. Missing credentials, required human
review, conflicting work, unsupported provider inspection or missing artifact approval must report
the exact owner action, environment, evidence/command and resume point. Reinvoke the same skill;
reuse still-matching evidence and discover existing remote operations before creating any new one.
Do not perform rollback or migration as implicit recovery.

Close Git Safety, preserve unrelated work, and report: source/integrated/deployed SHA, environment,
deployment ID and URL, CI and smoke results, reused/invalidated evidence, intentional skips,
residual risks and unresolved blocker. Code deployment success does not claim database or invitation
content/assets publication. A push alone never completes either skill.
