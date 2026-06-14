---
title: Dashboard Styling Incremental Refactor
status: implemented
created: 2026-06-11
updated: 2026-06-11
implemented: 2026-06-11
related_skills:
  - frontend-design
  - theme-architecture
related_docs:
  - docs/domains/theme/architecture.md
supersedes: []
superseded_by: []
---

# Dashboard Styling Incremental Refactor

## 1. Current State Summary

The dashboard styling architecture has systemic inconsistencies: broken token references (intake
uses `--color-state-error-*`, `--color-text-inverse`, `--color-bg-subtle` — none defined),
duplicated component patterns (7+ chip variants, 5+ badge variants), modal styles scattered between
`_modals.scss` and `_guests.scss`, 48+ raw `rgb()` values in `_shell.scss`, and a 3690-line
`_intake.scss` file.

Full diagnosis in the preceding audit. This plan does not repeat it — it sequences the fixes.

## 2. Corrections from Original Audit

The user explicitly corrected the original plan:

1. **No obsolete aliases.** Do not add forwarding aliases (e.g.
   `--color-state-error: var(--color-state-danger)`). Migrate consumers directly to canonical
   tokens.
2. **No over-abstraction of raw values.** Sidebar-specific raw `rgb(0 0 0 / X%)` and sidebar
   white-text values are **local** to the sidebar. They do not need global tokens — keep them as-is
   or use local component tokens.
3. **Smaller, independently validatable PRs.** Each phase must be safe to merge and verify alone.
4. **Real rendering fixes first.** Broken intake styles (missing token references) are higher
   priority than "codebase hygiene."

## 3. Phased Implementation

### Phase 1 — Fix Broken Token Consumers

**Goal:** Replace every consumed-but-undefined token with its canonical equivalent. This fixes
actual rendering bugs (invisible text, missing backgrounds) in the intake views.

**Changes:**

| Broken token                     | Occurrences                                    | Canonical replacement                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--color-state-error-bg`         | 10 in `_intake.scss`, 1 in `_intake-form.scss` | `--color-state-danger-bg`                                                                                                                                                                                                                                                                                                                                                                  |
| `--color-state-error-border`     | 10 in `_intake.scss`, 1 in `_intake-form.scss` | `--color-state-danger-border`                                                                                                                                                                                                                                                                                                                                                              |
| `--color-state-error-text`       | 16 in `_intake.scss`, 2 in `_intake-form.scss` | `--color-state-danger-text`                                                                                                                                                                                                                                                                                                                                                                |
| `--color-text-inverse`           | 8 in `_intake.scss`, 2 in `_intake-form.scss`  | **Context-dependent.** 8 of 10 sit on `background: var(--color-action-accent)` (gold, light surface) → `--color-text-on-light`. 2 of 10 sit on `background: var(--color-state-error-text)` (crimson, dark surface) → `--color-text-on-dark`. See below for exact line mapping.                                                                                                             |
| `--color-bg-subtle`              | 11 in `_intake.scss`                           | `--color-surface-soft`                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-action-accent-contrast` | 4 in `_intake.scss` (used with fallback)       | All 4 sit on `background: var(--color-action-accent)` (gold, ~55% lightness). Gold is a light surface, so the readable foreground is dark. Replace with `--color-text-on-light` (coffee-900, very dark brown). The fallback `rgb(255 255 255)` is incorrect — white on gold fails WCAG AA (2.98:1). `--color-text-on-light` on gold passes AA (≈8:1). See audit for contrast calculations. |
| `--color-text` (bare)            | 2 in `_page-header.scss`                       | `--color-text-primary`                                                                                                                                                                                                                                                                                                                                                                     |

**`--color-text-inverse` detailed mapping (by file + line):**

| Location                                                            | Background                                                                         | Replacement             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| `_intake.scss:127` — `.intake-list__create-btn`                     | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake.scss:439` — `.confirm-modal__actions .btn-primary--danger` | `var(--color-state-error-text)` → `var(--color-state-danger-text)` (crimson, dark) | `--color-text-on-dark`  |
| `_intake.scss:524` — `.intake-detail__repair-link`                  | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake.scss:594` — `.intake-detail__generate-btn`                 | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake.scss:624` — `.intake-detail__review-link`                  | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake.scss:774` — `.intake-detail__generate-btn--danger`         | `var(--color-state-error-text)` → `var(--color-state-danger-text)` (crimson, dark) | `--color-text-on-dark`  |
| `_intake.scss:1192` — `.intake-review__btn--approve`                | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake.scss:3594` — `.icon-picker-field__nav-btn--active`         | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake-form.scss:56` — `.intake-form__btn--primary`               | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |
| `_intake-form.scss:473` — `.intake-summary__submit-btn`             | `var(--color-action-accent)` (gold)                                                | `--color-text-on-light` |

