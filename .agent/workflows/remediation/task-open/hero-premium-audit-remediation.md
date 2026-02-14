---
description: Unified premium audit + remediation workflow for Invitation Hero section.
lifecycle: task-open
domain: remediation
owner: ux-remediation
last_reviewed: 2026-02-14
---

# Workflow: Hero Premium Audit + Remediation

## Objective

Audit and remediate `Hero` for invitation pages with premium UX, accessibility, and architecture
consistency across `luxury-hacienda` and `jewelry-box` variants.

## Inputs

- `src/components/invitation/Hero.astro`
- `src/styles/invitation/_hero.scss`
- `src/styles/themes/sections/_hero-theme.scss`

## Outputs

- `docs/audit/discovery-hero-YYYY-MM-DD.md`
- `docs/implementation-log.md` entry with ADU evidence
- Lifecycle transition: `task-open` -> `task-completed` -> `archive`

## Phase 0: Scope Lock

1. Select variant scope: `luxury-hacienda`, `jewelry-box`, or both.
2. Lock responsive checkpoints: `320`, `390`, `768`, `1024`, `1440`.
3. Freeze acceptance criteria before code changes.

## Phase 1: Discovery Audit

1. Visual hierarchy and editorial rhythm:
    - Validate label/title/date/venue readability and spacing.
2. Accessibility checks:
    - Contrast for title/meta text against overlays.
    - Focus visibility for interactive elements.
3. Motion checks:
    - Verify timeline/hero animations are smooth and scoped.
    - Validate `prefers-reduced-motion` fallback behavior.
4. Technical debt checks:
    - Find hardcoded colors and opacity values.
    - Find broad motion anti-patterns (`transition: all`).
5. Reveal state integrity:
    - Verify sealed -> revealed behavior has no flicker or double animation.

## Phase 2: Remediation ADUs

### ADU-1: Tokenization & Fallback Cleanup

- Replace hardcoded color values with semantic tokens and CSS vars.
- Keep only approved, documented fallbacks.

### ADU-2: Motion Scope Hardening

- Replace `transition: all` with property-scoped transitions.
- Normalize timing/easing through motion tokens.

### ADU-3: Keyboard Focus & Interactive States

- Add visible focus styles where missing.
- Preserve premium visual language in hover/focus/active states.

### ADU-4: Typography Harmonization by Variant

- Validate typography hierarchy and weights for both variants.
- Ensure calligraphy accents do not reduce metadata legibility.

### ADU-5: Operational Cleanup

- Remove duplicated instructions/comments.
- Align workflow text with current directory taxonomy.

## Phase 3: Verification

1. Static checks:

```bash
rg -n "transition:\\s*all" src/components/invitation/Hero.astro src/styles/invitation/_hero.scss src/styles/themes/sections/_hero-theme.scss
rg -n "#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(" src/styles/invitation/_hero.scss src/styles/themes/sections/_hero-theme.scss
rg -n "^<<<<<<<|^=======|^>>>>>>>" .agent/workflows docs/audit --glob "*.md"
```

2. Responsive verification at locked breakpoints.
3. Smoke checks (`pnpm lint:scss`, `pnpm build`) when execution phase is active.

## Phase 4: Closure

1. Append evidence-backed summary to `docs/implementation-log.md`.
2. Move this workflow to `remediation/task-completed/`.
3. Archive in next `workflow-sync` cycle.

## Acceptance Criteria

1. No hardcoded hex/rgba outside approved token strategy.
2. No `transition: all` in Hero styles.
3. Readable contrast for title and metadata.
4. Explicit reduced-motion support for non-essential effects.
5. Stable sealed/revealed behavior without visual jitter.
6. Visual parity across `jewelry-box` and `luxury-hacienda`.

// turbo
