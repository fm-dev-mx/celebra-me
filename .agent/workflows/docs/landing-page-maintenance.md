---
description: Comprehensive landing page maintenance and remediation (consolidated).
---

# 🏠 Workflow: Landing Page Maintenance

Consolidated workflow replacing:

- `landing-page-remediation.md` (deleted)
- `landing-page-regression-recovery.md` (archived)

**Modes:**

- `--remediation`: Deep fixes for structural issues
- `--recovery`: Quick regression fixes
- `--maintenance`: Routine upkeep

---

## 1. Scope

**Target Files:**

- `src/pages/index.astro` - Main page
- `src/components/home/` - All landing components
- `src/styles/home/` - Landing-specific styles
- `src/styles/themes/presets/_landing-page.scss` - Landing theme

**Key Areas:**

1. Hero Section
2. Header/Navigation
3. Pricing Section
4. FAQ Section
5. Contact Section
6. Footer
7. About Us

---

## 2. Mode: Recovery (Quick Fixes)

Use when: Visual regressions detected, urgent fixes needed

### Phase 1: Diagnostic

1. **Check for regressions:**
    - Broken layouts
    - Missing hover states
    - Color mismatches (brown/cafe tones appearing)
    - Icon visibility issues

2. **Token verification:**
    - Verify `theme-preset--landing-page` maps correctly
    - Check for hardcoded colors overriding tokens

### Phase 2: Quick Fixes

**Layout Fixes:**

- [ ] **Hero**: Restore vertical spacing and hierarchy
- [ ] **Pricing**: Fix card dimensions (prevent shrinking)
- [ ] **Header**: Adjust desktop horizontal padding/gaps
- [ ] **Footer**: Fix layout and vertical alignment

**Visual Fixes:**

- [ ] **Icons**: Fix "About Us" icons disappearing on hover
- [ ] **Colors**: Purge brown/cafe tones from all sections
    - Pricing (Custom Card)
    - FAQ
    - Contact
    - Footer
    - Header

### Phase 3: Verification

```bash
pnpm build
pnpm lint
```

**Manual checks:**

- [ ] Hero spacing correct
- [ ] Icons visible on hover
- [ ] Pricing cards sized properly
- [ ] Header spacing on desktop (>1024px)
- [ ] No brown tones visible
- [ ] Responsive: mobile stacking, desktop horizontal

---

## 3. Mode: Remediation (Deep Fixes)

Use when: Technical debt accumulation, structural issues

### Phase 0: Technical Debt Audit

1. **Scan for anti-patterns:**

    ```bash
    grep -r "!important" src/styles/home/
    grep -r "style=" src/components/home/
    grep -r "<style is:global>" src/components/home/
    ```

2. **Identify token misuse:**
    - Direct `tokens.$base-*` mappings that should be semantic
    - Hardcoded values instead of CSS variables
    - Color values not using `--landing-*` tokens

3. **Check accessibility:**
    - WCAG 2.1 AA contrast ratios
    - Focus states
    - Semantic HTML

### Phase 1: Scroll Behavior

**Problem**: Mandatory scroll-snap causing abrupt jumps

**Fix:**

```scss
// src/pages/index.astro
// Change from:
scroll-snap-type: y mandatory;

// To:
scroll-snap-type: y proximity;
// OR remove entirely if sections vary in height
```

### Phase 2: Header Premium Polish

1. **Apply Jewelry Box aesthetics:**
    - Subtle glassmorphism
    - Metallic CTA accents
    - Refined transitions

2. **Consolidate logo rendering:**
    - Remove duplicate `<img>` tags in `HomeHeader.astro`
    - Use `Logo.astro` component correctly
    - Avoid filter-based visibility hacks

3. **Improve variant strategy:**
    - Ensure logo legible against dark backgrounds
    - No manual overrides needed

### Phase 3: Section Normalization

**Apply 3-Layer Color Architecture to:**

1. **Contact Section** (`_contact.scss`):
    - Remove "hacky" overrides
    - Synchronize with `--landing-*` tokens
    - Map to semantic colors

