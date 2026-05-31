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

---

## 🏗️ Step 1: Scope Audit

Analyze the reviewed scope for:

- [ ] Nested section styles in preset files.
- [ ] Global style leaks (modifying `.card`, `.btn` outside of a preset class).
- [ ] Inconsistencies between foundation, semantic, and component token ownership.
- [ ] Missing slug-level isolation for event-specific overrides.

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
- [ ] Ensure all `sectionStyles` variants are documented.
- [ ] Sync Zod schemas in `src/content.config.ts` (include `labels` for RSVP and Tier 3 WhatsApp
      fields).

> **Source of Truth Path:** `docs/domains/theme/architecture.md` is the canonical theme-system
> document for the current repository layout.

## 🏗️ Step 4: Remediation & Alignment

If violations are found during Step 1 or 2:

- [ ] Move nested styles from `presets/` to their respective `sections/` files.
- [ ] Replace reusable hardcoded values with semantic tokens.
- [ ] Migrate hardcoded text/labels to event JSON files via `sectionStyles`.
- [ ] Ensure all variants follow the `[data-variant]` pattern.
- [ ] Ensure invitation-specific overrides remain inside `.event--<slug>` or
      `src/styles/events/<slug>.scss`.

## 🏗️ Step 5: Final Validation & Commit

After alignment:

- [ ] Run full build/test suite if necessary.
- [ ] Stage only the files for one coherent ADU (no mixed-intent commits).
- [ ] Prepare one coherent commit using the standard repository workflow.
- [ ] Set governance phase explicitly when needed (`--enforce-phase 1|2|3`) to match rollout policy.

---

## ✅ Verification Protocol

1. **Visual Regression**: Test the affected section across at least two different presets.
2. **Isolation Check**: Toggle between presets in the browser to ensure zero style bleeding.
3. **Linting**: Ensure no `!important` flags are used unless absolutely necessary for component
   overrides.
