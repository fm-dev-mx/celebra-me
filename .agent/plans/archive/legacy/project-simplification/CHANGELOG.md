# 📝 Changelog: Project Simplification & De-engineering

Deterministic audit trail for `project-simplification`.

---

## [Unreleased]

### Phase 07: Verification and Closeout

- **Recorded validation outcomes:** `pnpm astro check`, `pnpm test`, `pnpm assets:check-registry`, and `pnpm ops check-links` passed; `pnpm lint` remained green with 2 pre-existing warnings in `src/lib/adapters/event-helpers.ts`. (Completed: 2026-03-19 08:57)
- **Documented residual blocker:** Kept Phase 07 open because `pnpm ops validate-schema` still fails on pre-existing ThemeContract/CSS variant drift and manual browser smoke was not run in this turn. (Completed: 2026-03-19 08:57)
- **Closed verification hold:** Archive review re-ran the repo checks, confirmed schema validation now passes, and closed the stale verification blocker. (Completed: 2026-03-19 10:30)
- **Archive handoff:** Archived the completed simplification plan under `.agent/plans/archive/project-simplification/`. (Completed: 2026-03-19 10:30)

### Phase 06: Governance and Docs Simplification

- **Scaffolded plan:** Added `project-simplification` plan records and modular phase files. (Completed: 2026-03-19 08:48)
- **Aligned docs:** Corrected stale active-plan inventory and updated governance references to current modules. (Completed: 2026-03-19 08:48)

### Phase 05: Dead Code, Assets, and Dependencies

- **Pruned dead artifacts:** Removed zero-reference wrapper components, obsolete SCSS files, and duplicate binary assets. (Completed: 2026-03-19 08:48)
- **Reduced dependency bloat:** Removed unused duplicate font packages and stale type packages from `package.json`. (Completed: 2026-03-19 08:48)

### Phase 04: Style and Theme Pruning

- **Reassigned landing ownership:** Moved landing-only theme variables out of `global.scss` into `landing.scss`. (Completed: 2026-03-19 08:48)
- **Eliminated stale styles:** Removed unreferenced layout and landing preset artifacts. (Completed: 2026-03-19 08:48)

### Phase 03: RSVP Module Consolidation

- **Flattened dashboard guest services:** Added `dashboard-guests.service.ts` and removed forwarding RSVP service barrels. (Completed: 2026-03-19 08:48)

### Phase 02: Invitation Surface Simplification

- **Collapsed invitation assembly:** Added `src/lib/invitation/page-data.ts` and removed presenter/render-plan split. (Completed: 2026-03-19 08:48)

### Phase 01: Baseline and Safety Net

- **Confirmed deletion set:** Re-validated repo state after interruption and built the reference matrix used for cleanup. (Completed: 2026-03-19 08:48)
