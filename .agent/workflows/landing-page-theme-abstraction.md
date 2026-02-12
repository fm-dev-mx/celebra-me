---
description: Comprehensive abstraction of Landing Page styles into a decoupled theme layer.
---

# 🎨 Workflow: Landing Page Theme Abstraction

This workflow implements a dedicated theme layer for the landing page, separating structural layouts
from aesthetic properties (colors, gradients, shadows) to enable better maintenance and future
theming (e.g., Dark Mode).

## Phase 1: Semantic Token Architecture (Thematic Registry)

1. **Directory Setup**: Create `src/styles/themes/landing/` if it doesn't exist.
2. **Sectional Theming**: Define section-specific semantic tokens. Follow the **3-Layer Color
   Architecture** (Primitives → Semantic → Component).
    - `_hero.scss`: Overlay alphas, title text-shadows, mesh gradient colors.
    - `_services.scss`: Icon-container backgrounds, floating element glints.
    - `_about-us.scss`: Image frame glow, sparkle/decoration colors, value card depth/hover colors.
    - `_pricing.scss`: Tier-specific backgrounds (Basic vs Premium vs Elite), highlight colors,
      border-glows.
    - `_faq.scss`: Accordion background-alphas, open-state borders, icon colors.
    - `_footer.scss`: Footer-section background, sub-footer border-alphas, slogan opacity.
3. **Global Orchestration**:
    - Aggregate all in `src/styles/themes/landing/_index.scss`.
    - Update `src/styles/tokens/_index.scss` or `global.scss` to ensure the landing-theme layer is
      accessible.

## Phase 2: Component Refactoring (Decoupling)

For each section in `src/styles/home/`, replace hardcoded aesthetics with the new semantic
variables. **Layout, Flexbox, and Grid properties must remain in the structural files.**

- **Header** (`_home-header.scss`): Abstract CTA background/hover and navigation link
  opacity/colors.
- **Hero** (`_hero.scss`): Move mesh gradient logic and overlay opacities to theme tokens.
- **Services** (`_services.scss`): Abstract service card hover effects and icon-wrapper aesthetics.
- **About Us** (`_about-us.scss`): Move complex gradients, floating animations timings, and sparkle
  colors to theme.
- **Testimonials** (`_testimonials.scss`): Abstract card glassmorphism intensities.
- **Pricing** (`_pricing.scss`): Decouple card backgrounds (`is-elite`, `is-premium`) and
  border-catching effects.
- **FAQ** (`_faq.scss`): Abstract accordion backgrounds and open state border-colors.
- **Contact** (`_contact.scss`): Move form field focus-borders and button gradients to tokens.
- **Footer** (`_footer.scss`): Abstract section background and legal link opacities.

## Phase 3: Preset Integration & Normalization

1. **Landing Preset**: Update `src/styles/themes/presets/_landing-page.scss`.
    - Map Primitives to Global Semantic Roles.
    - Orchestrate Section-Specific tokens using the variables defined in Phase 1.
2. **Typography Abstraction**: Ensure font pairings (Display Elegant vs Body UI) are mapped to
   thematic variables, not hardcoded font-family strings.

## Phase 4: Verification & Quality Gate

// turbo

1. **Build Consistency**: Run `pnpm build` to ensure no circular dependencies or undefined
   variables.
2. **Visual QA**:
    - Verify layout remains identical to the current state (1:1 visual match).
    - Confirm "brown/cafe" tones are removed except where explicitly desired in the theme.
3. **Responsive & Interaction**:
    - Check hover states on mobile/tablet.
    - Verify animations (sparkles, floating) still work with abstracted timing tokens.
4. **Accessibility Check**:
    - Verify contrast ratios (WCAG 2.1 AA) for all text on the new centralized backgrounds.

---

// turbo

## Completion

1. Update `docs/implementation-log.md` with the abstraction details.
2. Self-archive this workflow by moving it to `.agent/workflows/tasks/archive/` or deleting it after
   verification.
