---
description: Itinerary Section Remediation & Theme Abstraction
lifecycle: task-open
domain: remediation
owner: ux-remediation
last_reviewed: 2026-02-14
---

# 💎 Workflow: Itinerary Remediation & Abstraction

This workflow guides the surgical decoupling of the `Itinerary` section styles and logic, enforcing
the 3-Layer Color Architecture and theme-specific signatures for "Luxury Hacienda" and "Jewelry
Box".

## 1. Diagnosis & Setup

- [ ] **Analyze Style Leakage**: Examine `src/styles/invitation/_itinerary.scss` and
      `docs/audit/discovery-itinerary-2026-02-13.md`.
- [ ] **Fix SVG Path Fallback**: Update `TimelineList.tsx` to remove hardcoded `#d4af37`.
- [ ] **Align Line End**: Verify `.itinerary__line-end` positioning relative to SVG finish.
- [ ] **Verify Content Type**: Check `src/content/config.ts` and `src/content/events/*.json` to
      ensure itinerary data is strictly data-driven and not hardcoded in `Itinerary.astro`.
- [ ] **Create Theme File**:
    - // turbo
    - Create `src/styles/themes/sections/_itinerary-theme.scss`.
- [ ] **Register Section**:
    - Update `src/styles/themes/sections/_index.scss` to `@forward 'itinerary-theme';`.

## 2. Decoupling & Tokenization

- [ ] **Extract Variables**: In `invitation/_itinerary.scss`, replace theme-specific values with CSS
      variables prefixed with `--itinerary-`.
- [ ] **Port to Theme Layer**:
    - Move the extracted values to `_itinerary-theme.scss` within the appropriate theme preset
      blocks:
        - `.theme-preset--luxury-hacienda .itinerary`
        - `.theme-preset--jewelry-box .itinerary`
- [ ] **BEM Normalization**: Ensure all classes follow the project's strict BEM naming convention.

## 3. Aesthetic Refinement: Luxury Hacienda

- [ ] **Typography**: Apply `font-heading-hacienda` to titles and `font-body-hacienda` to
      descriptions.
- [ ] **Editorial Feel**: Implement generous vertical spacing and clear hierarchy.
- [ ] **Decorations**: Use `background-image` or `::before/::after` for subtle parchment or
      hacienda-inspired textures/flourishes.
- [ ] **Motion**: Integrated scroll-triggered animations (e.g., subtle fade-ins for timeline
      entries).

## 4. Aesthetic Refinement: Jewelry Box

- [ ] **Liquid/Glass Aesthetics**: Implement glassmorphism effects for timeline cards if applicable.
- [ ] **Typography**: Use `font-display-elegant` for headers.
- [ ] **Visual Polish**: Ensure high-contrast, "sparkling" accents using
      `var(--color-accent-jewel)`.

## 5. Verification & Quality Gate

- [ ] **Thematic Parity**: Verify both invitations render correctly and look distinct.
- [ ] **Responsive Integrity**: Test mobile breakpoints (especially timeline alignment).
- [ ] **Code Quality**:
    - // turbo
    - Run `pnpm lint` and `pnpm tsc`.
- [ ] **Gatekeeper**: Run
      `[/gatekeeper-commit](.agent/workflows/governance/evergreen/gatekeeper-commit.md)`.

## 6. Cleanup

- [ ] **Archive Audit**: Confirm `.agent/workflows/archive/itinerary-abstraction-audit.md` is the
      canonical archived record.
- [ ] **Self-Archive**: Move this workflow to `.agent/workflows/remediation/task-completed/` after
      completion, then to `.agent/workflows/archive/` in the next sync cycle.

---

### 🛡️ Critical Reflection

- **Decoupling Risk**: We must be careful not to break the `TimelineList.tsx` interaction while
  moving styles to the theme layer.
- **Specifics vs Globals**: Ensure `_itinerary.scss` contains ONLY the structural layout (display:
  flex, positioning) while the theme file handles ALL "makeup" (colors, borders, shadows, fonts).