**Files:**

- `src/styles/dashboard/_intake.scss`
- `src/styles/dashboard/_page-header.scss`
- `src/styles/intake/_intake-form.scss`

**Risk:** Low. Pure search-and-replace. No structural changes. Both `_intake.scss` and
`_page-header.scss` only appear inside the dashboard context, so no cross-surface risk.

**Validation:**

```bash
# Confirm 0 occurrences remain
rg -g 'src/styles/**/*.scss' '--color-state-error' --count
rg -g 'src/styles/**/*.scss' '--color-text-inverse' --count
rg -g 'src/styles/**/*.scss' '--color-bg-subtle' --count
rg -g 'src/styles/dashboard/**/*.scss' '\b--color-text\b(?!-)' --count
rg -g 'src/styles/**/*.scss' '--color-action-accent-contrast' --count
pnpm build
```

Visual: Open intake list, intake detail, intake editor, submission review, create flow. Verify error
banners, status badges, and button labels render with correct colors.

**Completion:** Zero occurrences of all five broken token patterns. Build passes. Intake views
visually correct.

**Independent:** Yes.

---

### Phase 2 — Add Missing Foundational Tokens

**Goal:** Three missing tokens are needed for correct dashboard rendering and cannot be replaced by
an existing canonical token. Add them with light-mode defaults in the semantic layer. Do NOT add
forwarding aliases — these are real token gaps.

**Token 1: `--color-state-neutral-*` (bg, border, text, +rgb)**

- Currently defined ONLY in `_dashboard-dark.scss:115-119`.
- Consumed by `status-pill--neutral` in `_dashboard-guests-core.scss` and
  `dashboard-badge--generated` in `_tables.scss`.
- The dark preset values are visually intentional for dark mode (gray-olive `#9aa6a0`). They stay in
  the preset as overrides.
- But they must also exist in the semantic layer as light-mode defaults so the tokens are never
  undefined.
- Add to `tokens/semantic/_color.scss` with light-mode defaults using `sys.$sys-color-neutral-500`
  (medium gray) — a neutral-gray color for "no response / generated" status. Visually distinct
  enough from the other state colors. The dark preset overrides with its gray-olive as before.
- Decision: semantic default = neutral-500 gray; dark preset override = `#9aa6a0` gray-olive. Both
  are intentional and preserved.

**Token 2: `--dashboard-focus-ring` and `--dashboard-focus-glow`**

- Currently defined ONLY in `_dashboard-dark.scss:49-50`.
- Consumed in 13+ locations across `_forms.scss`, `_modals.scss`, `_guests.scss`,
  `_dashboard-guests-filters.scss`, `_dashboard-guests-actions.scss`,
  `_dashboard-guests-stats.scss`.
- Add to `dashboard/_common.scss` inside `.dashboard-shell-body` with light-mode defaults.

**Token 3: `--dashboard-z-modal-backdrop` and `--dashboard-z-modal`**

- Wait — these ARE defined in `_shell.scss:19-20`. Confirmed: `--dashboard-z-modal-backdrop: 70;`
  and `--dashboard-z-modal: 80;`. Skip.

**Files:**

- `src/styles/tokens/semantic/_color.scss` — add `--color-state-neutral-*` block
- `src/styles/themes/presets/_dashboard-dark.scss` — remove `--color-state-neutral-*` block
  (inherits from semantic)
- `src/styles/dashboard/_common.scss` — add `--dashboard-focus-ring` and `--dashboard-focus-glow`

**Risk:** Low. Additive changes. The dark preset overrides will still take precedence for dashboard
users.

**Validation:**

```bash
rg -g 'src/styles/**/*.scss' '--color-state-neutral' --count
# Previously only 7 matches in dashboard files; should now also find definition in semantic color
pnpm build
```

