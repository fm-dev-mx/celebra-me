# Phase 03: Incremental Component Tokenization

## Goal

Migrate component-level SCSS to use CSS variables exclusively.

## Steps

1. **Low-Level Components**:
   - Migrate `buttons`, `icons`, and `badges`.
   - Replace `tokens.$color-xxx` with `var(--color-xxx)`.
2. **High-Level Components**:
   - Migrate `Hero`, `Gallery`, `EventHeader`.
   - Centralize duplicate keyframes and hardcoded colors.
3. **Aesthetic Check**:
   - Ensure "Jewelry Box" visual excellence is maintained or enhanced.
