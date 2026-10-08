---
name: theme-architecture
description:
  Manage Celebra-me design tokens, theme presets, section styling contracts, and component token
  architecture.
domain: frontend
version: 1.1.0
when_to_use:
  - Editing SCSS tokens, presets, theme sections, or component styling architecture
  - Reviewing theme consistency, token usage, or preset isolation
  - Auditing section variants, profile boundaries, or invitation CSS isolation
  - Adding a new theme preset through the full SSOT + CSS resolver chain
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Theme SCSS files, design tokens, presets, section styles, and styling contracts
outputs:
  - Implementation guidance for token-safe SCSS architecture
related_skills:
  - frontend-design
  - client-invitation-audit
related_docs:
  - docs/domains/theme/architecture.md
  - docs/domains/theme/typography.md
  - docs/domains/theme/variant-system.md
  - .agent/skills/design-reference-to-build/SKILL.md
---

# Theme Architecture

This skill governs the styling infrastructure of Celebra-me.

## Core Model

Use the strict three-level token architecture:

1. **Foundation tokens**: `src/styles/tokens/system/**`, SCSS variables only, raw values only.
2. **Semantic tokens**: `src/styles/tokens/semantic/**`, global CSS custom properties for reusable
   system intent.
3. **Component tokens**: scoped CSS custom properties in the component, layout, section, or surface
   stylesheet that owns the contract.

Themes and states are not token layers. Theme presets override semantic and public component tokens.
States are represented inside component contracts, such as `--header-nav-color-scrolled` or
`--button-bg-hover`.

## Presets

Theme identity belongs in `src/styles/themes/presets/**`.

```scss
.theme-preset--my-theme {
  --color-surface-primary: var(--color-surface-secondary);
  --color-action-accent: #c5a059;
  --hero-card-bg: rgb(var(--color-surface-primary-rgb) / 86%);
}
```

Preset files may define or override semantic intent and public component tokens. They must not own
section layout, direct component selectors, or hidden theme-local token systems.

Presets must not target concrete section DOM selectors, internal section classes, IDs, `[data-*]`
selectors, or pseudo-elements. If a theme needs section DOM knowledge, move that rule to
`src/styles/themes/sections/<section>/`.

## Sections

Base invitation styles live in `src/styles/invitation/**`. Section partials under
`src/styles/themes/sections/**` are organization and presentation only.

Invitation theme CSS ownership:

- `src/styles/invitation/_<section>.scss`: shared structural and base styles for the section.
- `src/styles/themes/presets/_<preset>.scss`: global theme tokens and theme-wide custom properties
  only.
- `src/styles/themes/sections/<section>/_base.scss`: shared variant rules for that section only.
- `src/styles/themes/sections/<section>/_<semantic-variant>.scss`: rules for one registered semantic
  variant, only when tokens are not enough. The file is named after the variant, never after a
  preset.
- `src/styles/invitation-profiles/<visualProfileId>.scss`: custom-property declarations only (see
  `docs/domains/theme/architecture.md`, Invitation profile).

Decision rule:

- Values, tokens, and custom properties can live in presets or be consumed by section bases.
- Selectors, layout rules, pseudo-elements, internal section classes, structural overrides, and
  section DOM knowledge belong under `src/styles/themes/sections/<section>/`.
- Rules for every variant of a section belong in `src/styles/invitation/_<section>.scss`.
- Rules shared by multiple variants of one section belong in
  `src/styles/themes/sections/<section>/_base.scss`.
- Rules unique to one variant of one section belong in
  `src/styles/themes/sections/<section>/_<variant>.scss`.

Allowed section work:

- consume semantic tokens,
- expose or consume public component tokens,
- define layout, responsive behavior, and section presentation,
- scope concrete variant behavior with `[data-variant='...']`.

Section variant files are optional. Do not create or keep files only for symmetry. Controlled
exceptions are allowed when a variant has real layout, pseudo-element, responsive, or decorative
behavior, and those exceptions must stay under `themes/sections/<section>/`. Countdown is a
reference example after cleanup, not a required file-layout template for every section.

Avoid hardcoded theme identity in section partials. If a color or mood belongs to a theme and does
not require section DOM knowledge, move it to the preset and consume it through a semantic or
component token.

## Contracts

The active theme and event contract is `src/lib/theme/theme-contract.ts`.

`src/lib/theme/color-tokens.ts` is only a content color role contract. It maps approved content
roles to semantic CSS custom properties and must not become a parallel color system.

## Design Reference Handoff

Treat screenshots, Figma frames, generated concepts, and external design libraries as visual inputs,
not implementation contracts.

1. Identify the intended hierarchy, spacing, typography, color roles, surface treatment, motion, and
   responsive behavior.
2. Map those decisions to existing semantic and public component tokens first.
3. Put section structure and selector-aware behavior in the owning section base or variant.
4. Use a preset only for reusable theme identity; client-specific work is limited to token
   declarations in the invitation profile.
5. Reject pasted generated CSS, arbitrary design-tool values, and new parallel token names until
   they are reconciled with the three-level architecture.

If the reference requires a new live token, preset, variant, or isolation rule, apply the Governance
Audit below. Update `docs/domains/theme/architecture.md` only when the live technical contract
changes, not merely because a new visual brief exists.

