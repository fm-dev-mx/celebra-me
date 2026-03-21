# Phase 01: 3-Layer Architecture Audit

## Objective

Identify and document all instances in `src/styles/noir-premiere-xv.scss` and related template files where raw CSS values have bypassed the project's native **3-Layer Color Architecture** (Design Tokens -> Theme Presets -> Component Variants).

## Context

The `noir-premiere-xv` event contains approximately 1,600 lines of production styles. Much of this is hardcoded values (`#010203`, `2rem`, etc.) that should be utilizing the existing token system or be standardized into component variants.

## Implementation Steps

1. **Token Discovery:** Use string extraction tools (or `plan-authoring` regex) to find all Hex codes, RGBs, and disparate `rem` spacing values inside `noir-premiere-xv.scss`.
2. **Matrix Mapping:** Map these hardcoded values to the closest existing tokens in `src/styles/base/_variables.scss` (e.g., matching a raw black hex to `$color-surface-dark`).
3. **Report Generation:** Output these findings to a `.agent/skills/theme-architecture/audit-results.md` artifact to guide the surgical refactor phase.

## Output

An exhaustive map of architectural debt and raw color values ready to be centralized.
