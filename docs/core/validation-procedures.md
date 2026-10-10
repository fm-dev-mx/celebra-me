# Validation and Review Procedures

Detailed procedures implementing Gatekeeper. Load the relevant section when selecting review scope,
validation, release evidence, or visual proof. These procedures grant no additional authority.

## 1) Scope of Operation

- The active Task Contract `operation_mode` controls whether this document may edit files:
  `audit`/`validate` are report-only, `implement` permits only the authorized scope, and `remediate`
  permits only the confirmed finding set. This rule never grants Git, database, deployment, or
  provider authority.
- The review/remediation process primarily operates on the current task scope and should inspect the
  actual diff that is being reviewed.
- If staged changes exist, prefer them as the clearest review boundary.
- It must prioritize keeping the repository **buildable and deployable**.

### Exception — Repository Hygiene

The agent may report files **outside the initial diff scope** when repository hygiene requires
attention, including:

- forbidden artifacts that may need removal,
- `.gitignore` updates that may prevent repeated artifacts.

Any such change outside the initial diff scope requires explicit repository-owner authorization and
must be explicitly reported as an extra action.

---

## 2) Allowed Actions

### 2.1 Auto-Fixes

In `implement` or `remediate` mode, the agent may automatically fix:

- broken or unused imports,
- obvious typing issues,
- **new `any` introduced by the reviewed scope** (replace with `unknown` + narrowing when safe),
- incorrect casing,
- UI strings violating language rules,
- Tailwind removal with SCSS replacement (within limits),
- minor accessibility issues.

---

### 2.2 Refactors (Bounded)

In `implement` mode, the agent may perform **small to medium refactors** provided that they:

- stay within the same feature or module,
- improve clarity or correctness,
- do not change public APIs,
- do not introduce new abstractions.

Cross-cutting or architectural refactors require an explicit `implement` Task Contract with bounded
file boundaries and acceptance criteria; otherwise they are not allowed.

---

## 3) Large Change Mode (Review/Remediation)

The agent reviewing an existing diff must switch to **Large Change Mode** when any of the following
apply:

- **≥ 25 files** are in scope, or
- **≥ 800 total lines** are changed (additions + deletions), or
- changes affect structural configuration or core folders (e.g. `src/pages`, `src/styles`,
  `tsconfig`, `astro.config`, `package.json`).

### Behavior in Large Change Mode

Large Change Mode does not override an explicitly authorized `implement` Task Contract. It limits
review/remediation of a pre-existing broad diff to the actions below:

- Fix only:
  - build or deploy breakers,
  - hard guard violations (artifacts, casing, boundary leaks),
  - **new `any` introduced by the reviewed scope** (block/must-fix), avoiding non-trivial typing
    refactors.
- Report all other findings without applying changes.

---

## 4) Release and CHANGELOG Checkpoints

When the reviewed work is a **release checkpoint** or a clearly product-visible milestone:

- Require an explicit `CHANGELOG note:` verdict matching commit-planner: `update Unreleased` or
  `n/a — not a product milestone` (the latter is wrong for a release cut).
- Check `CHANGELOG.md` against the layered policy and, for a release cut or tag, the pre-tag
  checklist in [release process](release-process.md#layered-changelog-policy). Do not demand a
  changelog bullet for every commit or migration file.

---

## 5) Verification Protocol

Non-trivial remediations must record **REGRESSION_DECISION** per
[`.agent/skills/error-remediation/SKILL.md`](../../.agent/skills/error-remediation/SKILL.md).
Regression locks must stay **editor-resilient** per
[`.agent/skills/testing/SKILL.md`](../../.agent/skills/testing/SKILL.md) (Invitation Copy
Assertions) — do not add brittle content-coupled asserts.

### 5.1 Script Detection

- Read `package.json`.
- Detect available scripts dynamically.

### 5.2 Execution Order

Run the closest available match, **scaled to the change scope**:

**A) Small localized style/copy/asset changes — fast local confidence:**

