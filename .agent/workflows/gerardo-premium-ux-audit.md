---
description:
    Premium UI/UX audit for the "Gerardo" (Luxury Hacienda) invitation. Evaluates aesthetic
    coherence, interaction quality, emotional impact, and premium experience standards.
---

# 🎨 Workflow: Premium UI/UX Audit - Gerardo 60th Anniversary

## Objective

Execute a comprehensive UI/UX audit of the `cumple-60-gerardo` invitation to assess premium quality,
aesthetic excellence, and emotional impact. This is a **discovery-only** workflow; no changes should
be applied.

## Mandatory Constraints

- **Read-Only**: Do not modify code or execute design changes.
- **Evidence-Based**: Every finding must be backed by visual examples, file paths, and specific
  metrics.
- **Premium Focus**: Evaluate against luxury digital experience standards.
- **Language**: English for logic and reporting; Spanish for UI/Copy findings.

## Sources of Truth

1. **Source Code**: Direct analysis of the repository (Primary).
2. `docs/PREMIUM_UX_VISION.md`: Luxury experience standards.
3. `docs/THEME_SYSTEM.md`: Theme abstraction standards.
4. `src/content/events/cumple-60-gerardo.json`: Event data and styling configuration.
5. `src/styles/themes/luxury-hacienda/`: Theme-specific styles and tokens.
6. `src/styles/tokens/`: Design token definitions.

---

## Phase 0: Scope Lock & Baseline

**Goal**: Define the visual and interactive surface area for the audit.

**Steps**:

1. Identify all visual components specific to the Gerardo invitation:
    - Hero section with "Jefe Botas" branding
    - Countdown timer with luxury-hacienda variant
    - Location section with map styling
    - RSVP form with premium interactions
    - Family and gifts sections
2. Map theme application:
    - Verify `preset: "luxury-hacienda"` is consistently applied
    - Check color token usage (`--color-*` variables)
    - Validate typography system implementation
3. Document current visual state:
    - Screenshot key sections for before/after comparison
    - Note existing animations and transitions

**Expected Output**: Visual inventory with annotated screenshots and theme mapping.

---

## Phase 1: Aesthetic Coherence Audit

**Goal**: Verify consistency and excellence of the "Luxury Hacienda" aesthetic.

**Steps**:

1. **Color System Evaluation**:
    - Check hardcoded colors vs. design tokens
    - Verify 3-layer color architecture compliance
    - Assess color contrast ratios (WCAG AA/AAA)
2. **Typography Excellence**:
    - Validate font pairing hierarchy (Cinzel → Playfair → EB Garamond → Montserrat)
    - Check typography scale consistency
    - Assess readability and line lengths
3. **Visual Consistency**:
    - Compare section-to-section styling coherence
    - Verify consistent use of borders, shadows, and spacing
    - Check iconography and decorative element quality

**Verification Commands**:

```bash
# Find hardcoded colors bypassing tokens
rg "#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(" src/components/invitation/
# Check typography class usage
rg "class.*typography-" src/components/invitation/
```

---

## Phase 2: Motion & Transitions Excellence

**Goal**: Assess premium quality of animations and transitions.

**Steps**:

1. **Animation Quality**:
    - Evaluate easing curves (premium vs. default)
    - Check animation duration consistency
    - Assess scroll-triggered animations
2. **Transition Flow**:
    - Verify section-to-section transition smoothness
    - Check loading state animations
    - Assess interactive element feedback
3. **Performance Impact**:
    - Measure animation jank and frame rates
    - Check `will-change` property usage
    - Verify reduced motion support

**Verification Commands**:

```bash
# Find animation definitions
rg "animation:|transition:" src/styles/themes/luxury-hacienda/
# Check Framer Motion usage
rg "motion" src/components/invitation/
```

---

## Phase 3: Interaction Quality & Feedback

**Goal**: Evaluate premium interaction patterns and user feedback.

**Steps**:

1. **Button & Form States**:
    - Verify hover, focus, active, disabled states
    - Check form validation feedback
    - Assess error state styling
2. **Micro-interactions**:
    - Evaluate subtle feedback (like confirmation ticks)
    - Check loading indicators quality
    - Assess tooltip and hint systems
3. **Navigation Experience**:
    - Verify scroll behavior smoothness
    - Check navigation indicator clarity
    - Assess mobile touch target sizes

**Verification Commands**:

```bash
# Find interactive element states
rg ":hover|:focus|:active" src/styles/themes/luxury-hacienda/
# Check form validation patterns
rg "valid|invalid|required" src/components/invitation/
```

---

## Phase 4: Visual Hierarchy & Spacing

**Goal**: Assess premium visual composition and layout.

**Steps**:

1. **Spacing System**:
    - Verify consistent use of spacing scale
    - Check margin/padding consistency
    - Assess vertical rhythm
