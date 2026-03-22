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

## Outcome

- Canonical semantic families remain the source of truth for surface, text, action, border, font, spacing, and motion variables.
- `token()` remains the minimal approved Sass accessor and `rgb-channels()` remains scoped to emitting bounded `*-rgb` contract values.
- Legacy aliases were reduced and explicitly bounded as compatibility bridges only.
- `--color-surface`, `--color-border`, and `--ff-heading` were retained as temporary bridges because active Astro pages still consume them.
