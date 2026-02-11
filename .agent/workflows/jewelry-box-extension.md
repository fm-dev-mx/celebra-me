---
description: Jewelry Box Theme Expansion Workflow
---

# Jewelry Box Theme Expansion Workflow

This workflow defines the systematic process for adding the premium `jewelry-box` aesthetic variant to any invitation component.

## 1. Context & Invariants
The `jewelry-box` theme must respect the following visual standards:
- **Background**: Soft ivory/cream parchment (`#fffaf5` to `#fdf8f0`).
- **Typography**: Light serif for numbers/body, `Pinyon Script` for calligraphic accents.
- **Glassmorphism**: 10px blur, subtle white/gold borders.
- **Ornaments**: Minimal gold lines or premium refined SVGs.
- **Motion**: `premiumFadeUp` (Blur + Translate Y).

## 2. Implementation Steps

### A. Component Prop Update
Add `jewelry-box` to the `variant` enum in your `.astro` or `.tsx` component.
```typescript
interface Props {
  variant?: 'minimal' | 'modern' | 'jewelry-box';
}
```

### B. Schema Synchronization
Update `src/content/config.ts` to include `jewelry-box` in the corresponding section schema.
```typescript
// Example: src/content/config.ts
location: z.object({
  variant: z.enum(['structured', 'organic', 'jewelry-box']),
})
```

### C. Style Implementation
Create or update the theme-specific SCSS file (e.g., `_mycomponent-theme.scss`).
// turbo
1. Add the selector: `.my-section[data-variant='jewelry-box'] { ... }`
2. Apply the **Parchment Background**:
   ```scss
   background: linear-gradient(180deg, #fffaf5 0%, #fdf8f0 50%, #fffaf5 100%);
   ```
3. Apply **Glassmorphism** to containers:
   ```scss
   background: rgba(255, 255, 255, 0.4);
   backdrop-filter: blur(10px);
   border: 1px solid rgba(212, 175, 55, 0.2);
   ```

### D. Verification
// turbo
1. Run `pnpm build` to ensure type safety and schema validation.
2. Inspect the generated HTML in `dist/` to verify `data-variant="jewelry-box"`.

## 3. Atomic Commit
Use `/atomic-ui-commit` to deliver the new variant.