Visual: Open guest dashboard, verify neutral status pill renders with color. Open filters, verify
focus ring appears on field focus.

**Completion:** Semantic layer defines `--color-state-neutral-*`. Common dashboard defines
`--dashboard-focus-ring` with a fallback. Dark preset still overrides both. Focusable form fields
show focus ring on light-mode dashboard.

**Independent:** Yes, but depends on Phase 1 for build safety (so broken tokens don't interfere with
verification).

---

### Phase 3 — Documented Rules + Executable Checks

**Goal:** Create the agent rule file and a search script that can be run pre-commit or in CI to
catch violations.

**Files:**

- `.agent/dashboard-styling-rules.md` — new, see Section 4 for outline
- `scripts/check-dashboard-styles.sh` — new, POSIX-compatible (uses `rg` and basic shell)

**Changes:**

1. Write `.agent/dashboard-styling-rules.md` covering: token consumption rules, component grammar,
   state color matrix, focus rules, mobile rules, file responsibilities.
2. Write `scripts/check-dashboard-styles.sh` — a POSIX shell script using `rg` (ripgrep). Patterns:

   ```bash
   # Fail on undefined tokens in dashboard SCSS
   rg -q '--color-state-error' src/styles/dashboard/ && echo "FAIL: --color-state-error still present" && exit 1
   rg -q '--color-text-inverse' src/styles/ && echo "FAIL: --color-text-inverse still present" && exit 1
   rg -q '--color-bg-subtle' src/styles/ && echo "FAIL: --color-bg-subtle still present" && exit 1
   rg -q '--color-action-accent-contrast' src/styles/ && echo "FAIL: --color-action-accent-contrast still present" && exit 1

   # Fail on bare --color-text (not --color-text-primary, --color-text-secondary, etc.)
   # Use rg with word boundary on the property declaration
   rg -q '\b--color-text\b(?!-)' src/styles/dashboard/ && echo "FAIL: bare --color-text found" && exit 1

   # Warn on raw rgba() in dashboard SCSS
   count=$(rg -c 'rgba\(' src/styles/dashboard/ | awk -F: '{s+=$2}END{print s}')
   if [ "$count" -gt 0 ]; then echo "WARN: $count rgba() occurrences remain in dashboard SCSS"; fi

   echo "OK: no broken token patterns found"
   ```

   Note: The bare `--color-text` check uses `\b` word boundary + negative lookahead `(?!-)` which
   requires `-P` (PCRE). The script should use `rg -P` for that line, or use an alternative pattern
   like `rg ':.*--color-text[^-\w]'`.

**Risk:** None. Documentation + scripts only.

**Validation:**

```bash
bash scripts/check-dashboard-styles.sh
# Should exit 0 after Phase 1-2
```

**Completion:** Agent rules file exists. Check script exists and exits 0 on current codebase (after
phases 1-2).

**Independent:** Yes, though results are more useful after Phases 1-2 fix the violations it would
otherwise flag.

---

### Phase 4 — Normalize Surface Aliases + Focus States

**Goal:** Clean up dashboard alias definitions in `_common.scss` and standardize focus outline
patterns across components.

**Changes:**

**4a. Fix circular reference in `_common.scss:13`:**

```scss
--dashboard-surface-sidebar: var(--dashboard-surface-sidebar, var(--color-surface-dark));
```

→

```scss
--dashboard-surface-sidebar: var(--color-surface-dark);
```

**4b. Deduplicate overlapping shell aliases:** `_shell.scss:5-11` defines `--dashboard-shell-veil`,
`--dashboard-shell-panel`, `--dashboard-shell-elevated`, `--dashboard-shell-border-premium`,
`--dashboard-shadow-premium`, `--dashboard-shadow-emphasis`. These forward to dashboard aliases in
`_common.scss` (e.g. `--dashboard-shell-veil: var(--dashboard-overlay-bg)`). This is an unnecessary
indirection — replace inline consumers (only used inside `_shell.scss`) with the source alias
directly.

