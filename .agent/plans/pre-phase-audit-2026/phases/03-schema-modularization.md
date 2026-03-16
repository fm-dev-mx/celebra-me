# Phase 03: Content Schema Modularization

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

## ✅ Verification Criteria

- [ ] Successful content collection build (`npx astro build`).
- [ ] No type-safety regressions in components consume content data.
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

## 🧪 Regression Testing Note

- Validate all event types (XV, Wedding, Debutant) render correctly with refactored schemas.

## 📚 Documentation Sync Required

- Document new schema modularization approach in `docs/core/content-schema.md`.
- List deprecated fields in migration guide.
