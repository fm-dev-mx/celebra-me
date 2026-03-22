# Changelog

## 2026-03-22

- Created the active plan scaffold for runtime and documentation simplification.
- Simplified invitation runtime ownership by removing redundant single-owner behavior wrappers.
- Reduced dashboard guest runtime indirection by moving export behavior into the action hook and
  trimming realtime hook noise.
- Reconciled evergreen docs with the current route-facing `page-data.ts` architecture.
- Left toolchain validation open because `node.exe` / `pnpm` are unavailable in the current
  environment.