```sh
pnpm validate:changed      # Agent default when the WORKING TREE matches task scope
pnpm agent:git-safety:finish
```

Agents normally cannot stage changes, so `pnpm validate:changed` is the default fast path. It
validates tracked, staged, and untracked working-tree files without modifying the Git index. When
unrelated user-owned changes are present, do not let them widen validation scope: run the
corresponding lint, format, or related-test command against the explicit task files and report the
excluded pre-existing scope.

Use `pnpm validate:staged` instead only when the requested review boundary is explicitly the staged
index, such as a human pre-commit check. It does not look at unstaged edits and no-ops successfully
when there are no staged matching files. Do not run both commands for the same file set.

Prettier is intentionally **advisory** here: the repo carries pre-existing formatting debt in
reviewed files that is not part of the workflow change. Blocking on that debt would conflate scope.
ESLint, Stylelint, and related Jest are hard gates. New or modified files in the workflow commit
must still be formatted — advisory is not a license to commit unformatted code.

Markdown table readability is validated in the same changed/staged scope (see
[Markdown tables](#markdown-tables)).

**B) Shared component, schema, adapter, render-data, routing, Supabase, or content-resolution
changes — broader local feedback:**

```sh
pnpm validate:changed      # ESLint + Stylelint + Prettier + related Jest on WORKING-TREE files
pnpm type-check            # When TS/Astro contracts, types, schemas, adapters, or routing can change
pnpm validate:event-parity # when event/content parity can be affected
pnpm agent:git-safety:finish
```

Use `pnpm validate:changed` when you have unstaged edits you want feedback on before staging. Use
`pnpm test:changed` only as a standalone staged-source Jest check; do not run it after
`pnpm validate:changed`, which already runs related Jest tests. The unrelated-worktree scope rule
from Tier A also applies here.

`pnpm type-check` is required when executable TypeScript or Astro changes can affect shared
contracts, type flow, schemas, adapters, render assembly, or routing. It is not required for
documentation, copy-only, asset-only, or SCSS-only changes. Prefer focused domain validation when it
proves the changed contract more directly.

**C) Release-relevant or repository-wide changes — full pipeline:**

```sh
pnpm run ci                  # Canonical package.json script alias for full pipeline Tier C
pnpm agent:git-safety:finish # Interactive session close — not part of CI
```

`pnpm run ci` is the canonical full-pipeline equivalent of Tier C. It runs `pnpm type-check`,
`pnpm validate:structure`, `pnpm validate:deployed-app-capabilities`, `pnpm lint`,
`pnpm lint:dead-code`, `pnpm lint:styles` (lint caches live under `node_modules/.cache`),
`pnpm validate:ui-governance`, `pnpm validate:dashboard-styles`, `pnpm validate:event-parity`,
`pnpm validate:no-pii`, `pnpm validate:invitation-preparation`, `pnpm test`, `pnpm test:e2e:ci`, and
`pnpm build:app`. It does **not** invoke interactive Git Safety (that requires a same-session
baseline). Use `pnpm validate:changed` for focused feedback; run `pnpm type-check` and
`pnpm validate:structure` when required by the scope. Focused validation does not replace these
repository-wide checks or the full release pipeline.

`pnpm lint:dead-code` runs knip (pinned version, `knip.json`). Unused files, dependencies, unlisted
dependencies and binaries fail the check; unused exports, exported types and duplicate exports are
reported as warnings. A file loaded only at runtime (spawned script, `import.meta.glob` target,
Playwright setup) must be registered as a knip `entry` instead of being ignored.

