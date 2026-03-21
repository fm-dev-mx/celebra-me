# Plan 2: Gatekeeper Acceleration, Splitting & Static Analysis

## Abstract

This plan aggressively upgrades the Gatekeeper commit workflow to address both DX (Developer Experience) and Architectural constraints. It divides the workflow into modular pieces to save LLM tokens, enforces strict structural code quality (God objects, inline styles), and hardens the operational speed of local commits.

## Objectives

1. **Workflow Splitting**: Separate the analytical "Plan Authoring" flow from the blind/fast "Commit Runner" flow to eliminate token waste.
2. **Static Analysis Enforcement**: Give the workflow actual code-quality teeth by wiring ESLint/Stylelint rules to block inline styles/scripts, enforce decoupling, catch God objects, and strictly police language governance (English code/docs vs Spanish UI).
3. **Pre-Flight Git & Linter Hygiene**: Abort operations instantly if the git tree contains unmapped dirt, and mandate dry-run linter checks before starting the commit flow.
4. **Fast-Path Diagnostics**: Provide immediate diff feedback for `unit_mismatch`.
5. **Execution Speed**: Prevent terminal hangs and reduce the runtime of pre-commit hooks.

## Phases

- **[01-workflow-splitting]**: Create `plan-authoring.md` and trim down `gatekeeper-commit.md`.
- **[02-static-analysis-hardening]**: Add rules (e.g. `eslint-plugin-boundaries`, AST checks) to `lint-staged`.
- **[03-preflight-hygiene]**: Add script guards for Git cleanliness.
- **[04-fast-path-diagnostics]**: Enhance `.agent/governance/bin/gatekeeper-workflow.mjs` mismatch outputs.
- **[05-execution-speed]**: Tune Husky hooks and `node` startup costs.

---
*Generated under the chronological archival governance rule `001-plan-archival-governance`.*
