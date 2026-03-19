# Phase 03: Decouple Presenter Logic from Hardcoded Slugs

**Completion:** 100% | **Status:** COMPLETED

## 🎯 Objective

Remove content-specific branching (checking for `ximena-meza-trasvina`) inside generic presenter modules to enable architectural scalability.

## 🛠️ Actions

1. **Schema Extension**: Update `src/lib/schemas/content/hero.schema.ts` to include an optional `layoutVariant` or `renderStyle` field.
2. **Invitation Assembly Refactor**: Locate hardcoded logic in `src/lib/invitation/page-data.ts`:

```typescript
className: input.slug === 'ximena-meza-trasvina' ? 'layout--ximena-premium' : undefined,
```

- Replace with: `className: input.hero.layoutVariant ? "layout--" + input.hero.layoutVariant : undefined`.
3. **Content Alignment**: Update `ximena-meza-trasvina.json` to include `"layoutVariant": "ximena-premium"`.

## ✅ Verification

- **Code Audit**: No slug-specific strings remaining in `src/lib/presenters/`.
- **Render Validation**: Quinceanera demo must retain its premium layout after the toggle migration.
