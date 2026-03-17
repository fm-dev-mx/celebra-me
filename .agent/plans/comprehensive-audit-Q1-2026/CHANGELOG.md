# Changelog - Comprehensive Audit Q1 2026

## [2026-03-16]

### Added

- Pre-execution hardening for the Q1 2026 comprehensive audit plan.
- Cross-phase verification, accessibility, SEO, evidence, and documentation-sync gates.
- Explicit phase workflow, completion protocol, and user acknowledgment checkpoint.
- Per-phase verification commands, deliverables, and documentation sync targets in `manifest.json`.

### Changed

- Plan status moved from `PENDING` to `ACTIVE`.
- Phase 02 was corrected from a repo-wide kebab-case UI rename to a naming-governance audit aligned
  with the current source of truth: `PascalCase` UI components and `kebab-case` for utilities, docs,
  routes, and styles.
- Phase files were expanded to include entry criteria, tasks, verification steps, documentation sync
  requirements, and exit criteria.

### Documentation

- Registered this audit as an active execution track in `docs/DOC_STATUS.md`.
- Logged plan hardening in `docs/audit/implementation-log.md`.

### Phase 01

- Completed theme architecture refactoring for the luxury-hacienda preset by moving structural
  countdown, family, and gallery defaults into section theme files.
- Updated theme architecture and audit records to reflect the new preset-versus-section boundary.

### Phase 02

- Completed naming-governance remediation by preserving `PascalCase` for UI components and
  correcting two concrete support-module naming violations: `src/hooks/use-shortcuts.ts` and
  `src/interfaces/ui/components/nav-bar.interface.ts`.
- Clarified the project convention so hooks, interfaces, repositories, presenters, and helpers
  follow the `kebab-case` support-module rule even when they export `camelCase` or `PascalCase`
  symbols.
- Updated RSVP architecture and status docs to remove stale wording that implied repo-wide
  kebab-case UI enforcement.

### Phase 03

- Completed runtime token alignment for preset-sensitive invitation surfaces by adding the missing
  semantic typography, glass, and shadow variables in `src/styles/global.scss`.
- Replaced direct build-time token access with semantic CSS variable access in the quote, reveal,
  thank-you, base preset-override, and music theme layers where runtime preset choice can affect the
  rendered typography or glass treatment.
- Updated theme architecture, typography, and project conventions docs to distinguish runtime-facing
  semantic variable usage from acceptable SCSS token usage for authoring-only concerns.
