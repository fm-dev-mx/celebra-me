---
description: Provider-neutral workflow for reference-driven visual design, implementation, and QA.
lifecycle: evergreen
domain: frontend
owner: workflow-governance
---

# Workflow: Design Reference to Build

Use this workflow for reference-driven invitation, demo, landing, or dashboard design. It
orchestrates existing owners; it does not own visual intent, theme contracts, validation tiers, or
invitation publication.

Entry condition: a request supplies or cites visual references and the intended result requires
interpretation before implementation. Exact, localized corrections with an observable target route
directly under `.agent/rules/agent-routing.md`.

## Authority

- Brand and voice: `.agent/briefs/celebra-me.md`
- Visual intent and critique: `frontend-design`
- Invitation tokens and SCSS boundaries: `theme-architecture`
- Dashboard styling boundaries: `.agent/rules/dashboard-styling.md`
- Validation tiers: `.agent/rules/gatekeeper.md`
- Real invitation discovery: `client-invitation-audit`
- Invitation preparation readiness: `.agent/workflows/invitation-preparation.md` and
  `docs/invitations/<slug>.md` (do not implement invite-specific visuals while readiness is
  `NOT_READY`)
- Invitation lifecycle: `docs/domains/intake/production-flow.md`

Figma frames, screenshots, Mobbin examples, and other external references are optional inputs. They
are never sources of truth and must not introduce provider-specific configuration or a parallel
design system.

Follow the authority order in `AGENTS.md`. Role contracts assign responsibility, this workflow
orders the handoffs, the brief records task decisions, and the QA report records evidence. Neither a
template nor a completed report can override a rule, canonical skill, or domain contract.

## Inputs and Outputs

Required before implementation:

- target surface and bounded implementation scope;
- at least one usable reference or a precise citation to an internal reference;
- current-state evidence, primary viewport, preserved behavior, and observable acceptance criteria;
- production-ready critical assets, when the visual result depends on them;
- Lane A/Lane B classification and two-lane spec for a real invitation.

Optional inputs include secondary viewports, external inspiration, motion examples, and alternate
compositions. Missing optional input is not blocking when the approved brief records the omission
and acceptance remains testable.

Expected outputs are an approved task-scoped brief, bounded implementation units, before/after
evidence, a completed UI/invitation section of `creative-qa-report`, and the normal Gatekeeper final
report. The brief may remain in conversation or a task handoff; screenshots remain untracked
evidence.

## Decision Ownership

| Decision                                                                         | Owner                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Interpret references and draft visual direction                                  | Visual-director                                                                                   |
| Approve the brief against the current request and canonical authorities          | Orchestrator; ask the user only when an unresolved choice would materially change intent or scope |
| Choose implementation details inside the approved intent and technical contracts | Builder                                                                                           |
| Prepare and validate copy changes                                                | Copywriter, under the owning content contract                                                     |
| Implement approved data changes                                                  | Builder, under the owning content/data workflow                                                   |
| Validate reference fidelity and rendered visual quality                          | QA, against the brief rather than a new creative direction                                        |
| Validate technical correctness                                                   | QA and the validation tier owned by `gatekeeper.md`                                               |
| Decide task completion                                                           | Orchestrator, only after required QA and validation evidence passes                               |

The visual-director or QA may request a revision with evidence. The builder must disclose any
necessary deviation instead of silently changing approved intent. Resolve disagreement by applying
the highest canonical owner and updating the brief; ask the user when the remaining choice is
subjective and materially affects the requested outcome.

## Phase 1 — Classify and Load

Classify the target before visual work:

| Surface          | Required context                                                                      |
| ---------------- | ------------------------------------------------------------------------------------- |
| Real invitation  | Brand brief, `frontend-design`, `client-invitation-audit`, invitation authority chain |
| Demo invitation  | Brand brief, `frontend-design`, `theme-architecture`                                  |
| Landing          | Brand brief, `frontend-design`, affected component conventions                        |
| Dashboard        | Brand brief when brand-facing, `frontend-design`, `dashboard-styling.md`              |
| Token or variant | `frontend-design`, `theme-architecture`, `theme-architecture-governance`              |

For reference-driven redesigns, complete
[`design-reference-brief.md`](../templates/creative/design-reference-brief.md). Keep it in the
conversation unless a structured handoff or tracked plan is already justified.

## Phase 2 — Establish the Baseline

1. Record the live route, component, preset, and primary mobile viewport.
2. Capture or cite current-state visual evidence before proposing changes. For a new surface, record
   that no implementation exists and cite the closest live internal comparison as the baseline.
