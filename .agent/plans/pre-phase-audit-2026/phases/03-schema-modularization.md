# Phase 03: Content Schema Modularization

**Status:** `BLOCKED`  
**Completion:** `80%`

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
    - Apply `@deprecated` JSDoc tags to ensure IDE warnings.

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
- [ ] IDE correctly flags deprecated fields in JSON content files.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Each schema module in `src/lib/schemas/content/` <100 LOC.
  - Legacy fields isolated in `schema.legacy` namespace.
  - Build time reduction for schema validation (>10% improvement).
- **Validation Steps**:
  - Execute `npx astro build` and verify no schema errors.
  - Verify `@deprecated` warnings appear in IDE for legacy fields.
  - Test adding new event with modular schema in staging.

## Validation Run

- `pnpm exec astro check` passed on 2026-03-16.
- `npx astro build` passed on 2026-03-16.
- All extracted schema modules are below the 100 LOC target.
- Legacy RSVP style labels now live under `sectionStyles.rsvp.legacy`.

## Blocker

The original plan defines two completion requirements that are not reproducibly verifiable from the
current repository workflow:

1. IDE deprecation warnings for JSON content files depend on editor/Astro integration behavior that
   is not observable from CLI automation.
2. The ">10% build time reduction" benchmark does not define a baseline capture method, sample size,
   or stable measurement protocol.

Phase 03 therefore cannot be marked complete without a plan amendment that replaces those conditions
with deterministic verification steps.

## 🧪 Regression Testing Note

- Validate all event types (XV, Wedding, Debutant) render correctly with refactored schemas.

## 📚 Documentation Sync Required

- Document new schema modularization approach in `docs/core/content-schema.md`.
- List deprecated fields in migration guide.
