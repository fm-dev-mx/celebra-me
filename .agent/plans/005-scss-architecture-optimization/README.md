# Plan 005: SCSS Architectural Optimization

## Abstract

This plan addresses critical redundancies, token inconsistencies, and hardcoded value leaks across
Celebra-me's SCSS ecosystem. The goal is to achieve a single source of truth for design tokens,
eliminate duplicate variable definitions, enforce consistent patterns, and establish clear
guidelines for runtime theming compatibility.

## Objectives

1. **Eliminate Redundancy**: Remove duplicate variable definitions across `_mixins.scss`,
   `_variables.scss`, and `_functions.scss`
2. **Token Unification**: Consolidate section tokens into a canonical contract
3. **Hardcoded Value Elimination**: Replace raw CSS values with semantic tokens
4. **Pattern Standardization**: Enforce consistent usage of Sass vs CSS variables
5. **Documentation**: Create a styleguide for future contributions

## Background & Scope

Based on the comprehensive audit of `src/styles/`:

| Issue Category                 | Count | Severity |
| ------------------------------ | ----- | -------- |
| Duplicate variable definitions | 6     | CRITICAL |
| Hardcoded color values         | 15+   | HIGH     |
| Primitive token leakage        | 4+    | MEDIUM   |
| Inconsistent import patterns   | 8+    | MEDIUM   |

## Architecture Overview

The project follows a **3-Layer Token Architecture**:

```
Layer 1: Primitives (tokens/_primitives.scss)
    └── Raw HSL color scales, base values - NEVER use directly

Layer 2: Semantic (tokens/_semantic.scss)
    └── Purpose-driven roles with CSS var references

Layer 3: Themes (themes/presets/*.scss, themes/sections/*.scss)
    └── CSS variable overrides for runtime theming
```

## Phases

- **[01-redundancy-elimination]**: Remove duplicate Sass variable definitions
- **[02-token-unification]**: Consolidate section tokens into canonical contracts
- **[03-hardcoded-value-elimination]**: Replace raw CSS values with semantic tokens
- **[04-pattern-standardization]**: Enforce consistent patterns and create styleguide

## Health Assessment

| Dimension           | Current Score | Target |
| ------------------- | ------------- | ------ |
| Token Architecture  | 7/10          | 9/10   |
| Naming Consistency  | 5/10          | 9/10   |
| Redundancy Control  | 4/10          | 9/10   |
| Runtime Themability | 8/10          | 10/10  |
| Documentation       | 6/10          | 9/10   |

## Constraints

- Zero breaking changes to existing themes
- Runtime theming must continue to work
- All existing presets must remain functional
- Changes must be backward compatible with Astro patterns

---

_Generated under the chronological archival governance rule._
