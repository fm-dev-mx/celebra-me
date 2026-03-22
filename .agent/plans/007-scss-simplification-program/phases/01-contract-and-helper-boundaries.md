# 01 Contract and Helper Boundaries

## Goal

Define the canonical SCSS contract and the allowed helper surface before implementation begins.

## Scope

- keep `token()` in `src/styles/tools/_functions.scss`
- treat `rgb-channels()` as a restricted helper, not a pattern to expand casually
- identify and deprecate aliases in `src/styles/tokens/contracts/_core.scss`
- define the allowed public styling vocabulary for contributors

## Work Items

- audit exported token helpers and document which are canonical versus compatibility-oriented
- define the canonical variable families for color, type, spacing, motion, and surface semantics
- record the status of legacy aliases and prohibit new alias families
- document the rule that Sass helpers must prevent real duplication across multiple files

## Acceptance Criteria

- canonical variable families are documented
- helper policy is explicit
- no new alias families are introduced
