# Gatekeeper Commit Hardening Audit

Date: 2026-03-16
Status: applied
Owner: workflow-governance

## Observed failures

- Pre-flight wasted an attempt on a missing script instead of resolving the configured runnable
  command first.
- Operators continued after `workflowRoute=architectural_intervention`, which led to invalid
  staging and scaffold attempts.
- Commit scaffolds required manual repair because path fidelity, line-length, and subject quality
  constraints were corrected reactively instead of being enforced up front.

## Corrective changes

- `gatekeeper-workflow.mjs` now resolves `pnpm` pre-flight commands only when the referenced script
  exists and falls back deterministically otherwise.
- `gatekeeper-workflow.mjs` now blocks `scaffold --domain <id>` unless the current session route is
  `proceed_adu`, matching the existing guards on `stage` and `commit`.
- Workflow subject generation now prefers stronger verbs for plan, docs, workflow, and governance
  splits so the header reflects the dominant change instead of generic bookkeeping.
- Workflow documentation now states that `architectural_intervention` is a hard stop for `stage`,
  `scaffold`, and `commit`.
- Git-governance guidance now documents existence-checked pre-flight resolution and a short
  first-pass rubric for valid commit titles and bullets.

## Verification

- Unit tests cover runnable pre-flight command resolution and keep scaffold path handling
  deterministic.
- Integration tests cover `scaffold` rejection before `proceed_adu` and preserve the existing
  non-mutating scaffold flow for valid splits.
