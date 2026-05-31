---
title: Pricing Section Premium Audit & Implementation Plan
status: implemented
created: unknown
updated: 2026-05-31
---

# Pricing Section Premium Audit & Implementation Plan

Audit and enhancement plan for the Celebra-me pricing section to increase premium perception,
technical consistency, and copy clarity.

## Summary

The current pricing section is functional and follows the basic project structure but lacks the
"Jewelry Box" aesthetic level found in other sections (Services, Testimonials). It also contains
minor technical redundancies and copy that could be elevated to match the high-end positioning of
the brand.

## Files Inspected

- `src/components/home/Pricing.astro`: Core component logic and structure.
- `src/styles/home/_pricing.scss`: Section-specific styles.
- `src/data/landing-page.data.ts`: Source of truth for pricing copy and data.
- `src/interfaces/ui/sections/landing-page.interface.ts`: Data structure for the section.
- `src/styles/themes/landing/presets/_jewelry-box-landing.scss`: Design tokens for the landing
  theme.
- `src/utils/animations.ts`: Animation utility for reveal effects.

## Current Issues Identified

### 1. Technical & Code Quality

- **Class Name Collision**: The inner div for tier groups uses class `.pricing-section`, which is
  the same as the outer section container. This leads to selector confusion and potential style
  leaks.
- **Generic Styling**: Pricing cards use semi-transparent backgrounds but lack the `backdrop-blur`
  (glassmorphism) used in the Services section.
- **Subtle Hierarchy**: The "Diseño a la Medida" (Exclusive) tier has very little visual distinction
  compared to the other tiers, relying only on a subtle top border.
- **Token Inconsistency**: Some spacing and sizing values are hardcoded in `_pricing.scss` instead
  of using the established design tokens.
- **Animation Sync**: While reveal animations exist, they are generic. They could be staggered more
  intentionally to create a premium "unfolding" feel.

### 2. UI/UX & Aesthetics

- **Premium Feel**: The "is-primary" scaling (1.03) is good, but the shadow and borders feel
  standard.
- **Badge Design**: The "Más recomendado" badge is functional but could use a more refined,
  jewelry-inspired treatment.
- **Visual Rhythm**: On mobile, the cards might feel repetitive if not distinguished by more than
  just text.
- **CTA Distinction**: All CTAs look similar; the primary plan should have a more "active" or
  "premium" button treatment without becoming "loud".

### 3. Spanish Copy Quality

- **Perceived Value**: Some wording like "Más recomendado" or "Promoción de lanzamiento" feels
  slightly generic/salesy.
- **Tier Differentiation**: The value of "Adaptación Editorial" (the middle tier) is strong but
  needs even clearer copy to justify the price jump from "Colección".
- **Footnote Positioning**: The delivery time footnote is small and could be integrated more
  elegantly into the card or the section floor.

## Recommended Changes

### Design & UI Enhancements

- **Glassmorphism**: Apply `backdrop-blur: 12px` to all cards to align with the "Jewelry Box"
  system.
- **Tier-Specific Treatments**:
  - **Colección**: Minimalist, clean parchment/gold borders.
  - **Adaptación Editorial (Primary)**: Fine gold double-border or a subtle glow transition.
  - **Diseño a la Medida (Exclusive)**: Use the darker `Slate 900` or `Coffee 900` surface with
    platinum/gold accents to denote exclusivity.
- **Refined Badges**: Use smaller, more elegant typography for badges (e.g., increased letter
  spacing, serifs).
- **Iconography**: Enhance the "check" icons to be more delicate (thinner strokes).

### Copy Improvements (Spanish)

- **Badges**:
  - `Más recomendado` -> `Nuestra Recomendación` or `El Favorito de Nuestros Clientes`.
  - `Promoción de lanzamiento` -> `Tarifa de Apertura` or `Beneficio de Lanzamiento`.
- **Headings**: Ensure "Inversión" is the primary focal point for cost, emphasizing value over
  price.
- **Tier Tags**: Add subtle "tags" or labels like "Entrega Ágil" for Colección and "Dirección
  Artística" for Editorial.

### Code Refactoring

- Rename the inner `.pricing-section` (in `Pricing.astro`) to `.pricing-tier-group`.
- Move hardcoded paddings and colors to `--pricing-*` tokens in `_jewelry-box-landing.scss`.
- Implement a more robust `is-exclusive` state in SCSS with distinct surface tokens.

## Implementation Steps

### Phase 1: Data & Interface (Pragmatic)

1. Update `landing-page.data.ts` with refined copy and tier-specific badges.
2. If necessary, add a `theme` or `variant` field to `PricingTier` interface to allow for the dark
   "Exclusive" card.

### Phase 2: Style Refinement (CSS)

1. **Token Update**: Add glassmorphism and exclusive surface tokens to `_jewelry-box-landing.scss`.
2. **Structural Fix**: Rename the colliding class in `Pricing.astro`.
3. **SCSS Refactor**: Update `_pricing.scss` to use the new tokens and implement the
   exclusive/primary variants with higher fidelity (jewelry-box aesthetic).
4. **Responsive Polish**: Adjust gaps and paddings for mobile/tablet to ensure vertical rhythm.

### Phase 3: Animation & UX

1. Refine the staggered reveal timing in `Pricing.astro` script.
2. Add hover transitions that feel "heavy" and premium (slow, smooth easing).

## Risks & Trade-offs

- **Performance**: Excessive use of `backdrop-blur` on many cards can impact performance on low-end
  mobile devices. (MITIGATION: Use it judiciously and test on mobile).
- **Legibility**: Transparent backgrounds must maintain contrast ratios (WCAG 2.1 AA). (MITIGATION:
  Use the derived RGB channels with proper alpha).

## Validation Checklist

- [ ] No duplicate class names in `Pricing.astro`.
- [ ] Contrast ratio passes for all text on various card backgrounds.
- [ ] Hover states feel responsive and premium.
- [ ] "Diseño a la Medida" tier looks significantly more exclusive than the others.
- [ ] Spanish copy is free of typos and maintains a warm/formal tone.
- [ ] Mobile layout is balanced and easy to scan.

## Out of Scope

- Changing the underlying pricing amounts (business logic).
- Modifying the contact form itself (only the link to it).
- Global site typography changes (only section-specific overrides if needed).
