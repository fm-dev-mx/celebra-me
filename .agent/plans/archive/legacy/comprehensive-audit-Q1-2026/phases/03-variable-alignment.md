# Phase 03: SCSS-to-CSS Token Alignment

## Status

`COMPLETED`

## Objective

Replace build-time-only SCSS token usage in theme-sensitive surfaces with runtime CSS variables
where required for responsive preset behavior.

## Current-State Evidence

- Theme documentation already requires semantic CSS variables for runtime preset behavior.
- Multiple style layers still consume static SCSS token values directly.
- The project intentionally keeps SCSS as the authoring layer, so this phase is about token access,
  not file extension changes.

## Entry Criteria

- Phase 02 is complete.
- Theme token and semantic variable documentation has been reviewed.

## Audit Scope

- `src/styles/invitation/**/*.scss`
- `src/styles/themes/**/*.scss`
- `src/styles/home/**/*.scss`
- `src/styles/dashboard/**/*.scss`
- `src/styles/auth/**/*.scss`
- `src/styles/global.scss`

## Tasks

1. Audit runtime theme-sensitive style declarations.
2. Replace invalid static token consumption with semantic CSS variable access.
3. Add fallbacks only where necessary.
4. Expand semantic token coverage if required by the remediation.
5. Sync token architecture updates into project documentation.

## Cross-Phase Gates

- Verification
- Accessibility, especially contrast and focus states
- SEO for any touched public page shell behavior
- Documentation sync
- Evidence capture

## Verification

- `pnpm lint:scss`
- `pnpm type-check`
- `pnpm build`

## Docs To Sync

- `.agent/plans/comprehensive-audit-Q1-2026/README.md`
- `.agent/plans/comprehensive-audit-Q1-2026/manifest.json`
- `.agent/plans/comprehensive-audit-Q1-2026/CHANGELOG.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/typography.md`
- `docs/core/project-conventions.md`
- `docs/audit/implementation-log.md`

## Exit Criteria

- Runtime theme-sensitive styles use semantic CSS variables where required.
- Any remaining static token usage is intentional and documented.
- Verification passes.
- Plan-level and project-level docs are synchronized.
- A phase completion report is delivered and the audit pauses for user acknowledgment.

## Completion Notes

- Added the missing runtime semantic variables in `src/styles/global.scss` for preset-sensitive
  typography and glass roles, including `--font-display-hacienda`, `--font-body-hacienda`,
  `--color-glass-bg`, `--color-glass-border`, `--color-glass-shadow`, `--shadow-subtle`,
  `--shadow-emphasis`, and `--shadow-premium`.
- Replaced direct `tokens.$...` typography and glass-role access in quote, reveal, thank-you, base
  preset-override, and music theme files with semantic CSS variables where runtime preset switching
  can change the rendered result.
- Documented that direct SCSS token access remains acceptable for authoring-only concerns such as
  motion timing, spacing defaults, and fallbacks where no runtime override exists.
- Verification outcome:
  - `pnpm lint:scss` passed.
  - `pnpm type-check` passed.
  - `pnpm build` passed.