In practice, these shell aliases are only consumed within `_shell.scss` itself. Remove the shell
aliases and reference dashboard aliases directly: | Shell alias | Replace with | |---|---| |
`--dashboard-shell-veil` | `--dashboard-overlay-bg` | | `--dashboard-shell-panel` |
`--dashboard-panel-bg` | | `--dashboard-shell-elevated` | `--dashboard-card-bg-soft` | |
`--dashboard-shell-border-premium` | `--dashboard-card-border` | | `--dashboard-shadow-premium` |
`--shadow-warm` | | `--dashboard-shadow-emphasis` | `--shadow-warm-emphasis` |

**4c. Standardize focus patterns:** Three focus patterns exist. Consolidate to two:

- **Buttons/chips/interactive elements:**
  `outline: 2px solid var(--dashboard-focus-ring); outline-offset: 2px`
- **Form fields (inset appearance):**
  `box-shadow: 0 0 0 3px var(--dashboard-focus-ring), 0 0 12px var(--dashboard-focus-glow)`

Fix menu triggers (`_dashboard-guests-menu.scss:64-66`) and asset picker
(`_asset-library.scss:296-298`) that use `--color-action-accent` for focus outline → change to
`--dashboard-focus-ring`.

**Files:**

- `src/styles/dashboard/_common.scss`
- `src/styles/dashboard/_shell.scss`
- `src/styles/dashboard/_dashboard-guests-menu.scss`
- `src/styles/dashboard/_asset-library.scss`

**Risk:** Low-medium. Shell alias removals could affect consumers if any external component
references them. Need to check. The shell aliases appear to be consumed only within `_shell.scss`
(grep to confirm).

**Validation:**

```bash
# Confirm no external consumers of shell aliases
rg '--dashboard-shell-' --include '*.scss' --include '*.astro' --include '*.tsx'
# If only _shell.scss itself uses them, safe to remove.
pnpm build
```

Visual: Open sidebar, topbar, modal backdrop, focus on a form field, focus on a menu item.

**Completion:** No circular reference. No shell-to-common alias indirection. All focus outlines use
`--dashboard-focus-ring` not `--color-action-accent`.

**Independent:** Yes, after Phase 2 (which adds the focus-ring token definition).

---

### Phase 5 — Extract Guest Modal Styles

**Goal:** Move share-messages and send-invitation modal styles out of the 883-line `_guests.scss`
aggregator into dedicated partials. No design changes. Pure extraction.

**Changes:**

1. Create `src/styles/dashboard/_share-messages-modal.scss` — contains all
   `.dashboard-modal--share-templates` styles (currently ~300 lines in `_guests.scss`).
2. Create `src/styles/dashboard/_send-invitation-modal.scss` — contains all
   `.dashboard-modal--send-invitation` styles (currently ~300 lines in `_guests.scss`).
3. Update `src/styles/dashboard/_guests.scss` — `@use` the two new partials, remove the inline
   styles.
4. Verify no selectors are missed by running `rg` on the remaining surface area.

**Scope boundary:** Extract only. This phase does NOT change selectors, does NOT refactor modal
structure, does NOT touch `ModalShell`. The extracted CSS is a direct copy.

**Files:**

- `src/styles/dashboard/_share-messages-modal.scss` (new)
- `src/styles/dashboard/_send-invitation-modal.scss` (new)
- `src/styles/dashboard/_guests.scss`

**Risk:** Low. Pure extraction. The old selectors still work identically. Only `@use` statements
change.

**Validation:**

```bash
# Before and after diff — only the _guests.scss @use lines should differ
rg '^\s*\.dashboard-modal--(share-templates|send-invitation)' src/styles/dashboard/_guests.scss
# Should return 0 after extraction
pnpm build
```

Visual: Open share-messages modal, send-invitation modal on desktop and mobile. No visual
regressions.

**Completion:** `_guests.scss` is an aggregator + modal styles extracted to dedicated partials.
Build passes.

**Independent:** Yes.

---

### Phase 6 — Minimal ModalShell Contract (2-3 modals)

**Goal:** Add a `variant` prop to `ModalShell` and a footer slot. Apply to GuestFormModal,
SendInvitationModal, and GuestDeleteConfirmModal. Do not force all modals to adopt it.

**Distinction of modal size vs fullscreen behavior:**

- `size` controls the modal **width** on desktop: `'sm' | 'md' | 'lg'` → maps to
  `.dashboard-modal--sm / --lg` modifier classes. Sm = ~440px (confirm modal), md = ~600px
  (default), lg = ~850px (full-width editor modal).
