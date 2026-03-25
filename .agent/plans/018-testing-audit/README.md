# Plan: System Testing Utility & Dead-Weight Audit (018)

## Intent

Audit and optimize the `tests/` infrastructure to ensure high value-density, remove organizational
debt, and fulfill critical coverage gaps in the 3-Layer Theme and RSVP v2 domains.

## Scope

- **Structure**: Align misplaced files with the defined `tests/` hierarchy.
- **Governance**: Modernize the `style-boundaries` test for dynamic component discovery.
- **Gaps**: Add high-value Integration (Theme Delivery) and E2E (Full RSVP Flow) tests.
- **Pruning**: Identify and remove non-functional or redundant test logic.

## Success Criteria

- [ ] No test-related files remain misplaced in the root or feature subdirectories.
- [ ] `style-boundaries` test covers all relevant components automatically.
- [ ] Theme delivery is verified at the integration layer.
- [ ] RSVP v2 flow is verified E2E via Playwright.
- [ ] All tests pass in the CI environment (`pnpm test` and `pnpm exec playwright test`).

## Proposed Changes

### Structure Refactoring

- Move `tests/api/rsvp.helpers.ts` → `tests/helpers/api-mocks.ts`.
- Move `tests/sanity.test.ts` → `tests/unit/sanity.test.ts`.

### Governance Modernization

- Update `tests/unit/style-boundaries.test.ts`:
  - Replace hardcoded list with recursive file discovery for `src/components/invitation/` and
    `src/pages/[eventType]/[slug]/`.

### Coverage Gap Fulfillment

- **Theme Delivery Integration**: Validate that `eventType` and `preset` content properties
  correctly trigger the expected CSS variable injections.
- **RSVP v2 E2E**: Verify the "Happy Path" guest flow using Playwright.

## Verification Plan

### Automated Tests

- Run full suite: `pnpm test`
- Run Playwright: `pnpm exec playwright test`
- Run governance specific: `pnpm test tests/unit/style-boundaries.test.ts`

### Manual Verification

- N/A - This plan focuses entirely on automated infrastructure.
