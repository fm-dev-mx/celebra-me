---
description:
    Remediation execution for the 'Gerardo' invitation (Luxury Hacienda) based on UX audit findings
    (2026-02-12).
---

# 🍷 Workflow: Gerardo UX Remediation

This workflow addresses the premium quality gaps and luxury differentiators identified during the UX
audit of the Gerardo 60th Anniversary invitation on 2026-02-12.

## Phase 1: Tier 2 - Premium Polish (System Consistency)

**Objective**: Standardize design tokens and normalize spacing to ensure a robust premium
foundation.

1. **Standardize Hardcoded Fallbacks**:
    - [ ] Locate hardcoded hex colors in `src/components/invitation/components/EventHeader.astro`.
    - [ ] Locate hardcoded hex colors in `src/components/invitation/components/TimelineList.tsx`.
    - [ ] Replace hex values with appropriate semantic tokens (e.g., `$base-coffee-900`,
          `$base-gold-500`).

2. **Normalize Spacing**:
    - [ ] Open `src/styles/themes/presets/gerardo/_countdown-theme.scss`.
    - [ ] Open `src/styles/themes/presets/gerardo/_location-theme.scss`.
    - [ ] Replace hardcoded `rem` or `px` values with `$spacing-X` tokens from the design system.

3. **Typography Standardization**:
    - [ ] Audit all Gerardo-specific styles for ad-hoc `font-size`, `font-family`, or `line-height`
          declarations.
    - [ ] Refactor to use the `typography()` mixin to maintain consistency with the brand
          guidelines.

## Phase 2: Tier 3 - Luxury Differentiators (Sensory UX)

**Objective**: Implement high-end interactive and auditory elements to elevate the guest experience.

1. **Specular Light Effect**:
    - [ ] Implement a dynamic light sweep/glint effect on the "Jefe Botas" title in the Hero
          section.
    - [ ] The effect should ideally respond to mouse movement or have a subtle periodic shimmer.

2. **Audio Narrative Enhancement**:
    - [ ] Integrate a subtle "paper rustle" sound effect in `EnvelopeReveal.tsx`.
    - [ ] Trigger the sound precisely when the envelope opens to enhance tactile feedback.

---

## Phase 3: Verification & Quality Gate

// turbo

1. **Development Verification**:
    - [ ] Run `pnpm dev`.
    - [ ] Navigate to `/cumple/60-gerardo`.
    - [ ] Verify that all hex colors have been replaced by checking computed styles.
    - [ ] Test the "Jefe Botas" glint effect on hover/move.
    - [ ] Test the envelope opening sound (ensure it obeys user interaction/browser autoplay
          policies).

2. **Build Validation**:

    ```bash
    pnpm build
    ```

3. **Accessibility Audit**:
    - [ ] Verify that the new light effects do not cause flashes (seizure safety).
    - [ ] Ensure the audio effect has a clear "off" path or is subtle enough to not disrupt the
          music player.

// turbo 4. **Final Commit**: - Execute `.agent/workflows/gatekeeper-commit.md` in `--strict`
mode. - Documentation Update: Update `docs/implementation-log.md` with the changes.

---

## 🔒 Self-Archive

- [ ] Once completed, mark this task as finished in the project log and archive this workflow if no
      further Gerardo audits are planned.