- `fullscreenOnMobile?: boolean` controls whether the modal goes full-screen on small viewports.
  Default `true` (existing behavior). Modal variants that should NOT go fullscreen on mobile (rare)
  can set `false`.
- These are independent axes. A small confirm modal IS fullscreen on mobile by default. No overlap.

**Changes:**

1. **ModalShell.tsx** — add optional props:
   - `variant?: 'default' | 'confirm'` — maps to `dashboard-modal--confirm` class
   - `footer?: React.ReactNode` — renders inside `.dashboard-modal__footer`
   - `size?: 'sm' | 'md' | 'lg'` — maps to `.dashboard-modal--sm`, `.dashboard-modal--lg` modifier
     classes. Default (`md`) maps to existing `width: min(600px, 95vw)`
   - `fullscreenOnMobile?: boolean` — default `true`. Controls whether
     `.dashboard-modal--fullscreen` modifier is added on mobile.

2. **Shared modal SCSS** — keep existing classes. No redesign. The `--confirm` variant already
   works. The `--full` variant already works. Just wire them up through props.

3. **Migrate 3 modals:**
   - `GuestDeleteConfirmModal.tsx` — passes `variant="confirm"`, `footer` with the danger CTA
   - `GuestFormModal.tsx` — passes `footer` with Save/Cancel buttons
   - `SendInvitationModal.tsx` — passes `footer` with the send CTA + secondary actions

4. All other modals continue using ModalShell without footer/variant props (backward compatible).

**Files:**

- `src/components/dashboard/ModalShell.tsx`
- `src/components/dashboard/guests/GuestDeleteConfirmModal.tsx`
- `src/components/dashboard/guests/GuestFormModal.tsx`
- `src/components/dashboard/guests/SendInvitationModal.tsx`
- Potentially `src/styles/dashboard/_modals.scss` — minor additions if needed

**Risk:** Low-medium. Adding props to ModalShell is backward compatible. Only 3 modals change. The
footer slot replaces locally-built footers, so DOM structure will shift — needs careful check.

**Validation:**

```bash
pnpm build
pnpm type-check
```

Visual: Open GuestFormModal, GuestDeleteConfirmModal, SendInvitationModal on desktop + mobile
(375px). Verify footer renders correctly, sticky behavior on mobile.

**Completion:** ModalShell accepts variant/footer/size props. 3 modals use the new contract. All
other modals unchanged. Build passes.

**Independent:** Yes, after Phase 5 (extraction makes modal boundaries clearer).

---

### Phase 7 — Consolidate Chips, Badges, Buttons

**Goal:** Define shared base classes for repeated patterns and migrate the most obvious duplicates.

**Do NOT** refactor all 7 chip variants at once. Pick the ones that are visually identical but
differently named:

**Priority targets:**

1. `guest-tag` (`_dashboard-guests-elements.scss`) and `guest-review__chip`
   (`_dashboard-guests-stats.scss`) — both are border-only pills with 999px radius, almost
   identical.
2. `import-magic__summary-chip` (`_dashboard-guests-import.scss`) — a status-colored chip with 6px
   radius. Distinct enough to keep separate, but should use shared status color mix.
3. `dashboard-badge` (`_tables.scss`), `import-magic__badge` (`_dashboard-guests-import.scss`),
   `guest-summary__badge` (`_dashboard-guests-stats.scss`) — different radii but all status-colored
   pills. Define a `.dashboard-badge` base with status modifiers in `_tables.scss` (already has
   them), then migrate the other two to use the same modifiers.

**Changes:**

1. Add `.dashboard-chip` base class to `_common.scss` or new `_chips.scss`.
2. Add status modifier pattern to `_tables.scss` `.dashboard-badge`.
3. Migrate `guest-tag` and `guest-review__chip` to extend `.dashboard-chip`.
4. Migrate `import-magic__badge` and `guest-summary__badge` to use `.dashboard-badge` with status
   modifiers.

**Files:**

- `src/styles/dashboard/_common.scss` (or `_chips.scss` new)
- `src/styles/dashboard/_tables.scss`
- `src/styles/dashboard/_dashboard-guests-elements.scss`
- `src/styles/dashboard/_dashboard-guests-stats.scss`
- `src/styles/dashboard/_dashboard-guests-import.scss`

