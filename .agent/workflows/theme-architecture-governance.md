---
description: Governance and consistency workflow for theme abstraction and documentation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-04-17
---

# Workflow: Theme Architecture Governance

This workflow ensures that every invitation, demo, and landing page adheres to the three-level token
architecture, section-based abstraction, and invitation isolation rules.

## 📌 Architectural Standards

1. **Strict Token Architecture**: Foundation tokens are raw SCSS values, semantic tokens are global
   intent, and component tokens live with the owning surface.
2. **Strict Preset Isolation**: Presets (`presets/`) MUST define or override semantic and public
   component tokens. No section-specific layout ownership allowed.
3. **Section Ownership Split**: Base section styles live in `src/styles/invitation/**`. Dedicated
   section-theme directories in `src/styles/themes/sections/<section>/` are required for non-default
   variants, not for every section by default.
4. **Variant Independence**: Modifying one `[data-variant]` must never affect global components
   outside that variant.
5. **Invitation Isolation**: Event-specific styling must stay inside `.event--<slug>` namespaces and
   optional `src/styles/events/<slug>.scss` overrides so one invitation never leaks into another.
6. **Source of Truth**: `docs/domains/theme/architecture.md` must be updated whenever a live theme
   contract or isolation rule changes.
7. **Data-Driven Text Isolation**: Theme-specific labels (RSVP inputs, Hero descriptors) MUST live
   in the event JSON, not hardcoded in Astro or React components.
8. **Canonical Variant Boundary**: Structural renderer selection belongs to the owning section's
   canonical `variant` field. Theme identity, invitation slug, and `visualProfileId` must not select
   a canonical renderer or provide runtime compatibility fallbacks.
9. **Presentation/Skin Separation**: Presentation options and visual skins may change tokens, media
   treatment, copy, or motion, but must not replace a canonical renderer or internal grid. The
   current inventory and known exceptions are recorded in `docs/domains/theme/variant-system.md`.
10. **Identity Boundary**: Canonical resolvers and section renderers MUST NOT branch on invitation
    slug, event type, or visual profile identity. Legacy identity behavior is allowed only in a
    named compatibility boundary with an active consumer, owner, and removal condition.

---

## 🏗️ Step 1: Scope Audit

Analyze the reviewed scope for:

- [ ] Nested section styles in preset files.
- [ ] Global style leaks (modifying `.card`, `.btn` outside of a preset class).
- [ ] Inconsistencies between foundation, semantic, and component token ownership.
- [ ] Missing slug-level isolation for event-specific overrides.
- [ ] Identity or invitation-specific CSS-token knowledge inside canonical adapters, resolvers, or
      section renderers.
- [ ] A source-to-render trace for each audited invitation × rendered section, including explicit
      structural values, presentation options, renderer attributes, and CSS delivery.

## 🏗️ Step 2: Section Abstraction

For every modified invitation section:

- [ ] Verify existence of `src/styles/themes/sections/<section>/_index.scss`.
- [ ] Ensure shared section theme defaults live in `<section>/_base.scss`.
- [ ] Ensure base/default behavior lives in `src/styles/invitation/**` where appropriate.
- [ ] Ensure each non-default variant lives in its own `<section>/_<variant>.scss` partial and is
      contained within `.section[data-variant='...']`.
- [ ] Use runtime semantic tokens for reusable palette, typography, glass, and shadow roles.
- [ ] Keep state-specific values inside component token contracts.

## 🏗️ Step 3: Documentation & Sync

- [ ] Audit `docs/domains/theme/architecture.md` for drift.
- [ ] Ensure every present section variant is documented in the canonical registry.
- [ ] Sync Zod schemas in `src/content.config.ts` (include `labels` for RSVP and Tier 3 WhatsApp
      fields).
- [ ] Sync `docs/domains/theme/variant-system.md` whenever a structural variant, presentation
      option, skin, compatibility alias, or profile exception changes.

> **Source of Truth Path:** `docs/domains/theme/architecture.md` is the canonical theme-system
> document for the current repository layout.

## 🏗️ Step 4: Remediation & Alignment

If violations are found during Step 1 or 2:

- [ ] Move nested styles from `presets/` to their respective `sections/` files.
- [ ] Replace reusable hardcoded values with semantic tokens.
- [ ] Migrate hardcoded text/labels to event JSON files via the owning section fields (for example
      `rsvp.labels`).
- [ ] Ensure all variants follow the `[data-variant]` pattern.
- [ ] Ensure invitation-specific overrides remain inside `.event--<slug>` or
      `src/styles/events/<slug>.scss`.
- [ ] Before creating a variant, prove that an existing variant or token cannot express the
      requirement; add schema, CSS delivery, focused valid/invalid/fallback tests, and
      representative configuration together.
- [ ] Before removing a compatibility path, search managed invitations, demos, fixtures, tests,
      schemas, adapters/resolvers, preview/publishing flows, and operational documentation. Keep the
      path and record the exact blocker when any consumer remains.
- [ ] Treat a profile structural rule as an explicit exception until reusable evidence justifies
      extraction; do not create a new variant solely to eliminate one local rule.
- [ ] Record each parity row exactly once with one of `MATCH`, `INTENTIONAL_CHANGE`, `KNOWN_DEFECT`,
      `REGRESSION`, or `INSUFFICIENT_EVIDENCE`; keep auxiliary blocks (music, interludes, gated
      personalized access) separate from semantic section rows.

## 🏗️ Step 5: Final Validation & Handoff

After alignment:

- [ ] Run full build/test suite if necessary.
- [ ] Prepare one coherent change boundary for one ADU (no mixed-intent changes). Stage or commit
      only when the current Task Contract explicitly authorizes the corresponding Git operation.
- [ ] Hand off the validation evidence and any proposed commit boundary to the owner.
- [ ] Set governance phase explicitly when needed (`--enforce-phase 1|2|3`) to match rollout policy.

---

## ✅ Verification Protocol

1. **Visual Regression**: Test the affected section across at least two different presets.
2. **Isolation Check**: Toggle between presets in the browser to ensure zero style bleeding.
3. **Linting**: Ensure no `!important` flags are used unless absolutely necessary for component
   overrides.
4. **Variant Contract**: Run the focused structural resolver/CSS delivery/profile-boundary suites,
   then `pnpm run ci`. Use visual comparison only when renderer selection, structural CSS, layout,
   or profile interaction changed.
