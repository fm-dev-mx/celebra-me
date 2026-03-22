# Phase 06: Final Validation and Commit Planning

## Objective

Close the remediation program by re-running repository validation and, once the lint gate is green,
author the commit strategy required by the governance workflow.

## Planned Actions

- Run `pnpm lint`
- Run `pnpm type-check`
- Run `pnpm exec astro build`
- Re-run `.agent/workflows/plan-authoring.md`
- Author `.agent/plans/006-lint-remediation-program/commit-map.json` only after lint passes

## Exit Criteria

- Validation gates pass.
- `commit-map.json` is authored in compliance with the workflow and plan governance rules.