Opt-in browser suites outside `pnpm test:e2e:ci`: `pnpm test:e2e:extended` runs generic contracts
(motion, progressive visibility, gallery rail, raster seal, managed countdown, location navigation,
RSVP flow, login labels) and the authoring guards of invitations that are still active or in
progress. Run it when a change touches those surfaces or before publishing one of those invitations,
and delete a client guard when its invitation is archived. `pnpm test:e2e:ga4` covers the consent
banner and `gtag` loader (see
[commercial attribution](../domains/tracking/commercial-attribution.md#ga4-status)).

Close the mutable agent session with `pnpm agent:git-safety:finish` after Tier C when a session was
started. See `.agent/rules/git-safety.md`.

The pre-push hook keeps commit-range validation and the Git LFS handoff; do not move tests,
type-checks or visual certification into pre-push (see
[visual certification](#visual-certification-and-candidates)).

#### Remote CI coverage and efficiency

`pnpm run ci` does not include every check in `.github/workflows/commit-validation.yml`. Repository
Policy additionally checks commit messages, documentation links, Markdown tables and invitation
publication transitions, and runs the advisory `ops:classify-release`. The application tiers add the
Memories Worker bundle dry-run and the disposable RSVP, managed and event-memories database
contracts. Browser CI uses canonical fixtures, accepted visual references and the pinned Linux
image; a local diagnostic capture run is not equivalent to that comparison or to human reference
acceptance.

Repository CI runs on pushes to `develop`, on pull requests into `develop` or `main`, and by manual
dispatch. A push to a task branch alone runs nothing: run focused local checks while editing, then
integrate the final range into `develop` and confirm its workflow run exists.

Keep focused validation and pre-commit distinct: `validate:changed` already runs related Jest for
working-tree sources; `test:changed` serves the staged-source pre-commit boundary. Do not rerun
related Jest against unchanged working-tree inputs merely to repeat the same evidence.

The shared Jest selector exempts only `tests/e2e/visual-baselines/manifest.json` from the broad
JSON/configuration fallback. Baseline PNGs are not Jest inputs. This exception does not certify
visual references: provenance, integrity, coverage, complete comparison and human acceptance still
apply. Other JSON/YAML inputs outside `docs/`, including other JSON files in the baseline directory,
require full Jest; deleted non-E2E sources do too. Mixed changes retain the union of these
requirements. Changed Jest tests are passed directly to related-test selection. Contract tests that
read inputs from disk instead of importing them (profile token rules for `src/styles/**.scss`,
migration contracts for `supabase/migrations/**.sql`, component contracts for `*.astro`) are
selected by input kind (`CONTRACT_TESTS_BY_INPUT` in `scripts/related-test-files.mjs`), since the
import graph can never reach them. SCSS still requires its style and applicable rendering checks.

Worker settings currently differ intentionally by execution entry point: Playwright's CI default is
one worker, while the remote browser job explicitly selects two. This documents the existing
behavior, not a measured optimum. Before changing it, compare the same code, cases, runtime image,
fixtures and visual mode across repeated runs, including retries and server preparation. Do not
infer remote savings from local diagnostic timings. Capture suites aggregate per-capture records
after the run and run serially; every remote run uses the locally certified command.

The aggregate application check requires policy, application and browser jobs to succeed; failed,
cancelled or incomplete jobs must never become aggregate approval. One case skips the application
tiers instead of repeating them: a same-repository `develop` → `main` pull request whose merge
candidate has the same Git tree as the `develop` head, when a push run of Repository CI on `develop`
for that exact head completed with every tier successful. The `Evidence reuse` job
(`scripts/ops/ci-evidence-reuse.ts`) verifies this, names the source run in its summary and in
`evidenceSourceRunId`, and declines on any mismatch, unfinished run or unreadable evidence, in which
case every tier runs. Repository Policy always validates the pull request range itself. Dispatch
Repository CI on `develop` to force a complete execution. Failure artifacts retain actual/diff
images and traces when produced for three days. No additional capture, retry, tolerance or
acceptance policy is introduced for diagnostics.

A `develop` push may skip only the browser tier. The `Browser scope` job
(`scripts/ops/ci-browser-scope.ts`) compares the head against the most recent successful `develop`
push run whose `Application / browser` job itself succeeded, and skips the tier only when no browser
input (application sources, served assets, `scripts/shared/`, the Playwright harness, fixtures,
visual references, the workflow itself and the package/Astro/Playwright configuration) changed in
between. Pull requests, manual dispatches, an unreadable history or API, and any changed browser
input run the tier. A run that skipped the tier records a `skipped` browser job, so it is never a
source for evidence reuse or for a later scope assessment; the release pull request then runs every
tier.

Evidence is reusable only for the same SHA, range, configuration, runtime and command. A new final
integration SHA, changed inputs or an unresolved failure justifies revalidation; PR merge-SHA
evidence never certifies a different final commit.

#### Failure classification

- Validation evidence reports one primary cause: `CODE`, `VISUAL_DIFF` or `INFRASTRUCTURE`.
  `Application Suite` is an aggregator and never replaces the primary failing tier. Deployment and
  smoke workflows report `DEPLOY` and `SMOKE`.
- Browser comparison writes `.tmp/browser-outcome.json` with the visual evidence filenames. A failed
  browser job after a successful browser test step is infrastructure-only; a snapshot diff is
  `VISUAL_DIFF`; other browser failures are `CODE`.
- Release classification marks conservative visual impact for application TypeScript/Astro, styles,
  rendered invitation builders/content/assets, fonts, Playwright fixtures/specs, the lockfile and
  screenshot infrastructure. This signal explains when hash-bound human review is additionally
  required and never reduces coverage.

#### Visual certification and candidates

- Exact-SHA visual certification is owned by the `Application / browser` job of Repository CI on the
  `develop` push. `pnpm test:e2e:ci` compares visual references and fails before browser work when
  the certified Linux runtime, isolated fixtures, LFS references or coverage are unavailable.
  Changed Playwright specs need browser evidence; Jest does not run them. Local Render Corpus is
  Jest contract coverage, not visual certification.
- `pnpm validate:prepush -- --sha <exact-sha> --base-sha <base-sha> --target-ref refs/heads/develop`
  is an optional local preview of that certification: an isolated checkout of the exact commit in
  the same digest-pinned Linux Playwright image, using the shared visual-impact classifier. It is a
  no-op for other target refs. Native Windows captures are diagnostic only.
- Its evidence is cached under the worktree's internal Git path and is reusable only while SHA,
  visual matrix, accepted-manifest hash, lockfile hash, verified Node archive, Node/pnpm versions,
  image digest, certified command and command schema all match. It is never committed. Failed
  evidence is retained per attempt for local diagnosis and never changes accepted references.
- `validate:changed` remains fast feedback. When it prints `VISUAL_IMPACT_DETECTED`, its success is
  not visual certification.
- Generate a review candidate with `pnpm visual:parity:candidate:certified -- --sha <exact-sha>`
  (the SHA must equal the clean HEAD), or with the Repository CI manual input
  `visual_mode=candidate` on a published ref and its `visual-candidate-<sha>` artifact. Review
  `candidate/changes.html`, which lists only captures that fail the unchanged comparison plus new
  captures; keep the sibling `candidate-references` and `candidate-diffs` directories. Candidate
  mode never produces a passing `Application Suite`.
- Acceptance (`pnpm visual:parity:accept`) binds the exact reference SHA, matrix hash and
  candidate-manifest SHA-256, followed by a new passing compare. A regenerated manifest requires
  renewed owner approval of that exact artifact; never transfer approval to a different hash.

#### Documentation audit limits

`pnpm ops check-links` checks relative inline link targets in changed Markdown. `--all` scans
`AGENTS.md`, `README.md`, `CHANGELOG.md`, `.agent/` and `docs/`, including historical archives.
Neither mode validates external URLs or section anchors; `--all` is not a complete inventory of
every versioned document. Historical missing paths are dated evidence, not automatically active
procedure failures.

A passing link or table check does not establish semantic alignment. Compare procedures with
`package.json`, hook/workflow code and effective remote configuration; report uncovered documents
and unverifiable claims.

#### Markdown tables

Use tables for compact, comparative data, not implementation narratives.
`scripts/markdownlint/table-readability.mjs` applies to active Markdown documentation and reports a
warning for more than four columns or a visible cell over 120 characters, and a blocking error for a
cell over 240 characters. Move long explanations into paragraphs, lists or subsections.

- `pnpm validate:markdown-tables` checks changed Markdown; `-- --all-active` checks every active
  file through the same allowlist. Other versioned documentation, including `CONTRIBUTING.md` and
  `scripts/README.md`, still requires direct review.
- `pnpm format:markdown-tables -- --files <path...>` (or `-- --all-active`) converts over-long rows
  into field/value records. The pre-commit `lint-staged` pipeline applies that correction, runs
  Prettier and checks again; in VS Code the recommended `DavidAnson.vscode-markdownlint` extension
  applies it on an explicit save before Prettier.
- Historical, generated, temporary and fixture Markdown is outside this rule.

### 5.3 Visual evidence (screenshots and browser proof)

Choose the evidence class **before** launching screenshot or browser tools. This section owns
proportional visual validation; [`scripts/screenshot/README.md`](../../scripts/screenshot/README.md)
owns tool mechanics and flags.

Evidence hierarchy — consume evidence in this order and stop at the first layer that proves the
contract:

1. Focused test result and exit status.
2. Concise `preflight.json` and final `report.json` summaries.
3. Exact filesystem or manifest assertions.
4. Targeted log excerpts for failures or disputed results only.
5. Individual screenshots only when visual judgment is required.

Do not load every generated image, a complete manifest, a full diff, or an entire log by default.

- **Change class:** Material layout, reveal, hero, or section composition
  - **Evidence class:** **Required**
  - **Minimum sufficient proof:** Same route; primary viewport (`mobile-standard` unless
    desktop-only); smallest strict target (`--sections=<id>`, `--set=reveal-only`, or a single
    affected step); reuse an already-running `pnpm dev`
- **Change class:** Reference-driven redesign closing an approved brief
  - **Evidence class:** **Required** (scoped)
  - **Minimum sufficient proof:** Viewports listed in the brief — not an automatic five-viewport or
    full interactive default
- **Change class:** Work under
  [`docs/domains/theme/section-intersections.md`](../domains/theme/section-intersections.md)
  - **Evidence class:** **Required**
  - **Minimum sufficient proof:** Follow that domain matrix only for intersection work; **do not**
    generalize it to all UI
- **Change class:** Copy-only, token/color without layout, docs, backend
  - **Evidence class:** **Unnecessary**
  - **Minimum sufficient proof:** Skip screenshots
- **Change class:** Selector presence, overflow, or simple DOM checks
  - **Evidence class:** **Replaceable**
  - **Minimum sufficient proof:** Browser snapshot, CDP/`getBoundingClientRect`, or a focused
    Playwright assert
- **Change class:** Habitual `full-qa` / `all-sections` / full profile / all invitations
  - **Evidence class:** **Reducible**
  - **Minimum sufficient proof:** Prefer one viewport; widen only after a failed or inconclusive
    minimum pass, or when the owner asks for a full audit

Rules:

- Default capture when screenshots are justified: **one route × one viewport × smallest target**.
  Use full `critical-qa` / multi-viewport / `all-sections` only when reveal+open composition is in
  scope, a brief/domain doc requires it, or the minimum pass failed.
- Reuse an existing server; do not start parallel full screenshot batches against a cold Vite
  optimize-dep without need.
- Preserve full visual proof when risk justifies it (invitation ship QA, section-intersection
  acceptance, reference-driven acceptance). Do not weaken required coverage for those cases.
- Screenshot validation is impact-driven, not a default closure gate. Visible content, assets,
  styles, layout, rendered components, browser interactions, and screenshot infrastructure require
  proportional visual verification; backend-only, observability, CLI, metadata, and provenance
  changes do not require screenshots unless they affect the screenshot mechanism.
- Use the smallest representative invitation, section, and viewport set for the change. Full-corpus
  execution requires explicit justification in the task record. Capture once after implementation
  stabilizes; repeat only when the earlier evidence is stale or invalidated by a later change. A
  successful browser check is reusable when no relevant code, configuration, content, asset, server,
  or acceptance criterion changed.
- Start with the smallest relevant pure or controlled-integration check. Expand to one
  representative Local browser check only when that layer leaves a browser contract unresolved or
  fails. Before every expansion, state the unresolved contract it will prove.
- Do not rerun a successful browser check without an explicit invalidation reason. Stop when the
  acceptance criteria are supported by current evidence; a clean gate is not a reason to collect
  more evidence.
- Reserve full corpus, hosted Preview, Production, and provider-backed checks for contracts Local
  cannot prove or for an explicit requirement. State that limitation and the reason before running
  them; never increase provider or network use merely to measure efficiency.
- Summarize the selected plan, results, failures, and artifact paths in the closing report.
- Name the validation tier (A/B/C) and any visual-evidence skips in the closing report.

Default operating budget:

- One representative route × one viewport × the smallest target first.
- At most one browser execution per unresolved integration contract; widen only after failure,
  inconclusive evidence, or an explicit requirement.
- No full corpus without technical justification, no hosted provider when Local proves the same
  behavior, and no image inspection unless appearance determines the result.
- Do not repeat a clean final gate unless a later change invalidated it.

When expected work exceeds these defaults, briefly justify the additional scope before executing it.

### 5.4 Context-efficiency rules

The main high-consumption failure modes are repeated reads of unchanged files or already-established
architecture, bulk ingestion of logs/manifests/diffs/images, repeated checks whose evidence was
still valid, verbose duplicated progress summaries, and investigation continuing after acceptance
was already demonstrated.

- Use `rg` and focused line ranges first. Reopen an unchanged file only when a new question depends
  on it; carry forward concise summaries and current evidence.
- Summarize long command output at the source. Report only commands, status/exit code, failures,
  material warnings, and affected files or artifact paths.
- Progress updates must contain only new findings or a changed direction. Do not restate conclusions
  already established in the same goal.
- Treat unusually high token consumption as a process defect: explain the cause in the closing
  report and tighten the next validation expansion. This is a proportional escalation trigger, not a
  rigid token limit that can force incomplete or unsafe work.

Screenshot infrastructure guardrails:

- Routine screenshot evidence is Local-first. Preview is only for distinct deployment,
  authentication, remote-asset, or runtime evidence; Production is not a routine screenshot target.
- `pnpm screenshot --config=...` must validate every configured page and resolve the complete batch
  before launching its first browser. Targeted requests must not expand route, section, viewport, or
  artifact scope. Use `--allow-large=true` only for an intentional batch above the normal budget.
- `pnpm screenshot:local-render-corpus` is an explicit high-cost corpus operation. Prefer a single
  route, one viewport, and the smallest target for agent evidence; do not run the corpus to validate
  a localized change.
- Screenshot preflight/report records and diagnostics must not persist or print credentials,
  cookies, signed URLs, query values, tokens, or personal invitation data. Cite record paths and
  summarize failures rather than attaching complete logs or image inventories.
- Efficiency work must not add telemetry or external uploads of prompts, logs, screenshots, or
  repository data. Keep token/accounting metadata at the agent/process layer, separate from runtime
  application behavior.
- The canonical screenshot contract and representative test matrix live in
  [`docs/core/screenshot-tool-contract.md`](screenshot-tool-contract.md) and
  [`scripts/screenshot/README.md`](../../scripts/screenshot/README.md).

---

## 6) Non-Goals

The Gatekeeper must not:

- invent new architectural rules,
- introduce new features,
- perform large rewrites,
- optimize prematurely,
- override these rules silently.

When in doubt, **report instead of acting**.
