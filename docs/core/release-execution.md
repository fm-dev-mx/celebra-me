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
3. Read [Git Safety sessions](git-safety-session.md). Start before edits and close with one combined
   declaration that covers every authorized operation (for example `branch-switch,commit` or
   `history` for an integration that moves HEAD). Recheck the full diff after hooks/integration. A
   failed command that changed state requires inspection before any retry. Declarations describe
   existing authority and never grant it; preserve a failed baseline.
4. Fetch origin, resolve exact remote base/source SHAs and ancestry, and inspect the complete range.
   Integrate in-scope task branches into develop with merge commits as
   [Git governance](git-governance.md#task-lifecycle) defines, without rewriting shared history. If
   switching to develop would violate lane assignment or another checkout owns it, stop and request
   assignment of that exact integration checkout. Do not evade the boundary with alternate worktrees
   or refspecs. Conflicts with ambiguous intent require a decision; never choose `ours`/`theirs`
   automatically. Recheck remote tips immediately before every write.

## Checks and evidence reuse

- Inspect the actual diff; Repository Policy already runs `ops:classify-release` on the pushed SHA.
  Select local checks through [validation procedures](validation-procedures.md), and run
  `pnpm visual:matrix:check` (seconds, browserless) before pushing visual-impact paths. Do not run
  full local CI merely because this is a release. Preserve normal pre-commit and pre-push hooks.
- Run `pnpm db:branch:parity -- --base <base-sha> --head <head-sha> --json` for the relevant range.
  Use branch-lane/database-parity read-only diagnosis for the same SHAs when sensitive. Do not
  inherit persistent DB mutation authority from those skills; their only automatic write is the
  disposable-test reset that database-parity performs while diagnosing. Missing compatibility proof
  stops dependent deployment. Obtain separate scoped authority if a mutation is genuinely required,
  with its concrete plan already prepared.
- Reuse successful evidence only for matching SHA/range, files/artifacts, configuration, runtime,
  command and target. Uncommitted input checks need matching content, not just HEAD. A new merge
  SHA, changed lockfile, baseline, matrix or runtime invalidates affected evidence. Do not repeat
  `test:changed` after `validate:changed`; the normal commit hook remains a separate index gate.
- Repository CI owns exact-SHA visual certification on the `develop` push. Optionally preview it
  once with
  `pnpm validate:prepush -- --sha <head-sha> --base-sha <base-sha> --target-ref refs/heads/develop`.
  Always provide the base. Its existing cache is evidence, never authorization. Do not replace
  remote Repository CI with a local cache or substitute PR merge-SHA evidence for develop evidence.
- Coverage changes or visual modifications require a complete new candidate and exact hash-bound
  human acceptance. Existing approval must match reference SHA, matrix hash and candidate-manifest
  hash. Do not transfer approval after regeneration or infer it from this invocation. Accepted files
  and their recorded integrity must match. Use
  `pnpm visual:parity:candidate:certified -- --sha <sha>` for missing review evidence; inspect the
  concise summary and `.tmp/visual-parity/candidate/changes.html` in the workspace. Acceptance uses
  `pnpm visual:parity:accept` (which validates that candidate artifacts match the clean HEAD and
  verifies manifest integrity without manual hash copying). Human acceptance stays outside automated
  invocation. Never edit a manifest to manufacture coverage or relax comparison thresholds.

## Preview integration

1. Stage only named scope, commit only when needed, and inspect resulting commit/working tree.
   Already committed scope requires neither staging nor a new commit. A needed commit (for example
   accepted visual baselines) goes on a task branch created from `develop` and is then integrated
   per [Git governance](git-governance.md#task-lifecycle) (a single commit fast-forwards); never
   author it directly on `develop`.
2. Push only the validated `develop` ref with normal hooks and Git LFS. If origin already points at
   the intended SHA, skip the push and discover the existing CI/deployment.
3. Run `pnpm ops:release-status -- --sha <exact-sha> --target preview --wait` once, in the
   background, and act on its single JSON result. It is read-only and polls silently (up to 20
   minutes) for:
   - trusted Repository Policy, Application Suite and Application / static results on the exact SHA
     (task-branch CI is insufficient);
   - the Preview deployment Vercel recorded on GitHub for that SHA: success state and an immutable
     Preview URL;
   - the `Vercel - celebra-me preview smoke` check. The Post-deploy Smoke workflow runs it on
     `vercel.deployment.ready` for `develop`. It checks the dispatch, the `/api/health` SHA,
     published invitation images (browserless) and `test:e2e:preview:public`;
   - `/api/health` build identity on that URL, which must not report another SHA.

   `VERIFIED` is the success for a built deployment. `SKIPPED` is the only other success, and only
   for Preview: required CI passed and Vercel's latest `Vercel` status for the exact SHA is
   "Canceled by Ignored Build Step" (`scripts/ops/vercel-ignore-build.mjs`: no application input
   changed). No deployment or smoke exists for that SHA; report it as skipped, with the unchanged
   application inputs, and never present it as a deployed Preview. Production never reports
   `SKIPPED`. `PENDING` after the timeout is unverified, and `FAILED` names its blockers. Do not
   synthesize evidence or redeploy to make it pass.

   While a smoke rerun is queued or in progress, `--wait` keeps the smoke `PENDING` (state
   `rerun <status>`, field `smoke.rerun`) instead of reporting the previous failed attempt. When the
   image verification step fails, the run summary lists each failing route, asset and reason, and
   the full JSON is uploaded as a short-lived artifact. Package images the target has not received
   yet are listed as `PENDING_PUBLISH` and never fail the smoke: they are a content backlog that
   `pnpm dbs` resolves, not a delivery problem of the deployment.

4. Only when the CI smoke cannot run (for example a failed dispatch), use `--smoke skip` and run
   `pnpm test:e2e:preview:public` locally against the reported URL, as both `PLAYWRIGHT_BASE_URL`
   and `PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST`. `scripts/playwright/preview-environment.ts`
   owns the host, project and bypass prerequisites. Never run provisioning or publication suites to
   make smoke pass.

## Production promotion

1. Complete or reuse Preview integration and required visual acceptance. Check live main rules;
   missing required PR/check protection is a blocker requiring separate administrative action.
2. Require main ancestry and schema compatibility using branch-lane. Reuse its valid checkpoint, not
   its prompts for authority already carried by this invocation. No unconditional local
   `pnpm run ci` replay. Main-only work or divergent scope requires a decision before recovery.
3. Find the existing open PR for `develop` → `main` before creating/updating it. Use production-pr
   for scope, template and evidence; this invocation continues beyond that helper's PR-only end.
   Attach the PR when the host supports it. Wait for required checks/reviews for the current PR head
   and merge candidate; recheck source/base before merge. Never use admin/bypass/force options. When
   the `Evidence reuse` job confirms the completed `develop` run for an identical tree, the
   application tiers report skipped and `Application Suite` still passes; a declined reuse runs them
   in full.
4. Merge through the permitted PR method, pinned to the reviewed head (for example the supported CLI
   head-match option). Read the merge result and actual main SHA; do not assume SHA equality. Then
   fast-forward `develop` to `origin/main` from Integration
   ([back-merge](git-governance.md#production-promotion)).
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