3. Inspect internal product references first: verified demos, sibling presets/components,
   `docs/invitations/**`, and current theme contracts.
4. Label external references as non-authoritative inspiration.
5. For real invitations, complete `client-invitation-audit` and classify every proposed change as
   Lane A or Lane B before implementation.

Apply the blocking rules and reference-sufficiency decision recorded in the design-reference brief.

## Phase 3 — Define Focused Iteration Units

Each unit must state:

- the target section, element, route, or selector;
- current evidence and the desired visual delta;
- the owning layer: copy/data, asset, token, section layout/variant, or scoped override;
- allowed files or zones and explicit non-goals;
- behavior and content that must remain unchanged;
- acceptance criteria, evidence source, viewports, pass rule, and verification owner;
- approved deviations and unresolved details.

Prefer one coherent visual dimension per unit. “Improve the hero” is not sufficient; “replace the
inset media treatment with the approved full-bleed composition while preserving reveal behavior” is.

Use runtime capabilities such as visual element selection only as a convenience. The workflow must
remain executable through explicit component/section references in any compatible runtime.

## Phase 4 — Implement in the Live Product

- Work in the existing Astro, TypeScript, and SCSS architecture; do not create a parallel prototype
  application or styling system.
- Use real approved assets for production invitations. Temporary placeholders remain blockers.
- Map visual references to existing semantic/component tokens and section contracts. Do not paste
  generated Figma CSS or hardcoded visual values without reconciling them with `theme-architecture`.
- Preserve Spanish visible copy, server/client boundaries, accessibility, and reduced-motion
  behavior.
- Keep invitation-specific work scoped to its event boundary. Shared theme changes require Lane B
  evidence and cross-preset verification.
- When implementation cannot match the reference, record the reason, affected criterion, and
  approved substitute in the brief before continuing. Accessibility, platform constraints, real
  content behavior, and canonical theme boundaries take precedence over pixel imitation.

## Phase 5 — Review and Iterate

1. Compare the changed surface with the reference, recorded baseline, and each brief criterion at
   every required viewport.
2. Complete the UI/invitation section of `creative-qa-report`; every finding needs severity,
   `Pass`/`Fail`/`Blocked` status, affected viewport/section, expected result, actual result,
   evidence, and a remediation or blocking reason.
3. Apply the `frontend-design` Visual Critique / Polish Checklist.
4. Verify accessibility and the **minimum** visual evidence required by
   [`.agent/rules/gatekeeper.md`](../rules/gatekeeper.md) §5.3 (Visual evidence). Use
   [`scripts/screenshot/README.md`](../../scripts/screenshot/README.md) for flags and capture
   mechanics; do not default to the interactive CLI’s full `critical-qa` / multi-viewport set unless
   the brief or gatekeeper matrix requires it.
5. QA returns pass, fail, or blocked; it may request a bounded revision but must not redefine the
   approved creative direction.
6. Use the validation tier owned by `gatekeeper.md`; do not copy its command matrix here.

Screenshot output is evidence, not a tracked repository artifact.

## Phase 6 — Sync and Handoff

- Run `theme-architecture-governance` when a live token, preset, variant, or isolation contract
  changes. Update `docs/domains/theme/architecture.md` only when that technical contract changes.
- For real invitations, continue through `docs/domains/intake/production-flow.md`; this workflow grants no
  Preview or Production authorization.
- Report the brief/baseline used, files changed, visual evidence, validations, skips, remaining
  risks, and Git/production actions.

## Parallel Work

Follow the visual work zones and structured handoff rules in `celebra-delegation-patterns`. Runtime
model and provider selection remain runtime-owned.

## Completion and Failure States

- **Complete** — the approved brief and implementation scope are satisfied, every required QA area
  passes, Gatekeeper validation passes, and deviations and remaining risks are reported.
- **Failed** — one or more acceptance criteria or required validations fail after the authorized
  revision scope is exhausted. Report the failing evidence; do not broaden the task implicitly.
- **Blocked** — required intent, baseline, production asset, real-invitation lane decision,
  environment, or evidence cannot be obtained. Name the missing dependency and do not claim visual
  acceptance.

## Acceptance Scenarios

### Demo or landing hero polish

`design-reference-brief` → focused hero unit → builder implementation → mobile visual evidence →
QA/checklist verdict.

### Real client invitation

`design-reference-brief` → `client-invitation-audit` → Lane A/Lane B spec → focused implementation →
visual QA → `docs/domains/intake/production-flow.md`.

Both scenarios must be discoverable from `.agent/index.md` without relying on knowledge of a
specific design tool or video.
