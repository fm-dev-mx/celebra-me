---
description:
  Governance and synchronization of technical documentation with the current system state.
lifecycle: 'evergreen'
domain: 'governance'
owner: 'system-agent'
last_reviewed: '2026-03-17'
---

# Optimized Governance & Alignment Prompt

## Role & Context

You are a **Principal Governance Architect**. Your mission is to keep the project's technical
documentation synchronized with the source tree and governance assets without relying on stale
assumptions about directory layout.

## Objective

Design and execute a robust workflow for **System Governance and Documentation Alignment** that can
audit the current repository state, create or resume a plan under `.agent/plans/`, and apply
deterministic documentation corrections.

## Core Requirements

1. **Bidirectional Alignment**:
   - Ensure code reflects the architectural decisions and business logic defined in `docs/**/*.md`.
   - Ensure documentation is updated immediately to reflect logical or structural changes in the
     codebase.

2. **Hygiene & Pattern Audit**:
   - Scan the project for documentation drift, governance gaps, pattern violations, and stale
     instructions.
   - When `.agent/skills/` exists, audit relevant skills such as `copywriting-es`, `seo-metadata`,
     and `astro-patterns` only if they materially affect the documentation under review.
   - If a referenced directory is missing, record the gap and continue with the remaining valid
     targets instead of failing implicitly.

3. **System-Wide Asset Pruning**:
   - Audit `.agent/workflows/`, `.agent/plans/`, `.agent/skills/`, and `docs/` for obsolete or
     overlapping governance content.
   - Propose deletions or consolidations only when they are backed by current repository state.

4. **Persistent Planning Layer**:
   - For every alignment or remediation task, create or resume a dedicated folder under
     `.agent/plans/{plan-name}/` using strict `kebab-case`.
   - Adhere to the **Planning Governance Framework** with `README.md`, `CHANGELOG.md`,
     `manifest.json`, and a `phases/` directory.

5. **Progress Persistence (Multi-Run Support)**:
   - Each phase file in `phases/*.md` and the root `README.md` must include the standard progression
     header.
   - Use GFM checkboxes for granular tasks and timestamp completions using
     `(Completed: YYYY-MM-DD HH:MM)`.
   - Update `manifest.json` after every phase status change.

6. **Independence & Reusability**:
   - Operate independently of the commit gatekeeper.
   - Reuse existing governance utilities where appropriate without changing the deterministic
     contract of other workflows.

## Pre-Validation

Before executing any audit or remediation step, validate the repository layout. Use an explicit
directory check and classify each target as `present`, `missing`, or `optional`.

Required targets:

- `.agent/workflows/`
- `.agent/plans/`
- `docs/`
- `src/`

Optional targets:

- `.agent/skills/`

Validation rules:

- If a required target is missing, stop and report the blocker before scanning.
- If an optional target is missing, note it in the plan and continue.
- If a target exists but has limited content, record that as an observation instead of assuming
  failure.

## Workflow Definition

**Command**: `/system-doc-alignment`

### Execution Phases

#### Phase 1: Deep Audit & Drift Detection

- Validate `.agent/workflows/`, `.agent/plans/`, `docs/`, and `src/` before scanning.
- Audit `.agent/workflows/` for stale paths, invalid assumptions, overlapping responsibilities, and
  references to missing assets.
- Audit `.agent/plans/` for existing alignment plans, resumable work, and governance drift.
- Audit `docs/` based on the actual tree under `docs/**`, including `DOC_STATUS.md` and any
  architecture, audit, core, and domain subdirectories that exist.
- If `.agent/skills/` is present, audit only the skills relevant to the documentation change under
  review; if absent, log the omission and continue.
- Compare findings against the live structure in `src/` to identify high-severity drift and stale
  documentation.

#### Phase 2: Strategic Planning

- If an alignment plan already exists in `.agent/plans/`, summarize the resumable state and ask
  whether to resume or create a new plan.
- Initialize or update `.agent/plans/{plan-name}/` with `README.md`, `CHANGELOG.md`,
  `manifest.json`, and `phases/*.md`.
- Ensure the phase list, weights, and status fields in planning artifacts match the actual intended
  execution sequence.

#### Phase 3: Surgical Execution

- Execute the approved plan one phase at a time.
- Limit changes to the active phase; do not preemptively implement future phases.
- For each approved code or documentation update:
  - Apply the change.
  - Append a timestamped entry to `CHANGELOG.md`.
  - Update the corresponding `phases/*.md`, `README.md`, and `manifest.json`.
- If a planned target cannot be modified because it is missing or has diverged, stop and report the
  blocker explicitly.

#### Phase 4: Final Verification

- Run deterministic validation commands that match the repository tooling, such as:
  - `pnpm astro check`
  - `pnpm lint`
  - targeted file existence checks for audited docs and workflow assets
- Verify `docs/DOC_STATUS.md` reflects the post-execution alignment state.
- Summarize residual risks, skipped work, and any remaining documentation drift.

## Error Handling

- Missing required directories are blocking errors.
- Missing optional directories are logged as non-blocking observations.
- Invalid assumptions discovered in workflow or plan documents must be corrected before execution
  continues.
- If a validation command is unavailable in the environment, record the exact command failure and
  continue only with explicit acknowledgment in the final report.

---

**Instruction for the Agent**: "When I run this workflow, start by validating the environment. If a
plan already exists in `.agent/plans/`, ask me if you should resume it or start a new one. Provide a
summary of current alignment health before proposing the next approved action."
