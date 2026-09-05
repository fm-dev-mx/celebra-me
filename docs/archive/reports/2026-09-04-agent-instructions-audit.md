# Agent Instruction Audit — 2026-09-04

Point-in-time audit of the instruction system at base commit
`e7dfc58a499586ba5038887a7ad01166035ad1f4`. This report is evidence, not new policy.

## Outcome and scope

Applied safe, repository-local instruction changes: task-specific routing, clearer skill discovery,
canonical implementation references, selective documentation loading, material decision prompts, and
the explicitly authorized bootstrap split. No product implementation, package scripts, hooks, CI,
database state, deployment, Git history, or unrelated files were changed. Eleven of twenty-one
skills changed; none was deleted or merged away.

The mandatory bootstrap was reorganized under explicit user authorization. AGENTS.md keeps universal
constraints, Gatekeeper keeps hard guards, and Git Safety keeps authorization and lane isolation.
Detailed review/validation and mutable-session procedures now live in
`docs/core/validation-procedures.md` and `docs/core/git-safety-session.md`, linked from discovery
and ownership indexes. An earlier automated review rejected this move until the user supplied the
explicit scoped authorization; no safeguard was waived.

The user authorized instruction cleanup, so generic instructions to ask again for ordinary edits did
not create new permission gates. Ambiguous changes to production policy were retained for review.

## Source map and effective context

1. Platform/runtime instructions and operator defaults arrive outside this repository. The observed
   host selects GPT-6 Astra and exposes a large global/plugin catalog. Its duplicate Cloudflare
   skill entries and broad Graphify trigger are external context costs; no host configuration was
   edited.
2. Root AGENTS.md requires Gatekeeper and Git Safety on every task. The routing matrix selects
   additional rules, procedures, and documentation. No tracked folder-specific AGENTS, CLAUDE, or
   GEMINI entrypoint was found.
3. The repository contains 13 rules, 21 skill entrypoints, 6 workflows, 4 role contracts, the skill
   schema/loading protocol, routing/ownership indexes, a brand brief, and report/creative/intake
   templates. Supporting skill references load only for the operation they describe.
4. Plans README owns Task/Goal/Handoff semantics. Six active plans carry task state; archived plans
   and reports are historical evidence. They must not become general authority through retrieval.
5. Core/domain documents contain architecture, public contracts, data safety, publishing, design,
   and release knowledge. A document's explicit contract can still be binding when its task applies;
   moving text to docs does not make an acceptance requirement optional.
6. Cursor contributes an always-applied production boundary, hook registration, and four hook
   implementations. Package scripts, structure validation, Git Safety, DB guards, Git hooks, CI, and
   editor task definitions also affect execution. They were inspected as evidence and retained.
7. Local ignored installation/generated state is not canonical policy. The supplied native skill
   catalog did not expose these 21 repository skills; manual discovery through AGENTS/routing works.
   Automatic native registration remains unverified. No provider-specific discovery setting was
   assumed, and no private asset payloads or credentials were needed for this audit.

The resulting loading model is: bootstrap once; select every route matching touched surfaces and
apply its rules; load only the needed procedures; reuse already-satisfied prerequisites. Related
skills and role skill lists are references, not recursive preload instructions.

## Disposition of relevant blocks

### Entry points, rules, and routing

- **KEEP — AGENTS.md:** language, SCSS, server/client boundary, relative paths, slug contract,
  command authority, authorization, exception model, validation and session closure. The new
  completion and session pointers remain explicit; universal constraints stay in the entrypoint.
- **KEEP / MOVE TO DOCS — gatekeeper:** hard guards remain in the rule. Scope, auto-fix limits,
  large-change handling, release checkpoints, detailed verification, visual/privacy evidence, and
  context-efficiency procedures now live in `docs/core/validation-procedures.md`.
- **KEEP / MOVE TO DOCS — git-safety:** exact task authorization, user-owned index/history, lane
  isolation, and the session pointer remain in the rule. Lifecycle commands, declarations, result
  matrix, and legacy-baseline handling now live in `docs/core/git-safety-session.md`.
- **KEEP — database, manual-sql-manifest, invitation-production:** persistent/disposable target
  separation, owner execution, manifests, approvals, backup and data integrity. Ambiguous privileged
  read wording remains a finding, not a permission expansion.