**Risk:** Medium. CSS specificity can shift when migrating from a flat class to a base + modifier
pattern.

**Validation:**

```bash
pnpm build
```

Visual: Scan all guest tag instances, review chips, summary chips, badges. Verify colors and spacing
are preserved.

**Completion:** `.dashboard-chip` base class exists. `.dashboard-badge` has explicit status
modifiers. 2-3 duplicate patterns consolidated. All others unchanged.

**Independent:** Yes, after Phase 3 (rules document guides the naming convention).

---

### Phase 8 — Standardize Mobile Breakpoints

**Goal:** Replace raw `@media (width <= Npx)` with `respond-below()` mixin in dashboard SCSS files
where the breakpoint maps exactly. Progressive — one file at a time.

**Breakpoint map (from `src/styles/tokens/_spacing.scss:5-11`):**

| Token | Value    | Mixin                            |
| ----- | -------- | -------------------------------- |
| `xs`  | `480px`  | `respond-below(xs)` → max 479px  |
| `sm`  | `640px`  | `respond-below(sm)` → max 639px  |
| `md`  | `768px`  | `respond-below(md)` → max 767px  |
| `lg`  | `992px`  | `respond-below(lg)` → max 991px  |
| `xl`  | `1200px` | `respond-below(xl)` → max 1199px |

**Exact mappings from raw queries to mixins (only these are replaced):** | Raw `@media` | Mixin
equivalent | Exact match? | |---|---|---| | `width <= 480px` | `respond-below(xs)` | **Exact** —
480px = xs | | `width <= 640px` | `respond-below(sm)` | **Exact** — 640px = sm | | `width <= 768px`
| `respond-below(md)` | **Exact** — 768px = md | | `width <= 992px` | `respond-below(lg)` |
**Exact** — 992px = lg | | `width >= 992px` | `respond-to(lg)` | **Exact** — 992px = lg |

**Not replaced (no exact match, intentional distinct values):** | Raw `@media` | Reason to keep raw
| |---|---| | `width <= 576px` | No exact mixin match (xs=480, sm=640). Layout is specifically
designed for 576px threshold. | | `width <= 600px` | No exact mixin match. Asset library layout
breakpoint. Custom value is intentional. | | `width >= 600px` and `width <= 1199px` | Two-sided
range specific to guest cards grid. Not expressible as a single mixin. | | `width >= 768px` | Used
for filter show/hide — maps to `respond-to(md)`, replaceable. | | `width <= 480px` | Maps to
`respond-below(xs)` — replaceable. |

**Priority order (files with replaceable queries only):**

1. `_dashboard-guests-header.scss` — 2 queries (480px, 768px) → both replaceable
2. `_dashboard-guests-cards.scss` — 2 queries (480px, 600px-1199px) → 480px replaceable, 600px range
   stays raw
3. `_dashboard-guests-filters.scss` — 3 queries (480px, 576px, >=768px) → 480px and >=768px
   replaceable, 576px stays raw
4. `_dashboard-guests-stats.scss` — 4 queries (480px, 768px) → both replaceable
5. `_dashboard-guests-actions.scss` — 3 queries (480px) → replaceable
6. `_dashboard-guests-import.scss` — 5 queries (640px, 768px, 480px) → all 3 replaceable
7. `_dashboard-guests-mobile-dock.scss` — 1 query (992px) → replaceable
8. `_toast.scss` — 1 query (992px) → replaceable
9. `_guests.scss` — 4 queries (sm mixin, 480px) → check after Phase 5
10. `_shell.scss` — 1 query (992px) → replaceable

**Risk:** Low. Only exact-mapped breakpoints are changed. All others stay raw. Each file is a
separate PR.

**Files:** As listed above.

**Validation:**

```bash
pnpm build
```

Visual: Check at 375px, 480px, 640px, 768px, 992px breakpoints.

**Completion:** All exact-mapped raw queries replaced. Non-matching queries (576px, 600px) remain
raw with a comment noting they are intentional non-mixin breakpoints where applicable. Build passes.

**Independent:** Yes. Each file can be a separate PR.

---

### Phase 9 — Split \_intake.scss (Mechanical Refactor)

**Goal:** Break 3690-line file into focused partials with no visual changes.

**Split targets:**

