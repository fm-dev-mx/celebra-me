# Phase 04: BFF Presenter Implementation

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

## ✅ Verification Criteria

- [ ] Invitation pages render correctly with the new Presenter.
- [ ] Unit tests for `invitation-presenter` cover multiple theme/event scenarios.
- [ ] Significant Reduction in LOC (Lines of Code) within `.astro` page files.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Presenter returns typed `InvitationViewModel` interface.
  - Zero inline logic in `[slug].astro` beyond presenter call + component rendering.
  - CSS variable mapping centralized in presenter (no `define:vars`).
- **Validation Steps**:
  - Run `npm run test:unit -- --grep presenter`.
  - Verify all event themes render identically via visual regression.
  - Check Astro page files reduced by >40% LOC.

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
