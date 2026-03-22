# 02 Global Layer Reduction

## Goal

Reduce duplicated authorship layers in globals so that `global/*` does not compete with the token
system.

## Scope

- audit `src/styles/global/_mixins.scss`
- move breakpoint and type ownership to canonical layers where appropriate
- keep only mixins that provide reusable authoring behavior
- remove `@use ... as *` from global consumers

## Work Items

- identify which breakpoint and typography concerns belong in tokens or tools instead of globals
- reduce global mixins to a minimal authoring utility surface
- replace wildcard imports in touched global consumers with explicit namespaces
- document any temporary compatibility bridges left in place

## Acceptance Criteria

- globals are no longer a competing token source
- breakpoints and typography have one authoritative definition
- wildcard Sass imports are removed from touched files

## Outcome

- Breakpoint ownership moved into `src/styles/tokens/_spacing.scss`.
- Authoring typography preset ownership moved into `src/styles/tokens/_typography.scss`.
- `src/styles/global/_mixins.scss` now delegates to those canonical maps instead of defining parallel values.
- Wildcard Sass imports were removed from touched consumers, keeping namespaced access explicit.
