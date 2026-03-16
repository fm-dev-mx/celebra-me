# Phase 04: BFF Presenter Implementation

**Status:** `BLOCKED`  
**Completion:** `80%`

## 🎯 Objective

Implement a standard Presenter layer to decouple Astro pages from complex view-model derivation,
fulfilling the BFF (Backend-for-Frontend) architecture pattern.

## 🛠️ Step-by-Step Implementation

1.  **Define Presenter Blueprint**:
    - Create `src/lib/presenters/invitation-presenter.ts`.
    - Extract logic for:
      - CSS variable mapping.
      - Section visibility rules (Render Plan).
      - Guest context normalization.

2.  **Migrate Logic from Pages**:
    - Move derivation logic from `src/pages/[eventType]/[slug].astro` to the presenter.
    - Ensure the presenter returns a clean, fully-resolved View Model.

3.  **Refactor Astro Components**:
    - Update components to receive localized, ready-to-render props from the presenter instead of
      raw content slices.

## Implemented

- Added `src/lib/presenters/invitation-presenter.ts` as the route-facing presenter that composes the
  existing adapter, render plan, guest context, and theme token derivation into a typed page-ready
  contract.
- Added `src/components/invitation/InvitationSections.astro` to move section switching/render-plan
  orchestration out of the route.
- Refactored `src/pages/[eventType]/[slug].astro` to use the presenter for layout metadata, wrapper
  theme tokens, envelope props, hero props, section rendering, footer props, and music props.
- Replaced CSS `define:vars` usage with presenter-owned inline CSS custom properties on the page
  wrapper.
- Added unit coverage in `tests/unit/invitation.presenter.test.ts` for personalized and default
  presenter scenarios across real event fixtures.
- Updated `docs/core/project-conventions.md` and `docs/core/architecture.md` to document the new
  `src/lib/presenters/` boundary.

## ✅ Verification Criteria

- [x] Invitation pages render correctly with the new Presenter (`pnpm exec astro check`,
  `npx astro build`).
- [x] Unit tests for `invitation-presenter` cover multiple theme/event scenarios.
- [x] Significant reduction in LOC within `.astro` page files (`src/pages/[eventType]/[slug].astro`
  reduced from 316 to 129 lines).

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Presenter returns typed `InvitationViewModel` interface.
  - Zero inline logic in `[slug].astro` beyond presenter call + component rendering.
  - CSS variable mapping centralized in presenter (no `define:vars`).
- **Validation Steps**:
  - Run `npx jest tests/unit/invitation.presenter.test.ts --runInBand`.
  - Verify all event themes render identically via visual regression.
  - Check Astro page files reduced by >40% LOC.

## Validation Run

- `pnpm exec astro check` passed on 2026-03-16.
- `npx astro build` passed on 2026-03-16.
- `npx jest tests/unit/invitation.presenter.test.ts --runInBand` passed on 2026-03-16.
- `src/pages/[eventType]/[slug].astro` reduced from 316 LOC to 129 LOC, a 59.2% reduction.

## Blocker

The original plan still requires a validation stack that is not currently defined in the repository:

1. `npm run test:unit -- --grep presenter` cannot be executed because `package.json` does not define
   a `test:unit` script.
2. "Verify all event themes render identically via visual regression" has no Playwright snapshot
   suite, fixture matrix, or baseline workflow in the repo.

Phase 04 therefore cannot be marked complete without an approved plan amendment that replaces those
requirements with deterministic repository-level checks.

## ⚠️ Risk & Mitigation

| Risk                                  | Impact | Mitigation Strategy                                                          |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Presenter regression breaks all pages | High   | Implement comprehensive unit tests before deployment; feature flag fallback. |

## 🧪 Regression Testing Note

- **Automated**: Add snapshot tests for view model output across event types.
- **Manual**: Verify all 3 event types (XV, Wedding, Debutant) pages load with correct data.

## 📚 Documentation Sync Required

- Update `docs/core/project-conventions.md` to document Presenter pattern usage.
- Add `src/lib/presenters/` to API reference.
