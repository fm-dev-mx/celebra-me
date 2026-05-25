# Changelog

Todos los cambios notables en el proyecto Celebra-me serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este
proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).

## [Unreleased]

### Added (pending)

<!-- Items for the next release go here -->

## [0.3.0-beta.1] - 2026-05-25

### Added

- Per-guest branding toggle: new API endpoint (`/api/dashboard/guests/[guestId]/toggle-branding`),
  dashboard UI, and Supabase migration (`add_guest_branding_flag`)
- Per-event branding visibility control via `brandingVisibility` in the invitation view model
- Configurable RSVP subcopy text per event
- Collapsible dashboard sidebar with `localStorage` persistence
- Guest message toggle with read-only display in the dashboard
- Guest review filter block for pending delivery, pending RSVP, and unread messages
- No-phone direct share flow (share without prior save)
- Native share utilities extracted into dedicated `invitation-share` module
- Viewport utility library (`src/lib/dom/viewport.ts`) with visible bounds, virtual keyboard
  detection, and smart scroll positioning
- Engagement progress bar using native `HTMLProgressElement` with normalized view percentage
- Branding removal rules and eligibility constants
- E2E layout verification and viewport integrity tests
- API tests for the toggle-branding endpoint
- RSVP guest count normalization and clamping tests
- Nav test utilities extracted into dedicated module
- Guest count upper limit raised for `cesar-ramses` test event (5 → 10)

### Changed

- RSVP compact mode: JavaScript-based logic replaced with CSS viewport-height sections
- RSVP `AnimatePresence` removed; replaced with CSS transitions and `data-state` attributes
- RSVP submit button now reveals with animation after attendance selection
- Guest edit modal reworked for improved mobile and desktop layouts
- Guest card layout simplified to CSS grid (removed manual flex calculations)
- Guest status labels unified into single `getPrimaryStatus` function (replaces separate label and
  class helpers)
- RSVP status labels renamed for accuracy across UI and tests
- Branding toggle relocated from floating menu to expanded actions panel
- Guest cards split into independent two-column layout
- Dashboard stats heading area restructured
- Section scroll margin consolidated into CSS custom property `--invitation-header-offset`
- `vh` units replaced with `svh` for mobile Safari viewport compatibility
- Reduced-motion overrides consolidated into dedicated SCSS partial
- Mobile footer now wraps gracefully; light background gap prevented
- SendInvitationModal sections restructured for clarity
- `pinyon-script` font dependency updated, `sharp` added
- Dependencies bumped: `@supabase/supabase-js` (`^2.105.3` → `^2.106.1`), `nodemailer` (`^8.0.7` →
  `^8.0.8`), `sass-embedded` (`^1.99.0` → `^1.100.0`), `ts-jest` (`^29.4.9` → `^29.4.11`),
  `typescript-eslint` (`^8.59.2` → `^8.59.4`)

### Fixed

- Guest count default initialized to effective capacity instead of 1 (RSVP off-by-one)
- Null `guestComment`, invalid dates, and incorrect invite URL variable in guest data handling
- Image layout shift prevented by adding explicit dimensions to invitation images
- Guest message editing prevented through the dashboard update path
- Sidebar collapse toggle ARIA labels and script scoping for accessibility
- Share action button label descriptiveness improved
- TypeScript type annotation for sidebar collapse script
- Guest cards layout now renders as independent two-column grid
- TypeScript literal string widening in `getPrimaryStatus` test table
- `stylelint` and `eslint` pre-existing warnings remain unchanged

### Refactored

- `RsvpShell` component extracted from RSVP; spacing tokens consolidated into shared CSS custom
  properties
- Mobile spacing consolidated across RSVP components
- Guest share flow: no-phone guests saved before native share
- `ShareAction` simplified using extracted share utilities
- Guest presenter refactored with `getPrimaryStatus` caching in `GuestCard` and `GuestTableRow`
- Guest card layout simplified with CSS grid
- Unused CSS for expanded actions divider removed
- Unused `attendanceStatus` prop removed from `GuestExpandedActions`
- Status labels and branding copy unified across UI, tests, and fixtures
- Nav test utilities extracted into `tests/helpers/nav-test-utils.ts`