- **KEEP — api-contracts, auth-session, intake-publishing:** public responses, authorization/session
  transport and atomic managed publication are non-inferable compatibility boundaries.
- **KEEP — dashboard-styling, invitation-preset-source-of-truth:** surface-specific token ownership,
  variant/preset separation and isolation. Routing now selects them only for matching surfaces.
- **KEEP — agent-routing, graphify-ops:** bounded role ownership and optional graph evidence. Role
  sequences do not require a particular model or mandatory subagent creation.
- **SIMPLIFY — workflow:** reuse evidence while permitting justified rereads; missing credentials
  stop the dependent operation while independent work can continue. Secret guessing and speculative
  environment edits remain forbidden.
- **SIMPLIFY — routing matrix:** 13 broad bundles become 29 explicit task/surface routes. All 21
  skills are reachable. Read-only staged review and applying findings now have separate routes;
  database operations, parity, SQL authoring and query design are distinct. Bootstrap safeguards
  remain explicit while procedures load on demand.
- **MERGE — load-skills, index, schema:** one loading protocol covers canonical ownership, satisfied
  preconditions, conditional related references and host discovery. Removed repeated
  catalog/installation paragraphs and the unverified suggestion of an external_dirs setting.

### Skills

- **SIMPLIFY — astro-patterns:** current SSR/cache/content/media owners replace static-ocean,
  preferred server-island, and always-astro:assets recipes. The current Astro configuration and
  managed invitation resolver contradict treating these generic examples as universal policy.
- **MERGE / DELETE — backend-engineering:** point to API/auth/architecture contracts and existing
  HTTP helpers. Removed invented response envelopes, raw-error examples, guessed limits, phone
  normalization and generic service/repository boilerplate. Server isolation, validation, RLS,
  privileged-access limits and public response compatibility remain explicit.
- **SIMPLIFY — supabase:** versioned migrations, disposable validation and guarded promotion replace
  ad-hoc persistent SQL followed by reverse-engineering migration history. This resolves a conflict
  with the unchanged database rule; SQL authoring never authorizes execution.
- **SIMPLIFY — testing:** retain editable-copy assertion boundaries, defect-class regression locks,
  existing validation commands and visual evidence limits. Remove illustrative directory trees and
  generic Jest/RTL/Zod/mock tutorials; use live tests and configuration. Controlled API handler
  tests do not automatically require a running server.
- **MOVE TO DOCS — frontend-design:** aesthetic examples and the complete invitation hero contract
  now live in docs/domains/theme/visual-design-reference.md. The skill loads them for art direction
  or hero work. Preset authority, approved crops, face safety, typography and viewport acceptance
  remain; the moved sections were compared after whitespace normalization and owner-label update.
- **SIMPLIFY — branch-lane, database-parity, client-invitation-audit:** descriptions now identify
  the task and boundary without embedding full operating procedures. Their parity, readiness, owner
  decisions, release and environment procedures remain intact.
- **SIMPLIFY — commit-planner:** exact-path staging cannot imply a whole-index reset. Unstaging
  requires the operation and paths to be included in authorization; preserve unrelated staged work
  and partial hunks. Recovery guidance now correctly explains that local-only commits relative to a
  remote-tracking ref are not evidence that commits were pushed. Unknown publication status does not
  permit history-discarding recovery. Its previously invalid YAML description is now valid.
- **MERGE — staged-code-review and staged-code-review-apply:** decision presentation uses the shared
  report contract. Read-only review, unstaged application, protected paths, apply tags and human
  authorization remain unchanged.
- **KEEP — accessibility:** specialized accessibility guidance remains isolated from unrelated QA.
  Numeric large-text guidance deserves a standards check before a separate edit.
- **KEEP — animation-motion, invitation-rhythm:** reveal/reduced-motion and invitation section-flow
  procedures remain separate; ordinary UI work no longer loads both automatically.
- **KEEP — copywriting-es:** Spanish register and brand-specific copy belong in the specialized
  skill.
- **KEEP — demo-content-consistency:** demo transforms and date consistency remain distinct from
  managed client content.
