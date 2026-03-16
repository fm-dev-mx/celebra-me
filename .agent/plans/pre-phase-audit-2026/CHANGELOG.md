# Changelog - Pre-Phase Technical Audit (2026)

## [1.0.4] - 2026-03-16

### Changed

- Amended Phase 03 acceptance criteria to use deterministic repository checks instead of IDE-only
  warnings and an undefined build-time benchmark.
- Marked Phase 03 complete after reconciling the approved acceptance criteria with the implemented
  schema modularization and documentation updates.

### Validation

- Confirmed Phase 03 closure against `pnpm exec astro check` and `npx astro build`.

## [1.0.3] - 2026-03-16

### Changed

- Implemented Phase 03 schema modularization by extracting event content schemas into
  `src/lib/schemas/content` and simplifying `src/content/config.ts` into a collection assembly
  layer.
- Added the legacy RSVP style namespace at `sectionStyles.rsvp.legacy` and updated
  `src/lib/adapters/event.ts` to preserve backwards-compatible fallbacks.
- Added `docs/core/content-schema.md` to document module boundaries and the deprecation path.

### Validation

- Verified the refactor with `pnpm exec astro check`.
- Verified collection/build integrity with `npx astro build`.

### Blocked

- Left Phase 03 in `BLOCKED` state because the original plan requires IDE-only deprecation warnings
  and a quantified build-time improvement without defining reproducible repository-level validation.

## [1.0.2] - 2026-03-16

### Changed

- Completed Phase 02 service decomposition for the RSVP domain with compatibility shims preserved at
  `src/lib/rsvp/service.ts` and `src/lib/rsvp/repository.ts`.
- Split RSVP logic into dedicated service modules for dashboard guest query/mutation, invitation
  context, RSVP submission, admin access, and shared helpers.
- Split repository logic into dedicated event, guest, audit, role-membership, claim-code, and shared
  row-mapper modules.

### Validation

- Verified the refactor with `pnpm exec astro check`.
- Verified RSVP-facing test coverage with `npm run test:rsvp`.

## [1.0.1] - 2026-03-16

### Changed

- Marked the overall plan and Phase 02 as `BLOCKED` after execution review found the original
  service decomposition scope was incomplete.
- Expanded Phase 02 requirements to include admin-access and shared-core decomposition for
  `src/lib/rsvp/service.ts` and `src/lib/rsvp/repository.ts`.

### Audit

- Recorded the blocker and approval gate in `README.md`, `manifest.json`, and
  `phases/02-service-decomposition.md` before any implementation work began.

## [1.0.0] - 2026-03-16

### Added

- Initial plan structure and technical audit research.
- Identification of top 5 critical anti-patterns.
- Proposed MVI solutions for backend, frontend, and governance domains.
