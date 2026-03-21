# Phase 02: Theme Isolation & Preset Registration

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Create a new, fully scoped SCSS theme preset for the real XV client that has zero
side effects on existing presets (`jewelry-box`, `jewelry-box-wedding`, `luxury-hacienda`).

**Weight:** 25% of total plan

---

## 🎯 Analysis / Findings

### Current Theme Architecture

The project uses a **3-Layer Color Architecture** with theme presets defined in
`src/styles/themes/presets/`. Each preset is a CSS class (`.theme-preset--<name>`) that overrides
semantic CSS custom properties.

**Current presets:**

| Preset                | File                        | Used By       |
| :-------------------- | :-------------------------- | :------------ |
| `jewelry-box`         | `_jewelry-box.scss`         | `demo-xv`     |
| `jewelry-box-wedding` | `_jewelry-box-wedding.scss` | `demo-bodas`  |
| `luxury-hacienda`     | `_luxury-hacienda.scss`     | `demo-cumple` |

**Registration point:** `_invitation.scss` (barrel file):

```scss
@use 'jewelry-box';
@use 'jewelry-box-wedding';
@use 'luxury-hacienda';
```

**Contract enforcement:** `theme-contract.ts`:

```ts
export const THEME_PRESETS = ['jewelry-box', 'jewelry-box-wedding', 'luxury-hacienda'] as const;
```

### Isolation Strategy

The real XV invitation requires a **dedicated preset** to prevent cross-contamination with the
`demo-xv` (which uses `jewelry-box`). Two isolation layers are available:

1. **Preset-level:** New `.theme-preset--jewelry-box-xv-<client>` class via a new SCSS file.
2. **Event-level:** Per-event overrides via `src/styles/events/<slug>.scss` scoped to
   `.event--<slug>`.

**Recommended approach:** Use **both layers**:

- **Preset** for broad visual identity (colors, typography, glass effects).
- **Event override** for micro-adjustments specific to this one invitation.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Preset Creation

- [ ] Create `src/styles/themes/presets/_jewelry-box-xv-client.scss` with the client's color palette
      (30% of Phase)
- [ ] Follow the `_jewelry-box-wedding.scss` pattern as the structural reference (already uses the
      optimized `@use` pattern with `tokens`, `mixins`, and `funcs`)
- [ ] Define at minimum these overrides:
  - `--color-surface-primary` and RGB variant
  - `--color-action-accent` and RGB variant
  - `--color-glass-*` family
  - `--font-display`, `--font-calligraphy`
  - Hero, Family, Gallery, and Countdown section tokens

### Registration

- [ ] Add `@use 'jewelry-box-xv-client';` to `_invitation.scss` barrel file (10% of Phase)
- [ ] Add `'jewelry-box-xv-client'` to `THEME_PRESETS` in `theme-contract.ts` (10% of Phase)
- [ ] Confirm TypeScript compilation passes after the type union is extended (5% of Phase)

### Per-Event Override File

- [ ] Create `src/styles/events/<slug>.scss` file scoped to `.event--<slug>` (15% of Phase)
- [ ] Document the override file in accordance with `src/styles/events/README.md` (5% of Phase)

### Zero Side-Effect Validation

- [ ] Run dev server and verify `demo-xv` renders identically after changes (10% of Phase)
- [ ] Run dev server and verify `demo-bodas` renders identically after changes (10% of Phase)
- [ ] Run dev server and verify `demo-cumple` renders identically after changes (5% of Phase)

---

## ✅ Acceptance Criteria

- [ ] New preset file exists at `src/styles/themes/presets/_jewelry-box-xv-client.scss`.
- [ ] Preset is registered in `_invitation.scss` and `theme-contract.ts`.
- [ ] TypeScript and Sass compilation succeed without errors.
- [ ] All three existing demos render pixel-identically before and after changes.
- [ ] Per-event override file `.event--<slug>` is created and empty (ready for Phase 04 tweaks).

---

## 📎 References

- [Jewelry Box Preset](../../../../src/styles/themes/presets/_jewelry-box.scss) — Base XV preset
- [Jewelry Box Wedding Preset](../../../../src/styles/themes/presets/_jewelry-box-wedding.scss) —
  Best structural pattern
- [Preset Barrel](../../../../src/styles/themes/presets/_invitation.scss)
- [Theme Contract](../../../../src/lib/theme/theme-contract.ts)
- [Events Override README](../../../../src/styles/events/README.md)
- [theme-architecture Skill](../../../../.agent/skills/theme-architecture/SKILL.md)