- **KEEP — git-stash-branch-cleanup:** destructive cleanup remains explicit-task-only.
- **KEEP — production-sql-patches:** artifact/manifest authoring and synchronization references
  retain their production boundary.
- **KEEP — seo-metadata:** metadata/privacy guidance stays task-specific; generic examples should be
  reconciled with the current Layout/metadata owners in a focused follow-up.
- **KEEP — supabase-postgres:** database query/design knowledge stays specialized.
- **KEEP — theme-architecture:** token/resolver and reusable-theme contracts remain explicit;
  possible over-prescription in its related workflow is recorded below.

### Workflows, templates, roles, and documentation

- **MERGE — report contract and its consumers:** ask only for missing material intent or required
  permission; use meaningful choices, not exactly three invented options. An ambiguous affirmative
  cannot grant broader Git/environment/destructive authority. Preserve evidence/status fields,
  failure escalation and required human acceptance. Reuse authorization already supplied.
- **DELETE — report samples:** remove a duplicated prefix that repeated entire samples and ended
  inside a code fence. Remaining samples are explicitly illustrative, not additional authority.
- **SIMPLIFY — system-doc-alignment:** resolve affected owners instead of testing four fixed
  directories before every documentation task; stop only decisions missing required evidence.
- **MERGE — error-remediation:** shared decision presentation replaces a fixed three-option rule.
  The three-cycle escalation limit and regression-lock requirement remain.
- **KEEP — plan-authoring, invitation-preparation, design-reference-to-build,
  theme-architecture-governance:** task-specific workflows and their meaningful acceptance gates.
- **KEEP — roles, brand brief, creative/intake templates and other skill references:** specialized
  knowledge and ownership remain available under demand. No model-specific invocation is added.
- **KEEP — plans README and current task plans:** planning defaults already favor conversation
  scope. Historical consolidation commits were used to distinguish deliberate operating contracts
  from duplication; task status was not silently rewritten.
- **SIMPLIFY — section-contracts:** repair the active relative link to the ownership matrix.
- **KEEP — other core/domain contracts and executable infrastructure:** no runtime change was
  necessary. Package.json remains command authority; docs remain deep, task-selected knowledge.

No files were deleted. No new skill was needed: the existing specialized owners cover the extracted
procedures. The new visual document is linked from the frontend skill, discovery index and ownership
map, rather than being added to universal bootstrap.

## Evidence behind nontrivial decisions

- src/lib/rsvp/core/http.ts and the API rule define success/error helpers; the old backend examples
  described a competing response contract and exposed arbitrary error messages.
- astro.config.mjs, package.json, active renderers and managed media paths establish the execution
  model; generic static-first and single-image-path guidance was not an implementation invariant.
- The Git rule’s exact authorization and lane-isolation prefix were content-preserved. Three
  whole-index reset recipes in commit planning directly contradicted its exact-path authorization
  language; the lifecycle detail was moved only after explicit approval.
- Database rules and docs/database-workflow.md already own migration history and guarded targets;
  correcting the Supabase recipe enforces that existing protection.
- tests/setup.ts, Jest configuration, existing suites and run-related-tests.mjs provide executable
  examples. Editable-content assertion and regression-lock rules were preserved because they protect
  behavior not inferable from a generic testing tutorial.
- Prior consolidation history (ce456c65, da10f20d, a56d7758, 42de3641, 81e336c1) explains Task
  Contract ownership, merged skills and shared reports. No claim is made that a specific old model
  caused every redundant instruction.

## Measurements

UTF-8 bytes with CRLF normalized to LF, before from the base Git commit and after from this working
copy. These are source sizes, **not tokenizer measurements or actual runtime prompt telemetry**.

| Surface                                               |    Before |     After |
| ----------------------------------------------------- | --------: | --------: |
| Mandatory bootstrap: AGENTS + Gatekeeper + Git Safety |  38,266 B |  20,543 B |
| Bootstrap plus routing index                          |  43,228 B |  27,573 B |
| All 21 SKILL.md files, including frontmatter          | 174,452 B | 163,057 B |
| Skill description source blocks                       |   5,879 B |   4,487 B |
| Active agent corpus: 79 existing files                | 494,055 B | 459,248 B |
| New on-demand visual reference                        |       0 B |   7,180 B |