| New partial               | Lines                                        | Content                                                             |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `_intake-list.scss`       | ~390 (1-390)                                 | `.intake-list`, search, toolbar, table, tabs, skeleton, empty state |
| `_intake-detail.scss`     | ~220 (391-610)                               | `.intake-detail`, header, meta, badges, repair, submission          |
| `_intake-rsvp-panel.scss` | ~160 (669-828)                               | `.rsvp-panel`, badges, counts, codes, actions                       |
| `_intake-review.scss`     | ~510 (1007-1517, plus later review sections) | `.intake-review`, field list, venue, gifts, actions, buttons        |
| `_intake-editor.scss`     | ~2170 (1474-3644)                            | `.invitation-editor`, layout, nav, cards, fields, preview, publish  |
| `_intake-create.scss`     | ~130 (1405-1534)                             | `.create-flow`, form, actions                                       |
| `_intake-overflow.scss`   | ~80 (290-367)                                | `.intake-overflow`, menu, items                                     |
| `_intake-demoblocks.scss` | ~130 (782-900)                               | `.demo-selector`, `.block-selector`                                 |
| `_intake-link-panel.scss` | ~110 (902-1005)                              | `.intake-link-panel`, status, link, wa-btn                          |
| Remainder                 | ~310                                         | Confirm modal, draft section, etc. — distributed                    |

**Process:**

1. Create each partial, copying the exact CSS from `_intake.scss`.
2. Update `_intake.scss` to `@use` each new partial.
3. Remove the moved CSS from `_intake.scss`.
4. Update `dashboard.scss` if it directly imports `_intake.scss` (it does:
   `@use 'dashboard/intake';`). Since `_intake.scss` will still exist as an aggregator, no change
   needed to `dashboard.scss`.

**Risk:** Low. Pure extraction. No selectors changed. Verifiable by `git diff --word-diff` showing
no content changes in CSS properties.

**Validation:**

```bash
pnpm build
```

Visual: Open every intake view — list, detail, editor, review, create flow, RSVP panel. No visual
changes.

**Completion:** `_intake.scss` < 400 lines (aggregator only). 8-10 new partials. Build passes. No
visual changes.

**Independent:** Yes, but best done last to avoid merge conflicts with earlier phases that also
touch intake.

---

## 4. Proposed Agent Rules File

**File:** `.agent/dashboard-styling-rules.md`

Outline:

```markdown
---
description: Enforceable styling rules for dashboard SCSS.
domain: frontend
version: 1.0.0
---

# Dashboard Styling Rules

## Token Consumption

- Only `var(--color-*)`, `var(--dashboard-*)`, `var(--shadow-*)`, `var(--spacing-*)`,
  `var(--font-*)` in component SCSS.
- Alpha compositions: `rgb(var(--color-X-rgb) / Y%)`. Never `rgba()`.
- Use `--color-state-danger-*`. Never `--color-state-error-*` (does not exist).
- Use `--color-text-on-dark` for text on dark surfaces. Never `--color-text-inverse` (does not
  exist).
- Use `--color-surface-soft` for subtle backgrounds. Never `--color-bg-subtle` (does not exist).

## Focus States

- `--dashboard-focus-ring` for all focus outlines. Never `--color-action-accent`.
- Form fields (inset): `box-shadow`. Interactive elements: `outline`.
- Interactive elements need `outline-offset: 2px` minimum.

## Surface Aliases

- `_common.scss` owns dashboard-level aliases.
- Shell aliases in `_shell.scss` are scoped to shell content only.
- No circular references (`var(--X, var(--X))` or `var(--X, var(--Y))` where X and Y converge).

## Modal Contract (after Phase 6)

- ModalShell owns backdrop, header, content, footer.
- Per-modal overrides go in dedicated partials (`_*-modal.scss`).
- Mobile full-screen: use `.dashboard-modal--fullscreen`.

## Component Patterns

- Chips: extend `.dashboard-chip`.
- Badges: extend `.dashboard-badge` with status modifier classes.
- Buttons: use `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-icon`, `.btn-ghost`.
- New chip/tag/badge styles require shared base class.

## Semantic States

| State   | Token prefix              | When to use                             |
| ------- | ------------------------- | --------------------------------------- |
| Success | `--color-state-success-*` | Confirmed, delivered, active, sent      |
| Warning | `--color-state-warning-*` | Pending attention, unshared, reminder   |
| Danger  | `--color-state-danger-*`  | Declined, error, delete, archived (bad) |
| Info    | `--color-state-info-*`    | Sent, viewed, informational             |
| Neutral | `--color-state-neutral-*` | No response, generated, draft           |

## Mobile

- Use `respond-below()` mixin, not raw `@media (width <= Npx)` when N matches a defined breakpoint.
- Dock clearance: `var(--dashboard-dock-height, 76px)` + spacer.
- Footer sticky: `calc(Xrem + env(safe-area-inset-bottom))`.
- min-height: `44px` for interactive elements.

## File Responsibilities

| Path                                | Responsibility                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `dashboard/_common.scss`            | Dashboard aliases, `.dashboard-card`, `.dashboard-status`, `.dashboard-error`, shared component base classes |
| `dashboard/_shell.scss`             | Grid, sidebar, topbar, mobile drawer, backdrop, z-index, account section                                     |
| `dashboard/_modals.scss`            | Modal backdrop, frame, header, content, footer, close, variants                                              |
| `dashboard/_dashboard-buttons.scss` | Button classes                                                                                               |
| `dashboard/_forms.scss`             | Form grid, fields, actions                                                                                   |
| `dashboard/_guests.scss`            | Aggregator only (or reduced)                                                                                 |
| `dashboard/_tables.scss`            | Table, badge, event chips                                                                                    |
| `dashboard/_intake.scss`            | Aggregator only                                                                                              |
```

