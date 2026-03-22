# Phase 01: Lint Baseline Triage

## Objective

Capture the current `pnpm lint` failure set, group findings by dominant remediation pattern, and
define the execution order that minimizes risk.

## Completed Actions

- [x] Ran `pnpm lint` and captured the current repository error set.
- [x] Grouped violations into five dominant categories:
  - inline Astro scripts
  - inline style props
  - excessive complexity
  - formatting issues
  - console warnings
- [x] Confirmed that `plan-authoring` blocks `commit-map.json` authoring until lint passes.

## Findings

- Inline Astro scripts are the largest recurring class and require a shared extraction pattern.
- Inline styles are concentrated in a small number of components and should be normalized next.
- Complexity debt affects both product code and governance tooling, so remediation must be phased.
- A valid commit map cannot be authored yet without violating workflow rules.

## Exit Criteria

- Phase remains complete once the backlog grouping and execution order are stable.