Skill entrypoints shrink 6.5%; description blocks 23.7%; the existing active agent corpus 7.0%. The
mandatory bootstrap plus routing index shrinks 36.2%; the two moved procedures add 21,015 B that
loads only when their operations apply. The audit report itself is historical evidence and excluded.
Precise routing intentionally avoids loading unrelated procedures.

For a dashboard typography/composition task, direct route entries plus bootstrap go from 12 files /
119,802 B to 5 files / 43,499 B (63.7% less). This comparison includes the dashboard rule after the
split, excludes recursive references, and does not predict every task or claim host-global savings.

The 79-file corpus includes tracked Markdown/YAML in .agent except active/archived plans, plus
plans/README.md and AGENTS.md. It is an inventory metric, not a claim that all these files load
universally. Host prompts/plugin catalogs and deep domain docs are outside that denominator.

## Validation and review

- pnpm validate:structure: PASS before and after cleanup.
- pnpm validate:changed: PASS for the cleaned instruction set; existing wide-table warnings were
  non-failing. Final changed-file verification, including this report, is recorded in the handoff.
- pnpm exec jest --runInBand tests/unit/validate-structure-script.test.ts: PASS, 9 tests.
- pnpm ops check-links: PASS for changed Markdown, including the new design reference.
- pnpm ops check-links --all: FAIL, 20 unresolved links in 6 unchanged archived plans. The active
  ownership link was fixed. The remaining failures were compared against the base and are
  historical, not newly introduced. No archive was rewritten to make the command pass.
- Additional read-only assertions: all 21 current skill frontmatters parse as YAML, all skills have
  descriptions/triggers and routing entries, hard-guard content and Git authorization/lane prefix
  comparisons pass, and both moved visual sections retain their content apart from the explicit
  owner label.
- Full diff review and git diff --check: no product or executable changes; no whitespace errors.
  Presentation references remaining in review/apply templates were reconciled with the shared
  contract during the review.
- Tier A documentation validation applies. Full CI, product build, browser tests, database/provider
  calls and deployment were not needed for this instruction-only patch. Git Safety session closure
  is required and its actual outcome is reported in the final handoff.

## Retained risks and follow-ups

1. **Bootstrap split is now applied.** Future edits must preserve the hard-guard content,
   authorization, verification matrices, human release gates, and executable references. The two
   procedure documents are discoverable through the index and ownership map. No executable guard
   changes were made.
2. **Production privileged-read wording conflicts.** Invitation-production's categorical matrix and
   database's permitted read-only audits do not state exceptions consistently. Reconcile exact
   targets and approved read mechanisms with the owner; do not infer broader access meanwhile.
3. **Enforcement is runtime-specific.** Gatekeeper describes wrapper/policy limits while Cursor has
   additional hooks. Those hooks do not prove equivalent enforcement in every host. Keep policy and
   executable protections until a supported cross-host design is explicitly scoped.
4. **Branch-lane calls fetch read-only discovery.** Fetch updates local refs; its label can conflict
   with strict Git-state authorization. The release workflow was preserved, and no fetch was run.
5. **Subjective or mechanical local criteria remain.** Staged review promotes three-line dead-code
   cleanups to HIGH; frontend design uses taste-based rejection language; error remediation has a
   fixed three-cycle limit. These appear deliberately specialized. Review their value against real
   outcomes before changing priority or escalation contracts.
6. **Theme workflow may over-prescribe file creation.** Its section/variant indexing guidance should
   be reconciled with the skill and live resolver before removing an isolation-related requirement.
7. **Deep skill examples need targeted follow-up.** Accessibility large-text units, SEO Layout
   examples and testing coverage targets should be checked against their actual standards/config.
   The brand brief also contains tool-specific generation guidance; do not assume those examples are
   current runtime capabilities or approved brand decisions.
8. **Native discovery and host duplication are external.** Configure supported registration once,
   without copying canonical skills into independent authorities. Review duplicate global/plugin
   entries and overbroad activation separately; this task did not authorize host-wide changes.
9. **Historical state needs ownership.** The active agent-infrastructure-consolidation plan overlaps
   shipped consolidation, but evidence here is insufficient to close all its acceptance criteria.
   Archived broken links should remain historical references or receive a separately agreed archival
   link policy, not guessed links to modern implementations.
