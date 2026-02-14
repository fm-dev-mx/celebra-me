# 🛠️ Workflow: Generic Section Remediation

---

## 1. Parameters

- **Section**: {header | hero | family | gallery | itinerary | rsvp | event}
- **Theme**: {luxury-hacienda | jewelry-box}

---

## 2. Objective

Address findings from the consolidated discovery report to improve theme adherence, performance, and
responsive parity.

---

## 3. Workflow Steps

### Phase 1: Style Abstraction

1. Locate hardcoded colors in `_section.scss` or `_section-theme.scss`.
2. Replace with semantic tokens or local CSS variables.
3. Ensure no RGB/Hex values remain in the component styles.

### Phase 2: Interaction & Responsive

1. Verify interaction states (hover, focus, active).
2. Fix "mobile hover gaps" by using scroll-triggered animations or media queries.
3. Validate responsive behavior at 320px, 390px, 768px, and 1440px.

### Phase 3: Thematic Parity

1. Switch to the alternative theme and verify visual correctness.
2. Ensure decorations are properly decoupled into separate components where applicable.

---

## 4. Verification

- `pnpm lint`
- `pnpm type-check`
- Visual inspection on both themes.

// turbo
