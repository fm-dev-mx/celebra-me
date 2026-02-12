---
description: Jewelry Box theme extension to components.
---

# Jewelry Box Theme Expansion

1. **Invariants**
    - **Background**: Soft ivory parchment (#fffaf5 - #fdf8f0).
    - **Typography**: Light serif numbers, `Pinyon Script` accents.
    - **Glass**: 10px blur, white/gold border.
    - **Motion**: `premiumFadeUp`.

2. **Steps**
    - **Props**: Add `jewelry-box` to `variant` enum.
    - **Schema**: Update `src/content/config.ts`.
    - **SCSS**: `.target[data-variant='jewelry-box']`.
        - Apply parchment gradient.
        - Apply glassmorphism (alpha 0.4, blur 10px).

3. **Verification** // turbo
    - `pnpm build`: Verify types & schema.
    - Verify `data-variant="jewelry-box"` in HTML.

4. **Commit**: Use `/atomic-ui-commit`.
