---
description: Premium Implementation & Verification Development Cycle (Full Rigor)
---

# Premium Development Cycle

1. **Context & Staging (Phase 0)**
    - Audit staged/unstaged changes. Detect anti-patterns (duplication, inline styles).
    - Architecture: BEM, SCSS nesting (max 3), `@use` only.
    - Security: No server modules in UI components.

2. **Implementation (Phase 1)**
    - Specification: Check `docs/PREMIUM_UX_VISION.md` and plan.
    - **Anonymization**: Stop if real client data is detected.
    - **Standards**: Use `<Image />`, minimize Client Islands, update schemas.
    - Use skills: `astro-patterns`, `frontend-design`, `animation-motion`, `copywriting-es`.

3. **Verification (Phase 2)**
    - Technical: Formatting, linting, tests (`pnpm test`).
    - A11y: WCAG 2.1 AA.
    - SEO: OG metadata for social sharing.

4. **Finalization (Phase 3)**
    - Documentation: Update `PREMIUM_UX_VISION.md` and `implementation-log.md`.
    - Commit: Conventional Commits with professional summary.

// turbo
