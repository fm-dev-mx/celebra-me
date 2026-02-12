---
description: Color Architecture & Design Token Management Workflow
---

# /color-architecture: Color Token Management

1. **Architecture (3-Layer)**
    - **Primitives**: Base HSL/Hex (`_primitives.scss`). NEVER use in components.
    - **Semantic**: Abstract roles (`_semantic.scss`).
    - **Presets**: CSS Variable overrides (`presets/_[theme].scss`).

2. **Execution Phases**
    - **Audit**: Identify scope (Global vs Event), check contrast (WCAG AA).
    - **Implementation**:
        - Register Primitives -> Map to Semantic roles.
        - Pattern: `color: var(--color-target, tokens.$semantic-fallback);`
    - **Theme Definition**: Update preset SCSS. Inject `--color-primary`, `--color-primary-rgb`,
      etc.
    - **Refactor**: Remove hex/legacy vars. Replace with semantic variables.

3. **Golden Rules**
    - **Zero Hex**: Component SCSS must only use tokens.
    - **RGB Support**: Provide `--color-*-rgb` for opacity.
    - **Naming**: `$color-[role]-[state]` (e.g., `$color-button-primary-hover`).

// turbo
