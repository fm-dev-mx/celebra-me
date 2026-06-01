---
title: Invitation Dashboard Premium UX Plan
status: active
created: 2026-05-31
updated: 2026-05-31
supersedes:
  - admin-workflow-improvement.md
  - dashboard-creation-flow-plan.md
related_skills:
  - frontend-design
  - astro-patterns
  - testing
related_docs:
  - docs/core/project-conventions.md
  - docs/core/architecture.md
---

# Invitation Dashboard Premium UX Plan

## 1. Purpose

Raise the admin invitation dashboard (`/dashboard/invitaciones`) and editor from a functional
internal tool to a polished production-grade experience without breaking existing public routes,
RSVP behavior, or deployment safety.

This plan supersedes and replaces `admin-workflow-improvement.md` and
`dashboard-creation-flow-plan.md` — both are now merged into this unified plan. If any existing
phase from those plans is partially implemented, this plan accounts for it and should replace the
prior instruction.

## 2. Current-State Findings

### 2.1 Invitation list (`src/components/dashboard/intake/InvitationList.tsx`)

- Uses an HTML `<table>` with 6 columns: Invitación, Cliente, Tipo, Estado, Actualizado, Acciones.
- Filter tabs (10 tabs) rendered as pills above the table using server-side filtering on the client
  (full list loaded, then JavaScript-filtered).
- Row actions vertically stacked in `flex-direction: column` under the actions column:
  - Editar (primary button, gold/accent background)
  - Ver pública (text link)
  - Duplicar (text link, demos only) or Copiar link / Link cliente (text link, clients)
  - Archivar / Restaurar / Eliminar definitivamente (text, danger/warning styling)
- Actions use a `<hr>`-style separator between edit/view/duplicate and lifecycle actions.
- `InvitationLifecycleActions` component renders either "Archivar" (if not archived) or
  "Restaurar" + "Eliminar definitivamente" (if archived).
- Demo rows use `opacity: 85%` with an inline `::after` pseudo-element "Demo" badge.
- Content summary is a separate `<span>` below the status badge: "Publicado", "Captura recibida",
  "Esperando captura", "Sin contenido".
- Status warnings (inconsistencies) appear as additional text below.
- Inline creation form toggled by a button; uses `window.prompt()` for duplicate, `window.confirm()`
  for delete.
- No search input, no summary metrics, no bulk actions.
- Empty state shows static "No hay invitaciones en esta vista." via `EmptyState` component.

### 2.2 Invitation detail (`src/components/dashboard/intake/InvitationDetail.tsx`)

- Loads invitation, request, submission, RSVP event, draft data.
- Shows: title, status badge, event type, demo preset name.
- Shows inconsistency repair banner when applicable.
- Client section: name, WhatsApp, email, photos toggle.
- Submission/capture link section with BlockSelector.
- RSVP panel with counts (confirmed, declined, pending) and claim codes.
- Draft section with status and actions.
- Uses stacked sections with section cards.

### 2.3 Editor (`src/components/dashboard/intake/editor/InvitationEditor.tsx`)

- Single-page form with sidebar navigation (13 items) and sticky header.
- Each section is a `SectionCard` with its own "Guardar sección" button and status feedback.
- Dirty tracking per-section via `Set<string>`.
- Section-level source badges (Borrador / Versión pública / Demo / Vacío).
- IntersectionObserver-based active section tracking.
- `beforeunload` handler on unsaved changes.
- Publish button disabled when dirty sections exist.
- Preview link navigates to `/dashboard/invitaciones/[id]/preview`.
- No saving state beyond per-section — no global "unsaved changes" indicator.
- No validation errors shown inline — only on save.

### 2.4 Preview (`src/pages/dashboard/invitaciones/[id]/preview.astro`)

