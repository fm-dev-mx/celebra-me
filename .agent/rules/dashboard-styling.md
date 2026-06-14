---
description: Enforceable styling rules for dashboard SCSS.
domain: frontend
version: 1.1.0
---

# Dashboard Styling Rules

## Token Consumption

- Only `var(--color-*)`, `var(--dashboard-*)`, `var(--shadow-*)`, `var(--spacing-*)`,
  `var(--font-*)` in component SCSS.
- Alpha compositions: `rgb(var(--color-X-rgb) / Y%)`. Never `rgba()`.
- Use `--color-state-danger-*`. Never `--color-state-error-*` (does not exist).
- Use `--color-text-on-dark` for text on dark surfaces. Never `--color-text-inverse` (does not
  exist).
- Use `--color-text-on-light` for text on light/gold/accent backgrounds. Never
  `--color-action-accent-contrast` (does not exist).
- Use `--color-surface-soft` for subtle backgrounds. Never `--color-bg-subtle` (does not exist).
- Use `--color-text-primary` for primary text. Never bare `--color-text` (does not exist).

## Focus States

- `--dashboard-focus-ring` for all focus outlines. Never `--color-action-accent`.
- Form fields (inset focus):
  `box-shadow: 0 0 0 3px var(--dashboard-focus-ring), 0 0 12px var(--dashboard-focus-glow)`.
- Buttons/chips/interactive elements:
  `outline: 2px solid var(--dashboard-focus-ring); outline-offset: 2px`.
- `--dashboard-focus-ring` and `--dashboard-focus-glow` defined in `_common.scss` with light-mode
  defaults, overridden by theme preset.

## Surface Aliases

- `_common.scss` owns dashboard-level aliases (`--dashboard-*`).
- No circular references. No unused shell aliases.
- Sidebar-specific raw `rgb(0 0 0 / X%)` and `rgb(255 255 255 / X%)` values are kept as local
  component tokens (sidebar is a dark-mode island).

## ModalShell Contract

```tsx
interface ModalShellProps {
  title: string;
  subtitle?: React.ReactNode;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'confirm'; // --confirm modifier
  size?: 'sm' | 'md' | 'lg'; // lg → dashboard-modal--full
  fullscreenOnMobile?: boolean; // default: true, false → dashboard-modal--not-fullscreen
  footer?: React.ReactNode; // rendered in .dashboard-modal__footer
}
```

- `variant="confirm"`: compact centered modal with compact footer (e.g. GuestDeleteConfirmModal).
- `size="lg"`: wider modal for complex forms (e.g. GuestFormModal).
- `fullscreenOnMobile={false}`: prevents mobile full-screen behavior.
- `footer`: renders after children in `.dashboard-modal__footer`. Sticky on mobile.
- All props are optional and backward compatible. Existing consumers unchanged.

## Component Patterns

- Chips/tags: extend `%pill-base` placeholder (inline-flex, align-items, border-radius: 999px)
  defined in `_common.scss`.
- Badges: use `.dashboard-badge` with status modifier classes in `_tables.scss`.
- Buttons: use `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-icon`, `.btn-ghost`.
- New chip/tag/badge styles require shared base class or placeholder.

## Semantic States

| State   | Token prefix              | When to use                             |
| ------- | ------------------------- | --------------------------------------- |
| Success | `--color-state-success-*` | Confirmed, delivered, active, sent      |
| Warning | `--color-state-warning-*` | Pending attention, unshared, reminder   |
| Danger  | `--color-state-danger-*`  | Declined, error, delete, archived (bad) |
| Info    | `--color-state-info-*`    | Sent, viewed, informational             |
| Neutral | `--color-state-neutral-*` | No response, generated, draft, archived |

Gold (`--color-action-accent`) is NOT a state token. It is reserved for CTAs and interactive accents
only.

## Mobile Breakpoints

Use `respond-below()` mixin when the value matches a defined breakpoint exactly:

| Raw value | Mixin               | Defined as |
| --------- | ------------------- | ---------- |
| `480px`   | `respond-below(xs)` | xs = 480px |
| `640px`   | `respond-below(sm)` | sm = 640px |
| `768px`   | `respond-below(md)` | md = 768px |
| `992px`   | `respond-below(lg)` | lg = 992px |

For `>=` breakpoints, use `respond-to()` with the same matching rules.

**Allowed raw breakpoint exceptions** (no exact mixin match, intentionally specific):

- `360px` — smallest phone viewport for draft editor fields
- `520px` — create-flow row stacking and editor header reflow
- `576px` — filter bar collapse and header layout in guest dashboard
- `600px` — asset library grid, intake list table, import magic responsive
- `700px` — intake list header column layout, overflow menu fixed position
- `860px` — editor 3-column to single-column layout switch
- `1100px` — editor preview pane hide

- Dock clearance: `calc(var(--dashboard-dock-height, 76px) + var(--spacing-md))`.
- Sticky footer: `calc(Xrem + env(safe-area-inset-bottom))`.
- Touch targets: `min-height: 44px` for interactive elements.

## File Responsibilities

| Path                                    | Responsibility                                                     |
| --------------------------------------- | ------------------------------------------------------------------ |
| `dashboard/_common.scss`                | Dashboard aliases, card, status, error, `%pill-base`               |
| `dashboard/_shell.scss`                 | Grid, sidebar, topbar, mobile drawer, backdrop, z-index            |
| `dashboard/_modals.scss`                | Modal backdrop, frame, header, content, footer, `--not-fullscreen` |
| `dashboard/_dashboard-buttons.scss`     | Button classes (btn-primary, btn-secondary, etc.)                  |
| `dashboard/_forms.scss`                 | Form grid, fields, actions                                         |
| `dashboard/_tables.scss`                | Table, `.dashboard-badge` with status modifiers                    |
| `dashboard/_guests.scss`                | Aggregator only (17 lines, all @use)                               |
| `dashboard/_share-messages-modal.scss`  | Share messages modal styles (extracted)                            |
| `dashboard/_send-invitation-modal.scss` | Send invitation modal styles (extracted)                           |
| `dashboard/_toast.scss`                 | Toast notification                                                 |
| `dashboard/_intake.scss`                | Aggregator + intake detail, review, panels, create flow            |
| `dashboard/_intake-list.scss`           | Intake list view (table, search, overflow menu)                    |
| `dashboard/_intake-editor.scss`         | Invitation editor (3-column editor, preview, focal)                |
| `dashboard/_page-header.scss`           | Dashboard page header                                              |
| `dashboard/_empty-state.scss`           | Dashboard empty state                                              |
| `dashboard/_asset-library.scss`         | Asset library and picker (not a modal)                             |
| `dashboard/_*.scss` (guests)            | Individual guest dashboard partials                                |

## Pre-commit Validation

Run before merging any dashboard SCSS changes:

```bash
node scripts/check-dashboard-styles.mjs
pnpm build
```

The check script requires `rg` (ripgrep) on `PATH`. It checks for prohibited token patterns:

- `--color-state-error` → use `--color-state-danger`
- `--color-text-inverse` → use `--color-text-on-dark` or `--color-text-on-light`
- `--color-bg-subtle` → use `--color-surface-soft`
- `--color-action-accent-contrast` → use `--color-text-on-light`
- Bare `--color-text` without suffix → use `--color-text-primary`

Additional manual checks:

```bash
rg -- 'outline:.*var\(--color-action-accent\)' src/styles/dashboard  # should be 0
```

Exit 0 = clean. Exit 1 = violations found. CI should fail on exit 1.
