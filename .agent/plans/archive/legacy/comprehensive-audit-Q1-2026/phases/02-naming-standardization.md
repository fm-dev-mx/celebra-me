# Phase 02: Naming Governance Alignment

## Status

`COMPLETED`

## Objective

Audit naming consistency against the active project convention instead of applying an obsolete
mass-rename rule.

## Current-State Evidence

- `docs/core/project-conventions.md` defines UI components as `PascalCase`.
- The repository already contains a large compliant surface of `PascalCase` UI component files.
- The original draft for this phase incorrectly targeted repo-wide kebab-case component renames.

## Entry Criteria

- Phase 01 is complete.
- The active naming convention has been re-confirmed in project documentation.

## Audit Scope

- `src/components/**/*`
- `src/pages/**/*`
- `src/lib/**/*`
- `src/interfaces/**/*`
- `src/styles/**/*`
- documentation file naming under `docs/` and `.agent/`

## Tasks

1. Inventory naming patterns by layer.
2. Separate true violations from convention-compliant files.
3. Remediate only actual violations.
4. Update conventions or governance only if enforcement can be added without false positives.
5. Sync naming findings into project documentation.

## Cross-Phase Gates

- Verification
- Accessibility where route or component names affect semantics or imports
- SEO where route naming affects public URLs
- Documentation sync
- Evidence capture

## Verification

- `pnpm lint`
- `pnpm type-check`

## Docs To Sync

- `.agent/plans/comprehensive-audit-Q1-2026/README.md`
- `.agent/plans/comprehensive-audit-Q1-2026/manifest.json`
- `.agent/plans/comprehensive-audit-Q1-2026/CHANGELOG.md`
- `docs/core/project-conventions.md`
- `docs/audit/implementation-log.md`

## Exit Criteria

- Remaining naming findings are aligned with the documented convention.
- Import resolution remains stable.
- Plan-level and project-level docs are synchronized.
- A phase completion report is delivered and the audit pauses for user acknowledgment.

## Completion Notes

- Confirmed that Astro and React UI components remain correctly governed by the `PascalCase`
  convention in `docs/core/project-conventions.md`.
- Remediated the concrete support-module naming violations by renaming `src/hooks/useShortcuts.ts`
  to `src/hooks/use-shortcuts.ts` and `src/interfaces/ui/components/navBar.interface.ts` to
  `src/interfaces/ui/components/nav-bar.interface.ts`.
- Updated dependent imports in the dashboard guest app and header components.
- Clarified the project convention so hooks, interfaces, repositories, presenters, and helpers are
  treated as support modules under the `kebab-case` rule even when they export `camelCase` hooks or
  `PascalCase` types.
- Corrected stale wording in the RSVP architecture and status docs so they no longer imply repo-wide
  kebab-case UI enforcement.
- Verification outcome:
  - `pnpm type-check` passed.
  - `pnpm lint` remains blocked by pre-existing repo issues in
    `.agent/governance/bin/gatekeeper-workflow.mjs`, `.agent/scripts/remediate-history.mjs`, and
    `src/components/ui/Confetti.tsx`; no Phase 02 naming violations remained after formatting the
    touched files.
