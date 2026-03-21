# Phase 05: Design System and Utility Cleanup

## Status

`PENDING`

## Objective

Remove ad-hoc utility patterns and styling escapes in favor of semantic tokens, shared layout
primitives, and documented design-system rules.

## Current-State Evidence

- `src/styles/global.scss` defines `.w-*`, `.h-*`, and `.container-custom` utilities.
- Several style layers still contain hardcoded values and styling escapes.
- Project conventions already prohibit styling-only `define:vars` blocks in Astro components.

## Entry Criteria

- Phase 04 is complete.
- Design system and styling conventions have been reviewed.

## Audit Scope

- `src/styles/global.scss`
- `src/styles/**/*`
- `src/components/**/*`
- `src/pages/**/*`

## Tasks

1. Inventory ad-hoc utilities and styling escapes.
2. Distinguish acceptable primitives from non-standard hacks.
3. Replace invalid patterns with token-based or semantic alternatives.
4. Re-check styling-only `define:vars` usage.
5. Sync design system findings into project documentation.

## Cross-Phase Gates

- Verification
- Accessibility, especially focus, contrast, and semantic layout
- SEO for any touched public page shell behavior
- Documentation sync
- Evidence capture

## Verification

- `pnpm lint`
- `pnpm lint:scss`
- `pnpm type-check`
- `pnpm build`

## Docs To Sync

- `.agent/plans/comprehensive-audit-Q1-2026/README.md`
- `.agent/plans/comprehensive-audit-Q1-2026/manifest.json`
- `.agent/plans/comprehensive-audit-Q1-2026/CHANGELOG.md`
- `docs/core/project-conventions.md`
- `docs/domains/theme/architecture.md`
- `docs/core/testing-strategy.md`
- `docs/audit/implementation-log.md`
- `docs/audit/stability.md`

## Exit Criteria

- Non-standard utility patterns are removed or formally justified.
- Token-based and semantic design-system rules are documented.
- Verification passes.
- Plan-level and project-level docs are synchronized.
- A phase completion report is delivered and the audit pauses for user acknowledgment.
