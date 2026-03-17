# Phase 01: Theme Architecture Refactoring

## Status

`COMPLETED`

## Objective

Reduce preset bloat and enforce clear responsibility boundaries between preset tokens, section
variants, and event-specific overrides.

## Current-State Evidence

- `src/styles/themes/presets/_luxury-hacienda.scss` is approximately 13.9 KB and contains
  component-local variables.
- `docs/domains/theme/architecture.md` already defines preset-scoped and section-scoped ownership.
- Existing audit history in `docs/audit/implementation-log.md` shows theme isolation is an active
  architectural concern.

## Entry Criteria

- Pre-execution hardening is complete.
- No later phase has started.
- Theme architecture sources of truth have been reviewed.

## Audit Scope

- `src/styles/themes/presets/**/*.scss`
- `src/styles/themes/sections/**/*.scss`
- `src/styles/invitation/**/*.scss`
- `src/styles/events/*.scss`
- `src/lib/theme/theme-contract.ts` if contract drift is discovered

## Tasks

1. Inventory preset variables and classify them as semantic preset tokens, section tokens, or
   event-local overrides.
2. Identify component-local layout logic that does not belong in preset files.
3. Move or redesign invalid preset responsibilities into section theme files or event-scoped files.
4. Preserve valid semantic token overrides inside presets.
5. Verify representative invitation routes across multiple presets.
6. Update theme architecture and audit documentation.

## Cross-Phase Gates

- Verification
- Accessibility
- SEO
- Documentation sync
- Evidence capture

## Verification

- `pnpm lint:scss`
- `pnpm type-check`
- `pnpm build`
- `pnpm ops validate-schema`

## Docs To Sync

- `.agent/plans/comprehensive-audit-Q1-2026/README.md`
- `.agent/plans/comprehensive-audit-Q1-2026/manifest.json`
- `.agent/plans/comprehensive-audit-Q1-2026/CHANGELOG.md`
- `docs/domains/theme/architecture.md`
- `docs/audit/implementation-log.md`
- `docs/audit/stability.md`

## Exit Criteria

- Preset versus section ownership is explicitly documented.
- Invalid component-local preset responsibilities are remediated or formally deferred with reason.
- Verification passes.
- Plan-level and project-level docs are synchronized.
- A phase completion report is delivered and the audit pauses for user acknowledgment.

## Completion Notes

- Moved luxury-hacienda countdown layout defaults from
  `src/styles/themes/presets/_luxury-hacienda.scss` into
  `src/styles/themes/sections/_countdown-theme.scss`.
- Moved luxury-hacienda family layout defaults from
  `src/styles/themes/presets/_luxury-hacienda.scss` into
  `src/styles/themes/sections/_family-theme.scss`.
- Moved the luxury-hacienda gallery structural and interaction defaults from the preset into
  `src/styles/themes/sections/_gallery-theme.scss`.
- Preset isolation was revalidated with `pnpm ops validate-schema`; the command now reports zero
  preset isolation errors.
- Residual risk remains for jewelry-box-family, jewelry-box-countdown, and jewelry-box-thank-you
  variant-specific tokens still owned by presets. They are intentionally deferred to later theme and
  token-alignment work because they currently act as variant-scoped design inputs rather than luxury
  preset leaks.