2. **Pricing Section** (`_pricing.scss`):
    - Audit card styles
    - Use `--landing-surface-*` tokens
    - Ensure consistent spacing

3. **FAQ Section** (`_faq.scss`):
    - Audit for consistency
    - Use semantic tokens
    - Remove hardcoded values

### Phase 4: Footer Identity

1. **Logo visibility:**
    - Ensure legible against dark background
    - No manual filter overrides
    - Use Logo component properly

2. **Consistency:**
    - Match footer styling to design system
    - Use semantic tokens

### Phase 5: Architecture Alignment

**Move to theme layer:**

- Relocate global styles from components to `presets/_landing-page.scss`
- Remove `<style is:global>` blocks
- Ensure all styles use semantic tokens

**Token mapping:**

```scss
// Before (in component):
background-color: tokens.$base-cream;

// After (using semantic token):
background-color: var(--landing-surface-primary);
```

---

## 4. Mode: Maintenance (Routine)

Use when: Regular upkeep, preventive care

### Monthly Tasks

- [ ] Run `pnpm lint` on all home components
- [ ] Check for new `!important` usages
- [ ] Verify no inline styles added
- [ ] Test all hover states
- [ ] Responsive check (mobile, tablet, desktop)

### Quarterly Tasks

- [ ] Full accessibility audit
- [ ] Performance check (Lighthouse)
- [ ] Color contrast verification
- [ ] Link integrity check

---

## 5. Verification Protocol (All Modes)

### Automated Checks

```bash
pnpm lint          # No linting errors
pnpm check         # TypeScript passes
pnpm build         # Build succeeds
grep -r "!important" src/styles/home/  # Verify reduction
grep -r "style=" src/components/home/  # Zero inline styles
```

### Manual QA

- [ ] Scroll behavior feels natural
- [ ] Header transitions smooth
- [ ] All buttons interactive
- [ ] Forms functional
- [ ] Responsive at breakpoints:
    - Mobile: < 640px
    - Tablet: 640px - 1024px
    - Desktop: > 1024px

### Accessibility

- [ ] WCAG 2.1 AA contrast on all text
- [ ] Focus indicators visible
- [ ] Keyboard navigation works
- [ ] Screen reader labels present

---

## 6. Decision Matrix

| Situation                   | Mode            |
| --------------------------- | --------------- |
| Icons broken, colors wrong  | `--recovery`    |
| Layout broken after changes | `--recovery`    |
| Technical debt cleanup      | `--remediation` |
| Scroll behavior issues      | `--remediation` |
| Regular monthly check       | `--maintenance` |
| After theme changes         | `--remediation` |

---

## 7. Common Issues Reference

### Issue: Brown/Cafe colors appearing

**Cause**: Hardcoded colors or wrong token usage **Fix**: Replace with `--landing-*` semantic tokens

### Issue: Icons disappear on hover

**Cause**: Opacity or transform transition conflict **Fix**: Check `_about-us.scss` hover states

### Issue: Scroll jumps abruptly

**Cause**: `scroll-snap-type: y mandatory` **Fix**: Change to `y proximity` or remove

### Issue: Pricing cards too small

**Cause**: Flex/grid constraints or missing min-width **Fix**: Audit `_pricing.scss` dimensions

### Issue: `!important` proliferation

**Cause**: Style conflicts between global and local **Fix**: Move to theme layer
(`presets/_landing-page.scss`)

---

## 8. Migration Notes

**From `landing-page-remediation.md`:**

- Use `--remediation` mode
- All phases map directly
- Same verification steps

**From `landing-page-regression-recovery.md`:**

- Use `--recovery` mode
- Same diagnostic approach
- Same quick fixes

**Archive old workflows** after confirming this consolidation works.

---

## 9. Post-Work Update

After completion:

1. Update `docs/implementation-log.md`
2. Document any new patterns discovered
3. Update this workflow if new issues identified
4. Run final verification suite

// turbo

> [!IMPORTANT] Recovery mode for urgent fixes only. Remediation mode for debt cleanup. Always run
> verification suite before considering complete.
