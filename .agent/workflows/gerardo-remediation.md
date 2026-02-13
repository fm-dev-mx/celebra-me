---
description:
    Remediation execution for the 'Gerardo' invitation (Luxury Hacienda) based on technical audit
    findings.
---

# 🛠️ Workflow: Gerardo Remediation Execution

This workflow addresses the technical debt and duplication identified during the technical audit of
the Gerardo 60th Anniversary invitation.

## Phase 1: Component Refactoring

**Objective**: Eliminate logic duplication in `EventLocation.astro`.

1. **Create VenueCard**:
    - [ ] Generate `src/components/invitation/components/VenueCard.astro`.
    - [ ] Extract the common JSX structure for venue cards (Ceremony/Reception).
    - [ ] Define props for `VenueData`, `IconMap`, and `variant`.
2. **Update EventLocation**:
    - [ ] Replace the duplicated blocks with the new `<VenueCard />` component.
    - [ ] Verify that single-venue layouts still work as expected.

## Phase 2: Design Token Standardization

**Objective**: Remove hardcoded RGB values in favor of token-derived variables.

1. **Standardize Preset**:
    - [ ] Open `src/styles/themes/presets/_luxury-hacienda.scss`.
    - [ ] Replace hardcoded RGB strings (e.g., `58, 40, 25`) with Sass functions or token variables
          if available.
    - [ ] If no token exists, use `@use 'sass:color'` to derive the RGB components dynamically.

## Phase 3: UX & Script Optimization

**Objective**: Clean up inline scripts and boilerplate.

1. **Abstract Intersection Observer** (Optional/Recommended):
    - [ ] Evaluate if the observer in `Family.astro` can be moved to a shared utility.
    - [ ] Update `Family.astro` to use the unified animation trigger if implemented.

---

## Phase 4: Verification Gate

// turbo

1. **Build Validation**:

    ```bash
    pnpm build
    ```

2. **Visual Check**:
    - [ ] Run `pnpm dev`.
    - [ ] Navigate to `/cumple/60-gerardo`.
    - [ ] Confirm "Luxury Hacienda" aesthetic remains intact (parchment, leather, rivets).
    - [ ] Verify RSVP functionality and Google Maps links.

// turbo 3. **Commit Changes**:

- Execute `.agent/workflows/docs/gatekeeper-commit.md` in `--strict` mode.
- Keep one ADU per commit and avoid mixed-intent staging.
