# Phase 03: Content Schema Modularization

**Status:** `COMPLETED`  
**Completion:** `100%`

## 🎯 Objective

Decouple the massive `src/content/config.ts` by modularizing Zod schemas into feature-specific
files, improving build performance and developer clarity.

## 🛠️ Step-by-Step Implementation

1.  **Extract Base Schemas**:
    - Move section-specific schemas (Hero, Location, Family, RSVP, Gifts) to
      `src/lib/schemas/content/`.
    - Create a central `src/lib/schemas/content/base-event.schema.ts`.

2.  **Define Deprecation Strategy**:
    - Create a `legacy` namespace within the schemas for fields marked for removal.
    - Apply `@deprecated` JSDoc tags in schema source and preserve a documented migration path.

3.  **Refactor Config**:
    - Re-import modular schemas into `src/content/config.ts`.
    - Simplify the main `eventContentSchema` to be an assembly of modular sub-schemas.

## Implemented

- Extracted modular schema files under `src/lib/schemas/content/`: `base-event.schema.ts`,
  `hero.schema.ts`, `location.schema.ts`, `family.schema.ts`, `rsvp.schema.ts`, `gifts.schema.ts`,
  `section-styles.schema.ts`, and `shared.schema.ts`.
- Refactored `src/content/config.ts` to assemble collections from
  `@/lib/schemas/content/base-event.schema`.
- Moved deprecated RSVP style labels under `sectionStyles.rsvp.legacy` and added `@deprecated` JSDoc
  metadata in `rsvp.schema.ts`.
- Updated `src/lib/adapters/event.ts` to preserve runtime compatibility by reading the legacy RSVP
  label namespace as a fallback.
- Documented the modular schema architecture and migration path in `docs/core/content-schema.md`.

## ✅ Verification Criteria

- [x] Successful content collection build (`npx astro build`).
- [x] No type-safety regressions in components consume content data (`pnpm exec astro check`).
- [x] Deprecated fields are isolated under `sectionStyles.rsvp.legacy` and documented in schema and
      architecture docs.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Each schema module in `src/lib/schemas/content/` <100 LOC.
  - Legacy fields isolated in `schema.legacy` namespace.
  - `src/content/config.ts` reduced to collection assembly only.
- **Validation Steps**:
  - Execute `npx astro build` and verify no schema errors.
  - Execute `pnpm exec astro check` and verify no schema type regressions.
  - Verify deprecated fields only exist under `sectionStyles.rsvp.legacy` in schema and adapter
    code.

## Validation Run

- `pnpm exec astro check` passed on 2026-03-16.
- `npx astro build` passed on 2026-03-16.
- All extracted schema modules are below the 100 LOC target.
- Legacy RSVP style labels now live under `sectionStyles.rsvp.legacy`.
- `src/content/config.ts` is now a thin assembly layer over `src/lib/schemas/content`.
- Deprecated fields are documented in `docs/core/content-schema.md` and
  `docs/domains/theme/architecture.md`.

## 🧪 Regression Testing Note

- Validate all event types (XV, Wedding, Debutant) render correctly with refactored schemas.

## 📚 Documentation Sync Required

- Document new schema modularization approach in `docs/core/content-schema.md`.
- List deprecated fields in migration guide.

## Plan Amendment

The original Phase 03 acceptance criteria required IDE-only warnings and a quantified build-time
benchmark that were not reproducibly verifiable from the repository. Per approval on 2026-03-16, the
phase now closes against deterministic checks:

1. `pnpm exec astro check` passes.
2. `npx astro build` passes.
3. Deprecated fields are isolated to `sectionStyles.rsvp.legacy` and documented in repository docs.
4. `src/content/config.ts` is reduced to schema assembly and collection registration.
