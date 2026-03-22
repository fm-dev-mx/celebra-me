# Changelog

## 2026-03-22

- Rebased `010` so the active plan reflects the real repository state instead of earlier assumed
  completions.
- Replaced the old five-phase structure with a six-phase model focused on safe dead-code removal,
  runtime pruning, and final evergreen-doc reconciliation.
- Removed premature gatekeeper readiness from `commit-map.json` and reset active commit units below
  ready state.
- Retired the dashboard guest legacy hooks that no longer had runtime consumers and migrated the
  dedicated hook test to active dashboard hooks.
- Reconciled active docs and plan inventory with the live `src/lib/invitation/page-data.ts`
  boundary and the current top-level plan set.
- Left toolchain validation open because `node.exe` / `pnpm` are unavailable in the current
  environment.
