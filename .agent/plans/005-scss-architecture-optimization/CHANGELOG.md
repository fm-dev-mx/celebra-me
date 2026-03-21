# Changelog: 005-scss-architecture-optimization

## [Unreleased]

### Added

- Initial plan structure
- Manifest with 4 phases
- Commit map with 4 units
- EXECUTION.md with step-by-step instructions for all phases

### Planned

#### Phase 01: Redundancy Elimination

- [ ] Remove `$transitions-by-component` from `_mixins.scss`
- [ ] Remove `$breakpoints` from `_mixins.scss` and `_functions.scss`
- [ ] Remove `$border-radius` from `_functions.scss`
- [ ] Remove `$z-index` from `_functions.scss`
- [ ] Remove `$backdrop-blurs` from `_functions.scss`
- [ ] Update all imports to reference single source

#### Phase 02: Token Unification

- [ ] Audit all section tokens in `themes/sections/`
- [ ] Create canonical token contracts per section
- [ ] Document token usage patterns
- [ ] Create `themes/sections/_component-tokens.scss` index

#### Phase 03: Hardcoded Value Elimination

- [ ] Replace `rgb(0 0 0 / 40%)` in `_hero.scss`
- [ ] Replace `rgb(17 12 9)` in `_family.scss`
- [ ] Replace dashboard gradient colors in `_shell.scss`
- [ ] Standardize error colors in `_rsvp.scss`
- [ ] Audit remaining hardcoded values

#### Phase 04: Pattern Standardization

- [ ] Enforce `@use '../tokens' as tokens` pattern
- [ ] Migrate components from Sass vars to CSS vars
- [ ] Create STYLEGUIDE.md documentation
- [ ] Add SCSS linting rules
- [ ] Update all affected imports

---

## History

| Date       | Change                | Author      |
| ---------- | --------------------- | ----------- |
| 2026-03-21 | Initial plan creation | Antigravity |
