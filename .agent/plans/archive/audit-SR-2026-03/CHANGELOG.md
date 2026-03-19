# Changelog - audit-SR-2026-03

All notable changes to this plan will be documented in this file.

## [Unreleased] - 2026-03-18

### Fixed

- **Finding 1 (Remediate Hex Code Leaks)**: Successfully decoupled color styling from- [Phase 02] Standardized color tokens and hardened `ColorTokenSchema`.
- [Phase 02.1] Implemented theme property inheritance and cleaned up redundant JSON data (reduced boilerplate by ~40%).
- [Phase 03] Decoupled presenter logic from hardcoded slugs by introducing `layoutVariant` in `HeroViewModel` and content schemas.
  - Implemented `resolveColorToken` utility and `PRESET_COLOR_MAP` to handle semantic colors.
  - Migrated all event and demo JSON files to use semantic tokens (`surfacePrimary`, `actionPrimary`, `actionAccent`, `surfaceDark`, `surfaceSoft`).
  - Updated `adaptEvent` to resolve tokens at runtime, ensuring zero visual regression.

### Added

- Initial plan scaffolding and technical audit framework.
- Preliminary research into src/ directory for pattern leakage.
- Detailed audit findings and MVI strategies (Draft).

### Closed

- **Closure review:** Verified the plan's audit and remediation outcomes had already been realized in
  the repository and that the remaining `PENDING` markers were stale plan metadata. (Completed:
  2026-03-19 10:30)
- **Archive handoff:** Normalized the plan to a completed state and archived it under
  `.agent/plans/archive/audit-SR-2026-03/`. (Completed: 2026-03-19 10:30)