2. **Visual Weight**:
    - Evaluate hierarchy clarity (what's most important?)
    - Check contrast usage for emphasis
    - Assess whitespace effectiveness
3. **Grid & Alignment**:
    - Verify grid system implementation
    - Check element alignment precision
    - Assess responsive breakpoint consistency

**Verification Commands**:

```bash
# Check spacing token usage
rg "spacing-|gap-|padding-|margin-" src/styles/themes/luxury-hacienda/
# Find hardcoded spacing values
rg "[0-9]+(px|rem|em)" src/styles/themes/luxury-hacienda/ | grep -v "font-size"
```

---

## Phase 5: Mobile Excellence & Responsiveness

**Goal**: Evaluate premium mobile experience.

**Steps**:

1. **Touch Experience**:
    - Verify minimum 44px touch targets
    - Check gesture support quality
    - Assess mobile navigation clarity
2. **Responsive Design**:
    - Evaluate breakpoint strategy
    - Check content reflow quality
    - Assess image optimization for mobile
3. **Performance**:
    - Measure mobile load times
    - Check mobile-specific asset loading
    - Assess battery impact of animations

**Verification Commands**:

```bash
# Check mobile-specific styles
rg "@media.*max-width" src/styles/themes/luxury-hacienda/
# Find touch-related patterns
rg "touch-action|user-select" src/styles/
```

---

## Phase 6: Accessibility & Inclusivity

**Goal**: Verify luxury accessibility standards.

**Steps**:

1. **Visual Accessibility**:
    - Verify color contrast ratios meet WCAG AA
    - Check text resize support
    - Assess reduced motion preferences
2. **Interactive Accessibility**:
    - Verify keyboard navigation completeness
    - Check focus indicator visibility
    - Assess screen reader compatibility
3. **Cognitive Accessibility**:
    - Evaluate content clarity and simplicity
    - Check error message helpfulness
    - Assess loading state communication

**Verification Commands**:

```bash
# Check accessibility attributes
rg "aria-|role=" src/components/invitation/
# Find focus styles
rg ":focus-visible|outline" src/styles/themes/luxury-hacienda/
```

---

## Phase 7: Emotional Impact & Storytelling

**Goal**: Assess emotional connection and narrative flow.

**Steps**:

1. **First Impression**:
    - Evaluate hero section emotional impact
    - Check personalization level ("Jefe Botas")
    - Assess brand consistency
2. **Narrative Flow**:
    - Verify logical section progression
    - Check content pacing and rhythm
    - Assess climax points (RSVP, location reveal)
3. **Memorable Details**:
    - Evaluate unique decorative elements
    - Check signature moments
    - Assess shareability factors

**Verification Methods**: Subjective assessment with luxury benchmark comparison.

---

## Phase 8: Competitive Benchmark Analysis

**Goal**: Compare against premium market standards.

**Steps**:

1. **Direct Competitors**:
    - Compare with luxury invitation platforms
    - Assess unique value propositions
    - Evaluate premium differentiators
2. **Indirect Benchmarks**:
    - Compare with luxury brand websites
    - Assess premium e-commerce patterns
    - Evaluate high-end digital experiences

**Output**: Gap analysis with specific improvement opportunities.

---

## Phase 9: Consolidation & Premium Remediation Plan

**Goal**: Generate prioritized luxury improvement plan.

**Required Report Format**:

1. **Executive Summary**:
    - Premium Quality Score: `1-10`
    - Key Emotional Strengths
    - Critical Luxury Gaps
2. **Detailed Findings** (Categorized by Phase):
    - `[Section]` | `[Visual Example]` | `[Severity]` | `[Premium Standard]` | `[Current State]`
3. **Prioritized Remediation Plan (DO NOT EXECUTE)**:
    - **Tier 1 (Experience-Breaking)**: Issues that undermine premium perception
    - **Tier 2 (Premium Polish)**: Enhancements that elevate luxury feel
    - **Tier 3 (Luxury Differentiators)**: Innovations that create market leadership
4. **Visual Mockups**: Proposed "after" states for key improvement areas.

---

## Critical Reflection

- **Emotional Metrics**: Are we measuring subjective "premium feel" effectively?
- **Cultural Relevance**: Does "Luxury Hacienda" resonate with the target demographic?
- **Implementation Feasibility**: Can identified improvements be implemented within system
  constraints?
- **ROI Consideration**: Which improvements offer highest emotional return on investment?

---

## Deployment

1. Save this workflow as `.agent/workflows/gerardo-premium-ux-audit.md`.
2. Update `docs/implementation-log.md` with audit initiation.
3. Generate audit report in `reports/ux-audit-gerardo-YYYY-MM-DD.md`.

// turbo