- SSR page that renders the full invitation layout.
- **Fails with error if no draft exists** ("No se ha encontrado un borrador para esta invitación.
  Genera un borrador primero.").
- If no preview slug: "La plantilla base de esta invitación no está soportada."
- If demo content empty: "No se encontró el contenido de la plantilla base."
- Preview banner: bright red (`#e53e3e`) with text "Vista previa interna — no publicada".
- No source selection (always uses draft content only).

### 2.5 Status & display system (`src/lib/intake/display-status.ts`, `types.ts`, `src/components/dashboard/StatusBadge.tsx`)

- 9 invitation statuses in `INVITATION_STATUSES`.
- `StatusBadgeVariant` enum of 12 values mapped to CSS classes.
- `resolveDisplayInfo()` returns `{ label, variant, warning }` from `InvitationDTO`.
- 3 `INCONSISTENCY_RULES` detect: published without content, published without RSVP event, content
  exists without published status.
- `resolvePrimaryAction()` returns contextual action for each status.
- Status badge + content summary + warning text all rendered separately in the table row, creating
  visual noise.
- Type column shows "Invitación" vs "Demo" as separate column.

### 2.6 Styles (`src/styles/dashboard/_intake.scss`)

- Monolithic 1860-line SCSS file covering list, detail, and editor.
- No component-level SCSS splitting.
- Shared button classes exist (`btn-primary`, `btn-secondary`, `btn-accent`) but editor and list
  define their own button styles.
- Editor card styles repeated inline.

### 2.7 Existing tests

- `tests/components/InvitationList.test.tsx` — 1 test for edit link stability.
- `tests/components/InvitationEditor.test.tsx` — exists but not reviewed.
- `tests/unit/display-status.test.ts` — 315 lines, comprehensive coverage of resolveDisplayInfo,
  resolvePrimaryAction, inconsistency rules.
- `tests/components/DraftEditor.test.tsx`, `DraftReview.test.tsx`, `SubmissionReview.test.tsx` —
  exist.
- `tests/api/dashboard.intake.edit.test.ts` — API integration tests.

## 3. Identified UX/Product Problems

1. **Row action density** — Vertically stacked 5+ actions per row make the table hard to scan;
   critical actions (Edit) compete with secondary actions (Archive, Duplicate).
2. **Status noise** — Badge + content summary + warning text + type column all compete; info is
   scattered across multiple elements.
3. **Inline creation form** — Disrupts the list layout; feels low-end compared to dedicated route or
   modal.
4. **Preview dead state** — Default "no draft" error is unhelpful when published content exists or
   when draft can be auto-initialized.
5. **Red preview banner** — Error-color banner creates false alarm; should be a neutral internal
   indicator.
6. **Editor per-section saves** — Each section has its own "Guardar sección" button; results in
   repetitive UI and unclear global save state. No global unsaved indicator (dirty sections tracked
   but only shown per-section).
7. **Gold overuse** — Same accent color used for create, save, publish, edit, and secondary actions
   dilutes hierarchy.
8. **No search** — No way to filter by title, client name, or other text fields.
9. **No summary metrics** — No count of total, published, draft, archived at the top.
10. **No skeleton/loading state** — Just "Cargando..." text.
11. **Weak delete confirmation** — `window.confirm()` pattern; no modal with clear consequences.
12. **Duplicate uses `window.prompt()`** — No rich UI for setting duplicate title with defaults.
13. **No row clickability** — Title is not clickable; must find the Edit action.
14. **`scss` file at 1860 lines** — No modularity; list, detail, and editor all in one file.
15. **Editor sidebar doesn't hint at validation issues** — No per-section validation indicator
    before save.

## 4. Technical Risks and Constraints

- **No React-heavy additions** — Must work within Astro islands pattern; avoid complex client state
  management.
- **No Tailwind** — Enforced by `.agent/GATEKEEPER_RULES.md`.
- **No autosave** — Current architecture uses explicit save with optimistic concurrency control
  (`expectedUpdatedAt`). Do not introduce autosave without evaluating conflict patterns first.
- **Public routes must not change** — `/[eventType]/[slug]` and preview must continue working.
- **RSVP behavior must not break** — Publishing, invitation resolution, and guest management flows
  are untouchable.
- **Demo/public resolution must not change** — Demo entry point and published content resolution
  logic is stable.
- **No database migrations** — All status/display changes must derive from existing fields.
- **Server/client boundary** — API routes are the server entry point; React islands call APIs, not
  server modules directly.
- **Monolithic SCSS is risky to split** — Splitting `_intake.scss` (1860 lines) must be one phase
  with no functional changes.
- **Vercel/Linux casing** — File paths must be consistent.
- **Existing plans being superseded** — Ensure no conflict with partially implemented phases from
  `admin-workflow-improvement.md` or `dashboard-creation-flow-plan.md`.

## 5. Recommended Implementation Phases

### Phase 1 — Critical UX corrections (estimated: 8–12 files)

**Goal**: Fix the most damaging UX issues without architectural changes.

#### 1a. Replace vertical row actions with action hierarchy

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Replace the vertically stacked action column with an inline action group:
  - Primary action button: "Editar" (always first, solid accent style)
  - Secondary action: "Vista" (text+icon, shown if published)
  - Overflow menu button `[•••]` containing: Duplicar (demos only), Copiar enlace público (if
    published), Copiar enlace de captura (if client with capture link), Archivar/Restaurar, Eliminar
    permanentemente (if archived, with confirmation)
- Remove `InvitationLifecycleActions` inline component.
- Remove the `<hr>` separator.
- Add an overflow menu React component (simple dropdown, not a library).
- Keep the row as `<tr>` but restructure the actions `<td>`.

**Design**:

```txt
[Editar]  [Vista]  [•••]
```

Menu:

```txt
Duplicar
Copiar enlace público
Copiar enlace de captura
──────────
Archivar
Eliminar permanentemente
```

#### 1b. Consolidate status display into compact semantic badges

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/components/dashboard/StatusBadge.tsx`
- `src/styles/dashboard/_tables.scss`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Merge type ("Invitación"/"Demo") + status badge + content summary + warning into a single compact
  area per row.
- Remove the `contentSummary()` function; move content source info into the badge or as a dot
  indicator.
- Demo rows: move the "Demo" pseudo-element into a proper badge within the status area instead of
  the `::after` hack.
- Remove the separate "Tipo" column (absorb into status area).
- Add a `StatusBadge` variant for "demo" type distinction.
- The inconsistency warning stays but as a more compact tooltip-style indicator (e.g., warning
  icon + short text, not full paragraph).

**Design**:

```txt
| Invitación            | Estado                    | Actualizado |
| Quinceañera Sofía     | ● Publicada               | 30/05/2026  |
| Boda Ana & Carlos     | ● Borrador ⚠ sin slug    | 28/05/2026  |
| Demo XV Clásico       | ● Demo · Publicada        | 25/05/2026  |
```

#### 1c. Replace inline creation form with dedicated route

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/pages/dashboard/invitaciones/nueva.astro` (new file)
- `src/components/dashboard/intake/CreateInvitationFlow.tsx` (new file)
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Remove the inline form from `InvitationList.tsx` (the `showForm` toggle and `handleCreate`).
- Replace the "Crear invitación" button with a link to `/dashboard/invitaciones/nueva`.
- Create `nueva.astro`:
  - Loads `DashboardLayout`.
  - Contains a `CreateInvitationFlow` React island that renders a compact create screen.
- Create `CreateInvitationFlow.tsx`:
  - Fields: Título (required), Cliente (name), WhatsApp, Correo, Tipo de evento (required), Demo
    base selector (required).
  - On submit: calls `adminApi.createInvitation()`, then
    `window.location.href = '/dashboard/invitaciones/${id}/editar'`.
  - After successful creation, system auto-initializes draft content from the demo preset (already
    done server-side by `duplicateInvitationFromDemo` or by `createInvitation`, but need to verify
    draft is created).
- Add a back link to return to list.

**Why not a modal**: A dedicated route is simpler, bookmarkable, doesn't conflict with list loading
state, and allows the user to navigate away without losing form state. A modal could be added later.

#### 1d. Fix preview empty/dead state

**Files**:

- `src/pages/dashboard/invitaciones/[id]/preview.astro`
- `src/lib/intake/services/invitation-editor.service.ts` (or related)
- `src/styles/dashboard/_intake.scss`

**Changes**:

- If no draft exists but published content exists: render the published version for preview instead
  of showing an error.
- If neither exists: show a useful empty state with a "Crear borrador" button that calls
  `adminApi.generateDraft(invitationId)` and then redirects back to preview.
- Keep draft-first priority: if draft exists, preview draft.
- Add a preview source indicator: "Fuente: Borrador" or "Fuente: Versión pública".
- Replace the bright red banner (`#e53e3e`) with a neutral dark/glass banner:
  - Background: `color-mix(in srgb, var(--color-surface-primary) 90%, transparent)`
  - Text: "Vista previa interna — no publicada"
  - Source badge: "Fuente: Borrador / Versión pública"
  - Link: "Volver al editor"
- The banner should be fixed at the top with backdrop-filter blur.

#### 1e. Normalize feedback patterns

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/components/dashboard/intake/InvitationDetail.tsx`

**Changes**:

- Replace `window.prompt()` for duplicate with a proper modal or inline form (reuse the existing
  `ModalShell` from `src/components/dashboard/ModalShell.tsx`).
- Replace `window.confirm()` for delete with a proper confirmation modal using `ModalShell`.
- Use the existing `Toast` component (`src/components/dashboard/guests/Toast.tsx`) for success/error
  feedback instead of inline `p` elements where possible.

#### 1a–1e Verification

```bash
pnpm type-check && pnpm lint && pnpm test -- tests/components/InvitationList.test.tsx tests/unit/display-status.test.ts tests/components/InvitationEditor.test.tsx && pnpm build
```

---

### Phase 2 — Premium dashboard structure (estimated: 6–10 files)

#### 2a. Add search

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Add a search input above the filter tabs.
- Real-time client-side filtering by title and client name (the full list is already loaded
  client-side).
- Debounce input (300ms).
- Show "Sin resultados para '{query}'" empty state when search produces no matches.

#### 2b. Add compact summary metrics

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Add a metrics row above the filters showing:
  - Total activas: `{count}`
  - Publicadas: `{count}`
  - Borradores: `{count}`
  - Archivadas: `{count}`
- Derive from already-loaded `items` array.
- Keep compact — one line, small badges.

#### 2c. Improve filter layout

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Move "Requieren atención" tab next to "Archivadas" as a secondary visual tier.
- Consider collapsing less-used tabs (needs_attention, capture_received, in_review) behind a "Más
  filtros" dropdown if the tab bar is too wide.
- Add active filter count badge on the tab.
- Ensure horizontal scroll on narrow screens.

#### 2d. Improve row density and metadata hierarchy

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Make the title the primary row identifier: larger weight, truncate if too long.
- Show client name as subdued secondary text below the title.
- Show event type as a subtle label.
- Updated date should be relative ("hace 2 días") or absolute both, with a title attribute for full
  date.
- Add hover state on rows to indicate interactivity.
- Consider making the title row clickable as a shortcut to edit.

#### 2e. Add refined empty states

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/components/dashboard/EmptyState.tsx`
- `src/styles/dashboard/_empty-state.scss`

**Changes**:

- Different empty state messages per tab:
  - "No hay invitaciones activas. Crea una nueva invitación para comenzar."
  - "No hay demos en este momento."
  - "No hay invitaciones archivadas."
  - "No hay invitaciones que requieran atención."
- Each empty state should include the "Nueva invitación" CTA where appropriate.
- Add a subtle illustration or icon placeholder above the message (CSS-only, no image assets).

#### 2a–2e Verification

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

---

### Phase 3 — Editor polish (estimated: 6–8 files)

#### 3a. Improve editor header and sticky actions

**Files**:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Add a global "Unsaved changes" indicator in the header when `dirty.size > 0`.
- Add a global "Guardar todo" action that saves all dirty sections sequentially, with progress
  feedback. If any section fails, continue saving others and report which succeeded/failed.
- Replace repeated per-section "Guardar sección" buttons with a save pattern:
  - Each section shows a subtle dot/status on the sidebar (saved, unsaved, saving, error).
  - The per-section save button remains but should be less visually dominant (text link or small
    button).
  - A sticky bottom bar (or header action) shows: "3 cambios sin guardar — [Guardar todo]" when
    dirty.
- Keep `beforeunload` protection.
- Add saving animation (simple spinner or pulse) during section saves.

#### 3b. Improve section active state

**Files**:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Enhance the IntersectionObserver-based active state: add a subtle left border indicator on the
  active card.
- Add smooth scroll behavior when clicking a nav item.
- Sidebar items should show their dirty/error/saved state more clearly:
  - Dirty: yellow dot + `*` indicator (keep current).
  - Error: red dot.
  - Saved: green checkmark briefly, then return to source dot.
  - Saving: subtle spinner.

#### 3c. Improve validation presentation

**Files**:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Show inline validation errors on fields before save (not just on save attempt).
- Add required field indicators (red asterisk or "Requerido" label) on critical fields.
- In the publish warning section, list which critical sections are empty with direct links to scroll
  to them.
- Add "Publish readiness" indicator: green/yellow/red bar showing how many critical sections are
  complete.

#### 3d. Refine save/publish/preview flow

**Files**:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Preview link should show the source (draft vs published) in the URL or button text.
- After publish, show a success state with links to: Ver página pública, Volver al listado, Seguir
  editando.
- Disable publish button with a tooltip explaining why (e.g., "Guarda los cambios pendientes
  primero" or "Completa las secciones críticas").
- Add a "Discard changes" option (with confirmation) that reloads the editor context from the
  server.

#### 3e. Preview source/device controls

**Files**:

- `src/pages/dashboard/invitaciones/[id]/preview.astro`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Add a device width toggle in the preview: desktop / tablet / mobile viewport simulation.
- Implement via a wrapping `<div>` with `max-width` and `margin: 0 auto` that changes based on
  selection.
- Only on desktop screen sizes; mobile can use the mobile layout directly.
- This is a visual enhancement only; no actual responsive testing infrastructure.

#### 3a–3e Verification

```bash
pnpm type-check && pnpm lint && pnpm test -- tests/components/InvitationEditor.test.tsx tests/components/DraftEditor.test.tsx && pnpm build
```

---

### Phase 4 — Final polish and regression hardening (estimated: 6–10 files)

#### 4a. Responsive improvements

**Files**:

- `src/styles/dashboard/_intake.scss`
- `src/components/dashboard/intake/InvitationList.tsx`

**Changes**:

- Ensure the list table collapses gracefully on small screens:
  - Hide less important columns (updated date, type) on narrow viewports.
  - Convert row to a card layout under 600px: stacked layout with actions at the bottom.
- Ensure the editor sidebar collapses to a horizontal scrollable bar under 860px (already exists in
  SCSS but verify).
- Ensure the create flow renders well on mobile.

#### 4b. Loading/skeleton states

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/styles/dashboard/_intake.scss`

**Changes**:

- Replace "Cargando..." text with skeleton rows: 3–5 placeholder rows with animated pulse gradient.
- Editor should show a skeleton layout while loading context.
- Metrics area should show placeholder pulses while loading.

#### 4c. Destructive confirmations

**Files**:

- `src/components/dashboard/intake/InvitationList.tsx`
- `src/components/dashboard/ModalShell.tsx` (already exists)
- New confirmation modal component

**Changes**:

- Build a reusable `ConfirmModal` component (wrapping `ModalShell`) that supports:
  - Title
  - Description (explaining consequences)
  - Confirm button (destructive styling: red or danger variant)
  - Cancel button
- Use for:
  - "Archivar invitación" — "La invitación dejará de aparecer en la lista activa. Puedes restaurarla
    después."
  - "Eliminar definitivamente" — "Esta acción no se puede deshacer. Se eliminarán todos los datos
    asociados. [condition: if RSVP history exists, show blocker message]"
  - "Restaurar" — simple confirmation.
- Replace `window.confirm()` and `window.prompt()`.
- The duplicate prompt becomes a modal with pre-filled title (`${original} - copia`).

#### 4d. Accessibility checks

**Files**:

- All modified components

**Changes**:

- Ensure all action buttons have accessible labels.
- Ensure color contrast meets WCAG AA on status badges.
- Ensure keyboard navigation works on the overflow menu (Enter to open, Escape to close, Arrow keys
  to navigate).
- Ensure preview banner is marked as role="banner" and announced correctly.
- Ensure loading states are announced.

#### 4e. Test updates

**Files**:

- `tests/components/InvitationList.test.tsx`
- `tests/components/InvitationEditor.test.tsx`
- `tests/unit/display-status.test.ts`
- `tests/components/DraftEditor.test.tsx`
- `tests/components/SubmissionReview.test.tsx`

**Changes**:

- Update `InvitationList.test.tsx`:
  - Current test checks for `Editar` link with specific href. Update to reflect new action layout.
  - Add test for overflow menu rendering.
  - Add test for search filter.
  - Add test for metrics summary.
- Update `InvitationEditor.test.tsx`:
  - Add test for global unsaved indicator.
  - Add test for "Guardar todo" action.
  - Add test for publish blocking with dirty sections.
- Update `display-status.test.ts`:
  - Already comprehensive; verify no regressions.
- Add tests for `CreateInvitationFlow.tsx`:
  - Form validation (required fields).
  - Submit creates invitation and redirects.
- Add tests for preview:
  - Preview with draft → renders draft content.
  - Preview without draft but with published content → renders published.
  - Preview without either → shows empty state with action.

#### 4f. SCSS modularization (if safe)

**Files**:

- `src/styles/dashboard/_intake.scss` (split)
- `src/styles/dashboard/_invitation-editor.scss` (new)

**Changes**:

- Only if other phases are stable: split `_intake.scss` into:
  - `_intake-list.scss` (table, tabs, filters, metrics, actions)
  - `_intake-detail.scss` (detail page sections, RSVP panel, draft section)
  - `_invitation-editor.scss` (editor layout, nav, cards, fields, gallery)
- Update imports in `dashboard.scss`.
- Verify no visual regressions.
- **If risky, defer this to a maintenance-only phase.**

#### 4a–4f Verification

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

---

## 6. Summary of Decision Point Recommendations

| Decision             | Recommendation                                                                                                                         | Rationale                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List model**       | Enhanced table, not card list                                                                                                          | Table provides better density for the data fields needed; cards would waste vertical space. Enhance with better hierarchy.                                      |
| **Status model**     | Derive from existing fields; no new DB columns                                                                                         | Current `INVITATION_STATUSES` plus `archivedAt`, `kind`, `published`, `rsvpEventStatus` are sufficient. Add computed display categories in `display-status.ts`. |
| **Creation flow**    | Dedicated route (`/dashboard/invitaciones/nueva`)                                                                                      | Bookmarkable, no conflict with list loading, clean separation. Modal is secondary option.                                                                       |
| **Preview behavior** | Draft > Published > Empty state with action                                                                                            | No dead states. Source indicator in banner.                                                                                                                     |
| **Editor saves**     | Keep per-section saves but add global "Guardar todo"                                                                                   | Avoids autosave complexity; gives user control but reduces friction.                                                                                            |
| **Color system**     | Reserve gold/accent for: Nueva invitación, Guardar cambios, Publicar. Use subtle borders/text for secondary. Danger=red but contained. | Hierarchical visual system: primary actions get solid accent; secondary get border only; danger gets red but only on confirmation step.                         |

## 7. Data/Model Impact

**None.** All changes are UI-only. No new database columns, no Supabase migrations, no schema
changes.

- `display-status.ts` may get new derived display categories, but these are computed on the client
  from existing DTO fields.
- No changes to `InvitationDTO`, `Invitation`, `IntakeRequest`, or any entity type.
- The status enum (`INVITATION_STATUSES`) stays unchanged.
- The content source model (draft/published/demo/empty/mixed) stays unchanged.

## 8. Testing Strategy

### Phased test updates

- **Phase 1**: Update `InvitationList.test.tsx` for new action layout and compact badges. Update
  `display-status.test.ts` only if badge logic changes. No new test files.
- **Phase 2**: Add search filter tests. Add metrics tests.
- **Phase 3**: Update `InvitationEditor.test.tsx` for new save flow and validation indicators.
- **Phase 4**: Add `ConfirmModal.test.tsx`, `CreateInvitationFlow.test.tsx`, preview component
  tests. Accessibility-focused tests.

### Always-run verification

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build  # before merge
```

### Focused pre-suite tests per phase

```bash
# Phase 1
pnpm test -- tests/components/InvitationList.test.tsx tests/unit/display-status.test.ts

# Phase 3
pnpm test -- tests/components/InvitationEditor.test.tsx tests/components/DraftEditor.test.tsx

# Phase 4
pnpm test -- tests/components/InvitationList.test.tsx tests/components/InvitationEditor.test.tsx tests/components/DraftEditor.test.tsx tests/components/SubmissionReview.test.tsx
```

## 9. Rollback/Safety Strategy

- **Per-phase commits**: Each phase produces a standalone commit. Rollback = revert that commit.
- **No DB changes**: All changes are client-side; rollback is instantaneous and safe.
- **New routes only**: `/dashboard/invitaciones/nueva` is a new route; old list still works if
  creation is blocked.
- **Feature flags**: Not needed — each phase is self-contained and additive.
- **Backward-compatible actions**: The new action layout still supports edit, view, duplicate,
  archive, restore, delete. The old actions are replaced but functionally equivalent.
- **Preview fix is additive**: Old preview behavior (fail on no draft) is replaced but published
  content fallback is strictly additive.
- **SCSS modularization is separate**: If splitting SCSS causes issues, the monolithic file remains
  functional; revert split only.

## 10. File-Level Impact Estimate

| Phase     | New files | Modified files | Total  |
| --------- | --------- | -------------- | ------ |
| Phase 1   | 3         | 6              | 9      |
| Phase 2   | 0         | 3              | 3      |
| Phase 3   | 0         | 3              | 3      |
| Phase 4   | 2         | 8              | 10     |
| **Total** | **5**     | **20**         | **25** |

(Style file splits in 4f could add 2 new SCSS files and modify 2 imports.)

## 11. Explicit Non-Goals

- No autosave mechanism.
- No database migrations.
- No changes to public invitation routes (`/[eventType]/[slug]`).
- No changes to RSVP behavior or guest management.
- No changes to demo/public invitation resolution.
- No image upload or file management features.
- No Tailwind CSS introduction.
- No migration of demo content to the database.
- No full visual redesign — keep dark theme foundation, improve hierarchy and consistency.
- No React router or complex client-side routing — keep Astro pages.
- No introduction of external component libraries.
- No changes to the client-facing intake form (`/captura/[token]`).

## 12. Open Questions

1. **Should the editor's "Guardar todo" save sections sequentially or in parallel?** Sequential is
   safer (avoids race conditions with `expectedUpdatedAt`). If parallel, only the first save would
   succeed and subsequent saves would 409-conflict.
2. **Should the overflow menu be a custom component or use a lightweight library?** The repo has no
   dropdown library. A simple controlled `<div>` with absolute positioning (40–60 lines) is
   sufficient. No external dependency needed.
3. **Should `scss` file splitting be Phase 4 or a separate maintenance phase?** If 1860 lines
   becomes a practical problem during editing, split earlier. Otherwise, defer.

## 13. Relationship to Superseded Plans

This plan supersedes:

- `admin-workflow-improvement.md` — Its Phase 1 (normalize creation flow, states, navigation) and
  Phase 5 (harden publishing flow) are partially addressed here (creation route, status
  consolidation). Publishing flow hardening is already handled by `dashboard-creation-flow-plan.md`
  Phase 1.
- `dashboard-creation-flow-plan.md` — Its Phase 3 (UI text corrections) is absorbed into this plan's
  general visual improvement. Its Phase 5 (workflow affordances/filters) is addressed in Phase 2c.
  Its Phase 4 (shared primitives) influenced StatusBadge work in Phase 1b.

No conflict with other active plans (`client-intake-flow.md`, `editor-hydration-fix.md`, etc.) —
those address separate domains.