### Tested

- **New files** (13):
  - `tests/e2e/layout-verify-fix.spec.ts` — e2e layout verification
  - `tests/e2e/rsvp-v2.e2e.test.ts` — expanded with new RSVP scenarios
  - `tests/api/dashboard.guests.toggle-branding.test.ts` — API toggle-branding
  - `tests/components/GuestReviewBlock.test.tsx` — review filter component
  - `tests/components/GuestDashboardApp.review-filter.test.tsx` — review filter integration
  - `tests/components/ShareAction.test.tsx` — share action component
  - `tests/lib/dom/viewport.test.ts` — viewport utility
  - `tests/unit/branding-removal.test.ts` — branding removal rules
  - `tests/unit/rsvp-guest-count.test.tsx` — guest count normalization
  - `tests/helpers/nav-test-utils.ts` — nav test utilities
- **Expanded**: `RSVP.test.tsx`, `GuestCard.test.tsx`, `GuestExpandedActions.test.tsx`,
  `SendInvitationModal.test.tsx`, `rsvp-v2.e2e.test.ts`
- **Consolidated**: `guest-presenter.test.ts` — tests unified for `getPrimaryStatus`
- **Updated**: schema, adapter, and theme tests for new fields

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 0 hints                                    |
| Tests      | 91 suites passed, 1 suite skipped, 0 failed; 925 tests passed, 2 skipped  |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.2.0-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).
- The branding toggle migration is additive and backward-compatible; existing events without the
  flag default to branding visible.
- Verify that the additive branding toggle migration has been applied in the target environment
  before production promotion.

### Manual QA Recommended

Before promoting beyond beta:

1. RSVP flow across multiple invitation variants (premiere-floral, editorial, celestial-blue,
   enchanted-rose, jewelry-box, sacred-keepsake)
2. Attendance selection and guest count behavior (single, multiple, capacity boundary)
3. Mobile viewport behavior — small screens, virtual keyboard open/close, iOS Safari
4. Dashboard guest cards and status labels across attendance and delivery states
5. Guest edit/review modal — create, update, message toggle, branding toggle
6. Share/send flow — phone-present and no-phone guests
7. Branding visibility toggle — footer, contact CTA, thank-you branding
8. Collapsible sidebar — open/close, localStorage persistence across reloads
9. Dark/mobile dashboard layout — responsive grid, stats, filters
10. RSVP compact mode on mobile — section visibility after attendance selection

## [0.2.0-beta.1] - 2026-05-23

### Stable baseline

Primer checkpoint de release luego de la fase de estabilización/testing. Este tag congela el estado
verificado de los siguientes flujos:

- Guest dashboard (CRUD, búsqueda por teléfono, country code enforcement)
- RSVP (formulario, confirmación, temas premiere-floral, editorial, celestial blue)
- Phone input component con normalización internacional
- Invitaciones (envío, estados, gatekeeper)
- Import wizard con normalización de teléfonos internacionales
- Pruebas unitarias, de integración, API, componentes y E2E
- Infraestructura de pruebas (fixtures compartidos, helpers)

### Verification

| Check      | Result                                                                     |
| :--------- | :------------------------------------------------------------------------- |
| Lint       | Passed (1 pre-existing warning)                                            |
| Type-check | Passed                                                                     |
| Tests      | Passed (Windows test skipped with `test.skip` — known platform limitation) |
| Build      | Passed                                                                     |

### Known issues

- Las pruebas que dependen de `git` pueden fallar si `git` no está en `PATH` (aislado a entornos CI
  sin git).
- La prueba de Windows `dashboard.guests.happy` se salta con `test.skip` por una limitación de
  plataforma en `spawn`.

## [0.1.0] - 2024

### Added

- Estructura inicial del proyecto con Astro
- Sistema de invitaciones digitales
- Temas visuales (Jewelry Box, Luxury Hacienda)
- Sistema de tokens de diseño SCSS
- Integración con Vercel para despliegue