## Operational Rules for CSS Boundaries

When editing or reviewing invitation theme styles, follow these rules strictly:

1. **Do not add section DOM selectors to presets.** Presets must contain only token and custom
   property declarations — never `.family__panel`, `.location__card`, `.gallery__item`, or similar.
2. **Prefer CSS variables in presets.** Express theme identity through semantic and component
   tokens. If a value can be a custom property, it should be.
3. **Put concrete section selectors in `themes/sections/<section>/`.** Any rule that targets section
   DOM internals, pseudo-elements, or structural overrides belongs in the section base or variant
   file, not in a preset.
4. **Preserve visuals when relocating styles.** Moving a rule from a preset to a section file (or
   vice versa) must not change the rendered output. Verify before and after.
5. **Avoid broad refactors when a local boundary fix is enough.** Fix the specific boundary
   violation rather than restructuring an entire section or preset.
6. **Check existing conventions before creating new files.** Look at sibling sections and existing
   variant files for patterns before introducing new organization.

## Extending a Preset (SSOT + CSS layers)

When adding a new preset, map the active pipeline first (`themes/presets/`, `invitation-presets/`,
`invitation-sections-by-preset/`, resolvers). Do not edit unused barrel files that are not imported
by the live CSS graph.

### Required layers

| Layer          | Typical path                                             |
| -------------- | -------------------------------------------------------- |
| Preset tokens  | `src/styles/themes/presets/_<preset>.scss`               |
| CSS entrypoint | `src/styles/invitation-presets/<preset>.scss`            |
| Section bundle | `src/styles/invitation-sections-by-preset/<preset>.scss` |

A preset adds tokens only. It never adds a section file: structure comes from registered semantic
variants (`src/styles/themes/sections/<section>/_<semantic-variant>.scss`, owned by
`src/lib/invitation/section-variants.ts`; see `docs/domains/theme/variant-system.md`). Existing
preset-named section partials and section-bundle selectors are transitional exceptions; do not add
new ones (`docs/domains/theme/architecture.md`, Transitional ownership exceptions).

### SSOT propagation order

1. `THEME_PRESETS` in `src/lib/theme/theme-contract.ts` (publish guard)
2. Preset SCSS + entrypoint + section bundle
3. Legacy, scheduled for removal: managed provisioning still requires a `DEMO_PRESET_CATALOG` entry
   with the same `themeId` (`src/lib/intake/demo-preset-catalog.ts`)
4. Optional showcase demo JSON under `src/content/event-demos/` and its asset registry

Never skip the theme-contract registration step.

### Resolver fallback is a blocking failure

Preset/section CSS resolvers may silently fall back to a default preset (e.g. `jewelry-box`) when an
entrypoint is missing. Treat any fallback as ship-blocking: verify file existence, glob coverage,
loaded stylesheets, and computed tokens on `.theme-preset--<preset>` (wrapper element — not
`:root`). `data-variant` is never a preset name.

## Governance Audit

Apply when contracts, variants, or isolation rules change:

- **Canonical variant boundary:** structural renderer selection belongs to the owning section's
  `variant`. Theme identity, slug, event type, and `visualProfileId` never select a renderer or
  provide a compatibility fallback. Legacy identity behavior is allowed only in a named
  compatibility boundary with an active consumer, owner, and removal condition.
- **Variant independence:** changing one `[data-variant]` never affects components outside it.
- **Data-driven text:** theme-specific labels (RSVP inputs, hero descriptors) live in content fields
  such as `rsvp.labels`, not hardcoded in Astro or React components.
- **Token discipline:** presets and profiles consume established component tokens
  (`--<component>-*`); never invent parallel names when canonical tokens exist. Presets set
  aesthetic values without invasive transforms (such as forced `uppercase`) that force profiles to
  negate them.
- **New variant:** first prove an existing variant or token cannot express the need; then add the
  schema value, registry entry, CSS delivery, and focused valid/invalid tests together, and update
  `docs/domains/theme/variant-system.md`.
- **Removing a compatibility path:** search managed definitions, demos, fixtures, tests, schemas,
  adapters, preview/publishing flows, and documentation first. Keep it and record the blocker while
  any consumer remains.
- **Verification:** test the section under at least two presets, run the structural resolver, CSS
  delivery, and profile-boundary suites, then `pnpm run ci`. Use visual comparison only when
  renderer selection, structural CSS, or layout changed.

## Review Checklist

- No foundation token is consumed directly by a component unless there is a documented reason.
- No vague aliases such as `--color-primary`, `--color-surface`, or `--color-theme` are introduced.
- No preset creates private `--theme-*` token systems.
- No preset targets section DOM selectors, internal section classes, IDs, `[data-*]` selectors, or
  pseudo-elements.
- No section partial preserves theme identity that should live in a preset.
- No section theme file exists only for symmetry.
- Variant files contain real section-specific behavior that cannot be expressed as tokens alone.
- No state token layer is introduced; state values stay in component contracts.
- Hardcoded reusable colors are moved to foundation, semantic, component, or email constants as
  appropriate.
- New presets are registered in theme-contract and do not silently resolve to the fallback preset.
