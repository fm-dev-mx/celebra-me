# Plan 006: Lint Remediation Program

## Abstract

This plan remediates the current `pnpm lint` backlog that blocks the governance workflow for
authoring valid commit maps. The objective is to drive the repository to a clean ESLint baseline
without weakening architecture rules or silencing findings.

## Current Blocker

`pnpm lint` currently fails due to:

- inline client scripts in Astro components and pages
- inline style props in Astro and React components
- excessive cyclomatic complexity in application and governance modules
- residual formatting failures
- console usage warnings in adapter helpers

Under `.agent/workflows/plan-authoring.md`, `commit-map.json` must not be written until lint passes
100%. This plan is therefore scaffolded first, and its commit strategy will be authored only after
the lint gate is green.

## Objectives

1. Eliminate all inline Astro scripts forbidden by repository lint rules.
2. Replace all forbidden inline styles with class-driven or CSS-variable-driven presentation.
3. Decompose high-complexity functions into smaller domain-aligned units.
4. Clear formatting and console-rule violations without muting rules.
5. Re-run validation until `pnpm lint`, `pnpm type-check`, and `pnpm exec astro build` are stable.

## Scope

### Included

- `.agent/governance/bin/`
- `.agent/scripts/`
- `src/components/common/`
- `src/components/home/`
- `src/components/invitation/`
- `src/components/layout/`
- `src/components/ui/`
- `src/lib/adapters/`
- `src/lib/invitation/`
- `src/lib/rsvp/services/`
- `src/pages/`
- `src/middleware.ts`
- `tests/`

### Excluded

- new feature work
- design-system expansion
- rule suppression in ESLint config unless explicitly justified and approved

## Phase Overview

- **[01-lint-baseline-triage]**: capture the current lint backlog and lock remediation priorities
- **[02-astro-script-extraction]**: remove forbidden inline Astro scripts
- **[03-inline-style-elimination]**: remove forbidden inline style usage
- **[04-complexity-reduction]**: split high-complexity functions and components
- **[05-governance-tooling-hardening]**: reduce complexity in governance/tooling scripts
- **[06-final-validation-and-commit-planning]**: verify lint/build success and author commit map

## Constraints

- Do not suppress lint rules to force a green result.
- Preserve current runtime behavior while extracting scripts and styles.
- Keep internal code and docs in English.
- Do not author `commit-map.json` until lint passes, per workflow.

## Success Criteria

- `pnpm lint` returns zero errors and zero warnings.
- `pnpm type-check` returns zero errors.
- `pnpm exec astro build` completes application compilation successfully.
- `commit-map.json` is authored only after the lint gate passes.
