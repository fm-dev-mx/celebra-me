# Phase 02: Static Analysis Rules Enforcement

## Objective

Give the Gatekeeper workflow code-quality teeth by hooking strict architectural linters into the `lint-staged` and pre-commit pipeline.

## Context

Gatekeeper currently checks if the *git commit* is perfect, but does not check if the *code* inside contains inline styles, inline scripts, god objects, or heavy coupling. We must enforce this mechanically rather than relying on the LLM's memory.

## Implementation Steps

1. **Inline Styles/Scripts Enforcement:** Configure `eslint-plugin-astro`, `eslint-plugin-react`, or `stylelint` to strictly error (`"error"`) on inline `<style>` or `style={}` props where disallowed.
2. **Coupling & God Objects:** Introduce boundaries or complexity limits. E.g., `eslint-plugin-boundaries` to prevent circular dependencies or cross-domain imports, and eslint complexity rules (max lines per file, max cyclomatic complexity).
3. **Language Governance:** Enforce the strict localization rule: ALL code (variables, components, props) and documentation must be in English. Spanish is strictly reserved for UI content and copywriting. Add a pre-commit check (dictionary linter or AI semantic check in `plan-authoring`) to flag Spanglish or Spanish code.
4. **Pipeline Hook:** Ensure these strict rules run within `pnpm lint-staged` via `.husky/pre-commit` so that any violation instantly fails the `gatekeeper-workflow` stage before a commit is created.

## Output

Hardened `.eslintrc.cjs` and `.stylelintrc.json` preventing the targeted bad practices.