## 5. Validation Strategy

**Per-phase:** Build + visual check of affected views.

**Final sweep (after Phase 9):**

```bash
# Check for remaining raw color hex in dashboard SCSS
rg -g 'src/styles/dashboard/*.scss' '#[0-9a-fA-F]{6,8}' --count

# Check for remaining undefined tokens
rg -g 'src/styles/**/*.scss' '--color-state-error' --count
rg -g 'src/styles/**/*.scss' '--color-text-inverse' --count
rg -g 'src/styles/**/*.scss' '--color-bg-subtle' --count
rg -g 'src/styles/dashboard/**/*.scss' '\b--color-text\b(?!-)' --count

# Check for focus token violations
rg -g 'src/styles/dashboard/**/*.scss' 'outline:.*var\(--color-action-accent\)' --count

# Run build
pnpm build
```

**Visual verification grid:**

| View                  | Check                                 | Desktop | Mobile |
| --------------------- | ------------------------------------- | ------- | ------ |
| Guest list (table)    | Status pills, badges, focus fields    | 1440px  | 375px  |
| Guest list (cards)    | Cards, tags, expanded panel           | 1440px  | 375px  |
| Guest filters         | Search, selects, advanced toggle      | 1440px  | 375px  |
| Mobile dock           | Icons, labels, CTA button             | N/A     | 375px  |
| Share messages modal  | Tabs, editor, preview, footer sticky  | 600px   | 375px  |
| Send invitation modal | Form, companion pills, footer sticky  | 600px   | 375px  |
| Guest form modal      | Fields, phone input, footer           | 600px   | 375px  |
| Delete confirm modal  | Compact, centered, danger CTA         | 440px   | 375px  |
| Intake list           | Table, tabs, search, loading skeleton | 1200px  | 375px  |
| Intake detail         | Sections, badges, RSVP panel          | 900px   | 375px  |
| Intake editor         | 3-column layout, nav sticky, cards    | 1440px  | 375px  |
| Intake review         | Field list, approve/changes buttons   | 900px   | 375px  |
| Sidebar               | Expanded, collapsed, mobile drawer    | 1440px  | 375px  |
| Toast                 | Positioning, close, above dock        | 1440px  | 375px  |

## 6. Dependency Graph

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
                                      │                       │
                                      │                       │
                                      └───► Phase 7 ──────────┤
                                                            │
                                      Phase 8 ◄─────────────┘
                                      │
                                      └───► Phase 9 (independent, last)
```

- Phase 3 (documentation) can start in parallel with Phase 1.
- Phase 7 needs Phase 4 (surface normalization) for shared base classes.
- Phase 6 needs Phase 5 (modal extraction).
- Phase 8 can proceed independently, file by file.
- Phase 9 is last to avoid merge conflicts with earlier phases that mod `_intake.scss`.
