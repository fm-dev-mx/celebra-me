# Changelog

Todos los cambios notables en el proyecto Celebra-me serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este
proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).

## [Unreleased]

### Added (pending)

<!-- Items for the next release go here -->

## [0.8.0-beta.1] - 2026-06-14

### Added

- **Baby-shower event type**: new `EventType` contract entry, migration, default RSVP subcopy, demo
  event, and Leah Lexa baby shower demo fixture
- **Multi-venue support**: `VenueEntry` type, `venues` array in location schemas, round-trip through
  draft mapper, adapter, and new `LocationSectionEditor` multi-venue UI
- **Reveal card redesign**: new data model, component layout, and styling with card texture assets
- **Gift store description**: canonical schemas with optional `storeDescription` field and intake
  mapping
- **Guest reminders**: `last_reminder_sent_at` schema column and migration, reminder-eligibility
  utility, backend endpoint (`record-reminder`), send-reminder CTA in card and table views
- **RSVP message preservation**: `appendGuestMessage` flow, confirmation message extraction as
  separate body copy
- **Guest message history**: `GuestMessageHistory` and `GuestDetailGroups` components extracted,
  formatted fallback timestamps
- **Envelope enhancements**: `cardLabel` and `cardTagline` through schemas, intake mappers, editor
  UI, and content schemas
- **Gallery single variant**: `single` presentation mode for one-image editorial galleries,
  pet-keepsake mode added
- **Interlude medium height**: compact variant for shorter emotional sections
- **Premium-rose wax seal**: new variant for envelope reveal
- **SQL safety infrastructure**: `sql-safety.ts` linting module, fail-closed CLI commands,
  `run-prod-patch.ts` runner, `blocked-db-push.mjs` guard
- **Preserve-local refresh workflow**: `preserve-local-lib.ts`,
  `refresh-local-from-prod-preserve-local.ts`, and supporting DB tooling
- **Demo content decoupling**: `isDemo` gate in publish flow, demo drift isolation,
  `demo-preset-catalog.ts`, `celestial-blue` demo replacing Leah Lexa static demo
- **OG/social improvements**: social crawler JS fallback redirect, CDN caching disabled for short
  URLs, runtime-only health endpoint
- **Script safety**: remote service role confirmation guard, centralised Supabase URL guard,
  redacted tokens in seed output
- **Agent infrastructure**: `invitation-production.md`, `database.md`, `manual-sql-manifest.md`
  rules; `AGENTS.md` entry point; `env-workflow.md` guide

### Changed

- `EnvvelopeReveal`: premium-rose seal variant with texture image support
- `Gallery` component: conditional eyebrow rendering, single-variant layout class resolution
- `ThankYou` component: premium editorial keepsake styling with celestial-blue refinements
- `GoogleMap` component: coordinate-based rendering from venue data
- `InvitationEditor`: metadata conflict recovery and separate OCC chains
- `GuestCard`/`GuestTableRow`: reminder CTA, priority share CTA, compact mobile summary
- Dashboard guests: standardised action button classes, presenter helpers cleaned up
- Adapter layer: venue coordinates, event slug resolution from `_assetSlug` content field
- Draft mapper: null-safety, multi-venue mapping, cardLabel/cardTagline mapping
- Merger service (`mergePublishedWithDraft`): preserves interludes, thankYou overlays; seeds draft
  from published
- Merge flow: `merge-content.service.ts` extracted and tested separately
- Intake editor: multi-venue editor, shared `venueLabel` utility, default reminder fallback
- Scripts: `validate-event-parity` migrated to `console.info`, `adopt-legacy-events` disabled,
  `new-invitation` fail-closed
- Eslint config: import ordering syntax, ts file pattern alignment
- Dependencies bumped: `@astrojs/vercel` 10.0.8, `framer-motion` 12.40.0, `nodemailer` 8.0.11,
  `eslint` 10.5.0, `jest` 30.4.2, `@supabase/supabase-js` 2.108.1, `typescript-eslint` 8.61.0, and
  others

### Database / Migrations

- 2 migrations: `add_baby_shower_event_type` (20260612000000), `add_guest_last_reminder_sent_at`
  (20260612000001)
- 2 production patches: `repair_samantha_guest_share_state`, `prepare_leah_lexa_baby_shower`
- 2 SQL recovery scripts: `repair-thankyou-overlay-cesar-ramses`, `restore-gallery-cesar-ramses`
- Migration 20260402000100 (`reconcile_event_slug_parity`) updated with PREFLIGHT_ABORT guard

### Fixed

- Publish: merge draft with prior published content to prevent data loss
- Preview: use effective merged content for dashboard preview
- Intake: preserve interludes and thankYou overlay fields through merge flow
- Intake: default empty reminder to fallback message in draft mapper
- Intake-publish: gate demo content fallback behind `isDemo` flag
- Schema: constrain venue coordinate bounds with min/max validation
- ThankYou: preserve overlay fields for sacred-keepsake variant
- Editor schema: add missing image field to thankYou section schema
- Events: decouple Leah Lexa invitation from demo baby shower asset slugs
- Guests: prevent double submission in `useSendInvitation` due to stale closure
- Short URLs: disable CDN caching, vary response by User-Agent
- Admin: add `is:global` to content-sync styles
- Scripts: redact sensitive token from seed invitation output
- Baby-shower: remove duplicate `mapUrl` from Leah Lexa demo event

### Added

- **Short ID resolver with OG metadata shell**: new `/i/[shortId]` short-code page,
  `InvitationOGShell.astro` component, OG meta tag rendering for social crawlers, and social crawler
  detection utility
- **Guest message sharing UX overhaul**: redesigned ShareMessagesModal with editor card, clickable
  template variables, server-side defaults, two-click reset, and ARIA labels; redesigned
  SendInvitationModal with preview mode and compact secondary actions; inline ShareComposer popup
  with invitation/reminder toggle; date-aware share message preview with date-based template
  variables
- **Reminder system**: reminder-eligibility utility, ReminderSettings types/schema/defaults,
  persistence through service and API, reminder batch flow, dashboard CTA and settings UI,
  `Por confirmar` status pill and review filter, `isUnconfirmedSharedGuest` utility and
  `unconfirmedShared` totals, `confirmationDeadline` field to invitation editor
- **eventTiming system**: timezone-aware schema, date-fns-tz dependency, timezone utilities, editor
  UI fields in LocationSectionEditor, mapper pipeline through draft and publishing
- **Social SEO**: `og:image:alt`, `ogDescription` field through editor/schemas/mappers/OG tags,
  `resolveShareDescription` fallback for invitation meta description
- **Guest form**: custom attendee count option with "Otro" input
- **Family parents order**: configurable parents order in Family component, editor dropdown, intake
  types/schemas/mappers
- **Editor enhancements**: sharing section UI with schemas/mappers/registry, envelope seal monogram
  field, `buildPreviewUrl` utility, `shareDateContext` in dashboard guest API and components,
  `firstSharedAt` wiring through sharing flow, `ShareFlowMode` types and utility, copy-success
  feedback and auto-close on share in single mode
- **ModalShell**: enhanced with subtitle, className, and improved ARIA
- **Neutral state color tokens** added to semantic token system
- **Share message renderer** and configurable share templates for RSVP

### Changed

- Dashboard styling refactored: focus patterns centralized into mixins, semantic state tokens
  adopted across form/button/phone-input components, media queries normalized, form field styles
  extracted from modals, intake and guest modal styles extracted into dedicated partials,
  `_intake-editor.scss` and `_intake-list.scss` partitioned from monolithic `_intake.scss`
- Countdown `eventDate` prop renamed to `targetIso` for timezone-aware countdown
- Invitation link generation simplified to prefer `/i/{shortId}` path
- Share message templates migrated to Spanish double-brace syntax, updated with friendlier wording
  and improved type safety; sharing config extracted with `resolveShareTemplates`, message variables
  and preview context constants; fields renamed to invitation/reminder
- Draft mapper refactored: null-safety, dead code removal, `Object.assign` replaced with direct
  property assignment
- Schemas enforced strict mode with modernized UUID validation
- Icon consolidation: `ICON_NAMES_TUPLE` extracted as shared export
- Dependencies bumped: `astro` 6.3.1→6.4.4, `@astrojs/react` 5.0.4→5.0.7, `eslint` 10.4.0→10.4.1,
  `@commitlint/config-conventional` 20.5.3→21.0.2, `eslint-import-resolver-typescript`
- pnpm lockfile deduplicated; Vercel security headers added for preview route

### Database / Migrations

- 1 migration: `add_first_shared_at` to `guest_invitations` (20260610000000)

### Fixed

- 404 status code and cache headers set for invitation routes
- Vercel preview route exclusion regex corrected in catch-all pattern
- Editor: activity editor collapse prevented on icon or time change in ItineraryEditor
- Editor: preview scale recalculated on frame resize
- Short-ID resolver: `ogDescription` populated for social preview fallback
- Import: invitation-link alias corrected from `@utils` to `@/utils`
- Mapper: stale `themeId` fallback removed from hero variant resolution
- Adopt-legacy: actual theme resolved from content files instead of hardcoded value
- Intake: form tokens migrated to semantic state and on-light variables
- Share state: `deliveryStatus` made the source of truth; `firstSharedAt` synced on delivery status
  transition
- Default message templates: `inviteUrl` removed, friendlier wording applied
- ShareComposer: country code support added and popover positioning fixed
- Sharing: legacy `whatsappTemplate` stripped from non-demo published content
- Draft-mapper: demo-only sharing fields prevented from leaking to client publications
- Invitation: defensive guards added, Astro site origin used in short-code page

### Tests / Validation

- **New test suites** (20+): eventTiming (time utilities, mappers, publishing flow),
  shortid-metadata, social-crawler, page-data, preview-url, message-type-resolver,
  share-message-defaults, share-message-renderer, sharing-config, update-share-messages,
  invitation-helpers, reminder-eligibility, reminder batch flow, GuestFormModal, ItineraryEditor,
  ShareMessagesModal, guests hooks, share-messages API, social-preview e2e audit
- **Updated suites**: guest-presenter, GuestCard, GuestDashboardApp review-filter,
  GuestExpandedActions, GuestTableRow, SendInvitationModal, ShareAction, draft-content-mapper,
  draft-to-published.mapper, publishing.service, event.adapter, header-navigation,
  invitation-editor.service, invitation-section-registry, rsvp-v2.service, service.limits,
  guest-dto, use-send-invitation, guest-factory, schema, time-normalization, invitation-link
- E2E social preview audit spec added

### Deployment Notes

- Apply `add_first_shared_at` migration (20260610000000) before deployment
- Verify short-ID route (`/i/[shortId]`) works with Vercel routing
- Validate OG metadata rendering for social crawlers on short-code page
- Test guest reminder flow end-to-end (eligibility → settings → batch send)
- Verify share message templates render correctly with date-based variables
- Test eventTiming pipeline across draft, editor, and published content
- Preview route security headers deployed with Vercel configuration update

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 0 hints                                    |
| Tests      | 175 suites passed, 1 skipped; 2111 tests passed, 2 skipped                |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.6.0-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).
- The `add_first_shared_at` migration is additive and backward-compatible.

## [0.6.0-beta.1] - 2026-06-08

### Added

- Internal invitation editor with live preview, section registry, asset library integration, sidebar
  reorder/visibility controls, and embedded right-side preview pane
- Asset library with upload, metadata editing, archival, restore, usage tracking, API routes, and
  section image pickers
- Content publication workflow with draft/published states, content resolver, drift detection, and
  sync panel
- Dashboard intake workflow for invitation production with list, detail, draft review, metadata, and
  publish views
- Icon catalog with centralized metadata, normalization utilities, and migration tooling
- Navigation system with section-aware routing and conditional rendering
- Mobile hero image support with responsive source, asset picker integration, and
  backgroundImageMobile field
- Gallery per-device focal point controls with tablet viewport support and pointer-based interaction
- Countdown section redesign with responsive date display and simplified editor
- Location section improvements with indications array replacing dressCode and additionalIndications
- Music autoPlay toggle in music section
- RSVP customizable response messages for confirmed/declined status and hybrid access mode
- Dev MFA bypass for local development with safety guards
- Display status utility with inconsistency detection
- Asset slug utility for content-based asset resolution across editor and publishing
- Image asset field component with preview card and fallback states
- Focal point control with per-image state and collapsible controls in GalleryEditor
- Invitation section registry with public section definitions and sidebar group support
- Content source tracking and draft hydration with per-section source indicators
- Optimistic concurrency control for editor save operations
- Restore-from-published API endpoint and hook
- Spanish display label maps for editor UI text
- CSRF token utilities and locals-based authorization helpers
- Production-safe database workflow scripts with shared library
- Parity validation integrated into refresh-local-from-prod workflow
- Backup scripts for local draft tables and production databases
- Bootstrap script for local super admin setup
- Verification script for icon name migration with typed detection
- Data audit and legacy event adoption tools
- Seed script for mock invitation projects
- Rate limits for content sync operations
- Public route error boundary with graceful fallback
- Asset usage label helpers and empty state copy
- Config section definitions with sidebar group support
- Compact sidebar navigation controls with hover-reveal animation
- Helper text and placeholders to location section editor
- Unpublished content warning banner in editor
- Viewport dimensions display and preview stale message improvements
- Countdown event date preview in editor with neutral defaults
- Image fallback chain with visual display states
- Gift item title fallback and type label in editor
- WhatsApp field conditional display based on confirmation mode
- Semantic content selection and asset slug resolution in preview
- Theme capability system for portrait support
- Remote Supabase storage images enabled for Vercel optimization
- Placeholder support to TextArea component in editor
- Responsive preview scaling with resize observer
- Portrait enabled for sacred-keepsake and angelic-presence themes
- Theme-aware portrait, mobile background, and image grid in main section editor
- Demo hero desktop image for enchanted-rose event
- Asset library UI with archive filter, inline editing, and demo assets
- Uploaded assets table with storage helpers and asset repository
- InvitationAsset type, shared asset keys, and extracted asset source types
- Venue images merged from demo content in draft-to-published mapper
- Published assets resolved from demo preset and validated before publishing
- Shared editor constants for breakpoint and preview device types
- Layout-role gallery previews with pointer-based focal point control
- Persisted item-level focal points applied in public rendering
- MoveArrayItem utility extracted and section-content-mapper service
- Demo preset resolved for snapshot and empty content handling
- Slug roles separated for content and asset resolution
- Safe fallback for blank hero sections
- Null-safety for location adapter
- Stable image key in gallery editor using image key instead of JSON.stringify
- Request body serialization and init spread order improved in api-client
- Preview fallback chain with draft error handling
- Non-empty enabledBlocks validation in internal edit context
- Event-type based field visibility for intake blocks
- Soft-delete filter to intake repository queries
- RSVP event slug sync on republish with draft sectionOrder support
- Internal edit context separated from client intake workflow
- Rule-based inconsistency repair and WhatsApp deep link in dashboard intake
- Encryption key validation before token operations
- Approved-submission-only draft generation with admin fallback
- Real client PII removed from static content with DB-first resolution enforcement
- Default demo preset blocks loaded when request lacks enabledBlocks
- Capture link column in invitation list
- Project DTO enriched with capture link data
- Origin consumers migrated to resolveSiteOrigin
- ResolveSiteOrigin utility for centralized origin resolution
- InvitationProject-based claim code creation
- Standalone events admin page and CRUD removed
- Admin dashboard stats migrated to invitation-project metrics
- Invitation project list enriched with workflow status
- RSVP panel in invitation detail page
- RSVP event data exposed in project detail endpoint
- Draft generation without approved submission allowed
- Invitation project linked when publishing draft event
- InvitationProjectId added to EventRecord and event repository
- Owner validation and slug collision checks in publishing service
- Filter tabs and next-step column in invitation list
- Reusable StatusBadge, EmptyState, and DashboardPageHeader components
- Inline editing UI for submission review
- Endpoint for admin submission corrections
- Token ciphertext persistence and capture link resolution
- AES-256-GCM token encryption for recoverable capture links
- PhotoOrder, cropNotes, and priorityNotes fields to photos schema and block
- Shared FieldRow and VenueSection components with centralized labels and utils
- BuildPageContextFromViewModel extracted from prepareInvitationPageContext with unit coverage
- Asset slug filtered from content-resolver viewModel
- Interlude properties whitelisted to prevent property leak in event adapter
- Composite unique route key for published content
- Custom asset slug support for published content resolution
- Dynamic content source in invitation page route
- Content-resolver moved from invitations/ to invitation/ directory
- Content via resolver for public RSVP endpoint
- Event registered on draft publish
- EventType required for published content lookup
- Section mappers extracted and accessMode added to RSVP
- Demo content loaded during publish workflow
- Draft-to-published enriched with demo content fallback
- Content resolver for static and published sources
- Publish button in DraftReview component
- Publish draft service and API endpoint
- Published content repo and draft-to-published mapper
- DB-event-adapter for DB-driven invitation rendering
- Responsive mobile styles for DraftEditor
- DraftEditor save flow refactored with internal state
- Deep merge for partial draft content updates
- DraftEditor component with inline editing
- Admin API client and hook for draft content updates
- Draft update service and API PATCH endpoint
- Draft update schema, repository, and error code
- Draft review page with read-only preview
- Draft section UI in invitation detail page
- Draft generation backend with domain, API, and migration
- Typed ApiError in submission service
- Dashboard invitation project list page
- Unit tests for intake request and submission services
- Dashboard admin pages and components for intake management
- Public intake form page, block components, and submission flow
- Dashboard API routes for project and request management
- Intake DTOs, mappers, admin API client, and rate limits
- Repositories, services, and unit tests for intake
- Zod schemas, block definitions, and demo preset catalog
- Core types and database schema for intake
- Envelope enabled for enchanted-rose demo
- Soft-delete migration for intake tables
- Origin column to intake_requests table
- Invitation_project_id FK to events table
- Composite index for published content slug and event_type lookups
- Published_invitation_content table and migration

### Changed

- Event adapter simplified with asset resolver and pickVariant types
- Dashboard restructured from events to invitations with updated UI, hooks, pages, API routes, and
  admin layer
- Intake module extracted and organized with repositories, services, schemas, and mappers
- Icon system modernized with catalog-based approach replacing whitelist and runtime alias support
- Gallery layout strategies converted to declarative data objects
- Location section mapping simplified with demo content inheritance
- Intake mappers refactored with strong types and normalized date handling
- Deep clone replaced with native structuredClone across intake
- Photo gallery crops improved with responsive focal points and gallery overrides
- Section ordering enforced via sectionOrder field in invitation content schema
- Music player CSS custom properties replaced with var() fallbacks
- Asset images recompressed for hero, interlude, thank-you portrait, and gallery
- Validate-schema script deduplicated and cleaned up
- RSVP phone country code preservation through form input
- Guest progress bar replaced with CSS inline style and ARIA attributes
- Phone resolution logic extracted into resolve-phone-payload.ts with typed discriminated union
- Guest cards split into independent two-column CSS grid layout
- Status labels unified into single getPrimaryStatus function
- Mobile spacing consolidated across RSVP components
- Section scroll margin consolidated into CSS custom property
- Dependencies bumped: @supabase/supabase-js, nodemailer, sass-embedded, ts-jest, typescript-eslint
- Itinerary item validation paths formatted with activity-level labels in editor
- Interlude animation moved from root to \_\_media element
- Enchanted Rose gallery redesigned with salon wall aesthetic and scroll-reveal animation
- Enchanted Rose gifts section styling refreshed
- Enchanted Rose music player mobile styling refined
- Enchanted Rose demo gallery and gifts content updated
- Gifts section redesigned with decorative accent elements
- Gallery component extended with heading prop and eyebrow field
- Itinerary time display formatted with formatTime12h
- Draft-to-published mapper updated for legacy icon passthrough
- Publishing guard test added rejecting drafts with legacy itinerary icons
- Verify-icon-migration script refactored with typed detection and indication validation
- Db refresh script extracted reusable functions and added reuse-dump mode
- Demo itinerary times updated to 24h format
- Venue and itinerary times normalized to 24h format in draft mapper
- 12h-to-24h time normalization utilities added to intake
- Content sync resolveSourceEnvironment updated for CSR contexts
- ContentSyncPanel sub-components extracted and UX improved
- Demo content sync implemented with drift detection and publish flow
- Database README and workflow documentation updated with new commands and safety rules
- Db scripts renamed to consistent naming convention
- Shared helpers extracted and psql availability check added to scripts
- Icon system cleanup documented
- Legacy icon references updated to canonical names
- DressCode and additionalIndications replaced with indications array in location
- Icon whitelist removed from IconPickerField and ItineraryEditor
- Runtime alias support and hasIconName utility removed from icon registry
- Icon name normalization contract tests added
- CheckSeal and Heartbreak icons added to catalog; Envelope renamed to Enveloped
- Icon system migrated from legacy keys to unified catalog
- IconPickerField component added for icon selection
- Family labels, groups, and visibility mapping tests added
- Family section visibility and hasContent guard added to Family.astro
- Section labels editor, groups editor, and visibility toggle added to intake UI
- NormalizeDate extracted to utils; family labels, groups, and visibility mapped in mappers
- Family draft schema extracted with labels, groups, and visibility fields
- Enchanted-rose logo initials flex constrained to desktop breakpoints
- Navigation conditionally rendered in EventHeader
- SubtitlePrefix removed from schemas, mappers, adapters, and demo data
- Location spacing, sizing, and visual weight tightened and reduced
- Card hover effects and nav sweep extracted from core to themes in location
- Canonical nav derived from present sections
- Enchanted-rose hero typography, spacing, and overlay opacities refined
- Desktop navigation filtered to core sections
- Contact CTA hidden when WhatsApp phone is placeholder value
- Transform scale removed from music button pulse animation
- Candle-shadow color added and midnight-navy replaced in enchanted-rose gradients
- CLI argument parsing normalized and isDemo removed from ContentEvent
- Error handling improved and getPublicUrl reused in storage uploads
- Parity validation, schema transform, and copy-order tests added for db
- Refresh-copy.sql rewritten with FK-safe ordered copy loop
- Parity validation, table lookup, and dump transformation utilities added
- Supabase CLI dependency added and TypeScript enabled for scripts
- Database workflow documented and references updated across docs
- Validate-event-parity migrated to TypeScript with tsx runtime routing
- Location indications type handling simplified in adapter
- Partial draft object sections preserved during content hydration in editor
- Mobile viewport defaulted with inline CSS custom properties in preview
- Asset slug resolution improved with asset lookup resilience in preview
- Location indications derived from dressCode and additionalIndications in adapter
- Editable intro copy added and location indications restructured in editor
- Countdown made independent editable section in editor
- Empty content state detection simplified in preview
- Double type assertion added for frozen asset resolution in editor
- Sacred-keepsake transparent hero background at desktop breakpoint
- Deprecated image fallback service removed from intake
- Responsive source added for mobile background image in hero
- Main section restructured with theme-aware portrait, mobile background, and image grid in editor
- Description prop added to ImageAssetField and defaultPreview fallback simplified
- BackgroundImageMobile mapped and adapted through the pipeline
- Sidebar widened, sticky offset increased, and scroll padding added in editor
- Section scroll-margins offset for preview banner height in preview
- WhatsApp field conditionally shown based on confirmation mode in editor
- Redundant dirty indicator removed from sidebar navigation in editor
- ImageAssetField layout and labels polished in editor
- Filter parameter added and fetchAssets helper extracted in assets
- Sidebar navigation controls compacted with hover-reveal animation in editor
- GalleryEditor enhanced with collapsible focal controls and per-device per-image state
- UseAssetLibrary hook simplified with cleanup and direct fetch in editor
- Preview hash synced when public section is selected from sidebar in editor
- Main, family, and location section editors extracted in editor
- Internal editor public section registry plan archived
- Sidebar extracted into EditorSidebar component with reorder and visibility controls
- Unused hasDevMfaBypass variable removed from middleware
- Invitation asset library enhancement plan added
- Auth helpers extracted and middleware reorganized in test infra
- Shared sanitize and parseCookieHeader extracted to core/utils
- Asset library component tests added and updated
- Asset library scss styles added
- Asset library components refactored with accessibility and error handling
- Structured conflict details included in asset deletion error
- Completed invitation asset library plan archived
- Invitation asset library plan updated with Phase 4 snapshot integrity
- Asset library tests added for intake
- Asset services added for upload, list, delete, usage tracking, and CSRF utility in intake
- Database migration, schemas for uploaded assets, storage helpers, and asset repository added in
  intake
- CSRF token regeneration skipped for embedded preview route
- Internal editor split preview pane plan archived
- Middleware tests added for internal preview route authorization
- Toggle preview panel replaced with persistent right-side embedded preview pane
- Embed mode support added to internal preview route
- Per-device focal point fields added to data schemas in gallery
- Tests added for gallery presentation, restore, focal point, and editor flows
- Discard changes, photo notes in gallery, and publish confirmation modals added in editor
- Itinerary and publication editors compacted with collapsible details
- Spanish display label maps added for editor UI text
- SaveMetadata wrapped in arrow function to prevent immediate invocation in editor
- Security mocks simplified and CSRF validation error tests added in admin
- Locals-based authorization helpers added and dashboard guest endpoints refactored
- Redundant error wrapping removed in validateCsrfToken
- Session context populated in Astro.locals and auth delegated to layout
- Sidebar icon added for invitation production in dashboard
- RSVP content detected for accurate inconsistency warnings in intake
- Reusable components extracted and editor UX enhanced in intake
- Invitation dashboard premium plan added and superseded plans archived
- SQL repair script added for broken \_assetSlug values
- Invitation slug set as \_assetSlug for client invitations in intake
- Confirm modal component tests added
- Invitation list tests added and updated
- Editor test updated for new saveSection signature
- Published content shown as preview fallback in dashboard
- Save status and publish success improved in editor
- GetPublicSlug utility extracted
- Editor hydration fix implementation plan added
- Invitation list redesigned with search, tabs, metrics, and overflow menu
- Create invitation page added to dashboard
- Invitation editor UI components added
- Internal editor API routes and client bindings added
- Invitation editor service added with optimistic concurrency
- Editor-api module and repository methods added
- Draft-to-published mapping logic improved
- Shared and editor validation schemas added
- Supabase .branches directory ignored in config
- Unused ResizeObserver parameter removed and URL constants hoisted in RSVP
- Database schema overview added and RSVP documentation updated
- Corrective security migrations and schema audit added
- Supabase credentials centralized into shared module in server
- Completed and superseded plans archived
- Active implementation plans added
- Workflow definitions added for error remediation and governance
- Domain-specific skills added for agent capabilities
- Agent governance infrastructure and entrypoints added
- Documentation updated for Invitation domain rename
- Project references renamed to invitation in scripts
- UI components, hooks, and pages updated for Invitation rename in dashboard
- API routes and admin layer updated for Invitation rename in dashboard
- InvitationProject domain entity renamed to Invitation in intake
- Invitation_projects renamed to invitations with kind, lineage, and harden soft-delete in db
- Project metadata form added to edit page in dashboard
- EventDate validation relaxed and dates normalized in draft mapper
- Soft-delete and restore API added with admin hook and UI
- Dashboard UI adapted to internal-edit-first workflow
- Internal edit page added with mode-aware intake form in dashboard
- Internal edit service and API endpoint added in dashboard-intake
- Invitation labels renamed to project in list view in dashboard-intake
- Invitation project repository imported directly instead of service in preview
- Status warnings, action buttons, and inconsistent badge styles added
- InvitationList migrated to centralized display-status logic
- InvitationProject thin wrappers removed, DTO mapping inlined, and queries fixed
- Project repository imported directly from consumers
- Multi-line method signatures flattened to single-line calls in admin-api
- Unused pg devDependency removed
- ToErrorMessage error handling utility added
- Pg dependency added and lint-staged config reformatted
- Production flow for invitation publishing documented
- SubmissionSection sub-component extracted in invitation detail
- Dashboard labels renamed to RSVP and Produccion de invitaciones
- Rate-limit entity ID prefixed with operation in admin
- Block component registry extracted to dedicated module
- Field label maps extracted to shared labels module
- Deprecated Eventos nav item removed and session guard hardened
- Project status auto-updated to published on draft publish
- PhotosBlock migrated to declarative field config array
- Inline status labels consolidated into shared labels module
- DraftReview and SubmissionReview migrated to shared FieldRow/VenueSection
- DraftEditor migrated to config-driven field rendering with validation
- Pnpm updated to v11.5.0 and lint-staged config formatted

### Database / Migrations

- 18 migrations added (20260528-20260608) covering intake core, drafts, published content, assets,
  domain rename, security, and data normalization
- Intake core tables and schema established
- Draft content tables added with optimistic concurrency support
- Asset library tables with storage integration and usage tracking
- Domain renamed from invitation_projects to invitations with data preservation and foreign key
  updates
- Security hardening and corrective migrations applied
- Icon name normalization with preflight validation and safety guards
- Itinerary time normalization to 24h format with full range validation
- Location indication icon normalization with guarded migration
- Venue image backfill for Ayrin invitation as manual production patch
- Soft-delete support added for intake tables
- Token ciphertext storage for recoverable capture links
- Unique route key enforced for published content
- Icon migration preflight corrected with full range validation
- Event slug parity targets validated with exception on missing
- IconName normalization guarded against creating new fields
- Ayrin location repair relocated to guarded manual production patch
- Migration safety guards verified with comprehensive tests

### Fixed

- Migration safety guards added for iconName normalization, itinerary time preflight, and event slug
  parity
- Mobile responsiveness improved across invitation components
- RSVP stuck loading state prevented with timeout and concurrency guard
- Legacy confirmationMessage hidden when responseMessages.confirmed.title provided
- Enchanted Rose gallery lightbox footer missing color added
- Countdown glow softened and label text-wrap corrected
- Location card z-index removed and shadow softened
- RSVP card panel and overlay visuals refined
- Guest count default initialized to capacity instead of 1 (RSVP off-by-one)
- Null guestComment, invalid dates, and incorrect invite URL variable fixed
- Image layout shift prevented with explicit dimensions
- Guest message editing prevented through dashboard update path
- Sidebar collapse toggle ARIA labels and script scoping improved
- Share action button label descriptiveness improved
- TypeScript type annotation for sidebar collapse script fixed
- TypeScript literal string widening in getPrimaryStatus test table fixed
- Content publication resolveSourceEnvironment fixed for CSR contexts
- Asset slug resolution improved with lookup resilience
- Preview asset slug resolution fixed
- Partial draft object sections preserved during content hydration
- WhatsApp field shown based on confirmation mode
- Editor dirty indicator removed from sidebar navigation
- Internal asset references validated before publishing
- Demo preset resolved for snapshot and empty content handled
- Safe fallback added for blank hero sections
- Null-safety added for location adapter
- Stable image key used in gallery editor
- Request body serialization and init spread order improved
- Preview fallback chain improved with draft error handling
- Non-empty enabledBlocks validated in internal edit context
- Spanish orthography corrected across intake and dashboard modules
- Published content excluded from event parity missing check
- Rate-limit entity ID prefixed with operation
- Spanish accent marks corrected in DraftReview assertions
- Cesar Ramses event title updated with bullet separator
- SectionVariant renamed to resolveSectionVariant
- Property leak prevented in event adapter with interlude whitelist
- Hardcoded WhatsApp number moved to env var CONTACT_WHATSAPP
- Unicode escape sequences normalized to literal accented characters in RSVP
- Schema test contentRoots updated to remove deleted `src/content/events` directory
- Event parity validation gracefully handles missing `src/content/events` directory
- Demo location intro fields prevented from leaking into draft content
- Date formatting standardized with timeZone UTC across public components
- Gallery preview simplified to single selected crop mode

### Tests / Validation

- Added coverage for intake repositories, services, schemas, and mappers
- Added tests for editor components: AssetLibraryPanel, AssetPicker, AssetUploader, ConfirmModal,
  ContentSyncPanel, DraftEditor, DraftReview, EditorPreviewPane, EditorSidebar, GalleryEditor,
  ImageAssetField, IntakeForm, IntakeLinkPanel, InvitationEditor, InvitationList, SubmissionReview
- Added tests for asset operations: archive-restore, list-response, metadata-update, source-schema,
  usage-detection
- Added tests for content publication, content resolver, db-event-adapter, db-workflow-lib
- Added tests for demo asset import, demo asset service, demo publication service
- Added tests for display status, draft content mapper, draft generation, draft preview helper
- Added tests for draft-to-published mapper, draft update service, gallery presentation
- Added tests for icon normalization, intake field visibility, intake mapper
- Added tests for intake request repository/service, intake submission service
- Added tests for intake token, intake utils, invitation editor schema/service
- Added tests for invitation section registry, invitation repository
- Added tests for invitations domain migration, migration safety, origin
- Added tests for published route POC, publishing service, storage upload
- Added tests for theme contract, time normalization
- Added API tests for content sync, intake edit, intake editor restore-published
- Added component tests for RSVP, SendInvitationModal, ShareAction
- Added unit tests for admin edit service, admin rate limit, api client
- Added tests for dev MFA bypass, RSVP v2 auth authorization locals
- Updated existing tests for schema, adapter, theme, header navigation
- Updated event adapter, invitation presenter, render plan, section render data tests
- Updated style boundaries, theme presets, RSVP v2 service branches tests
- Migration safety verification tests added
- Icon normalization contract tests added
- Legacy icon passthrough tests added for draft-to-published mapper
- Guard test added rejecting drafts with legacy itinerary icons
- Persisted itinerary icon verification tests added

### Deployment Notes

- Sequential execution of 18 Supabase migrations required (20260528-20260608)
- Domain rename from invitation_projects to invitations includes data preservation and FK updates
  via migration
- Icon normalization migrations include safety guards and preflight validation
- Verify icon normalization on staging with production data snapshot before production deployment
- Validate content resolution for both static and published invitations after migration
- Test editor workflow end-to-end (create → edit → publish) after deployment
- Monitor migration execution times and logs during deployment
- Keep rollback plan available for database changes
- Verify asset library functionality with real uploads in staging
- Test RSVP flow with new content resolution logic
- Confirm navigation system works across all invitation variants
- Review manual production patch for Ayrin location repair before execution
- Validate itinerary time normalization with full range preflight check

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 3 hints (deprecation warnings)             |
| Tests      | 160 suites passed, 1 skipped; 1821 tests passed, 2 skipped                |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.5.0-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).
- The `src/content/events` directory has been removed; static event content is now managed through
  the database-driven invitation system.

## [0.5.0-beta.1] - 2026-05-28

### Added

- Enchanted-rose section variants: location (intro header, map images), rsvp (ornate card layout),
  gallery (salon wall aesthetic), hero (overlays, ornaments, details panel), header, family, quote,
  footer, personalized-access, gifts, itinerary, countdown, music-player — full section variant
  coverage for the enchanted-rose theme
- `initSectionReveal` animation utility for section reveal animations on scroll
- Section reveal animations wired into enchanted-rose variants and `ThankYou` component
- Explicit section ordering via `sectionOrder` field in invitation content schema
- Configurable scroll label on hero with enchanted-rose variant
- Corner-brackets SCSS mixin applied to quote section
- Map images for ceremony and reception locations (enchanted-rose)
- Venue name prop and focal point data to demo hero
- Shared `createIntersectionObserver` extracted from interlude observer for cross-component reuse
- Music-player variant styling for enchanted-rose

### Changed

- Photo gallery crops improved with responsive focal points and gallery overrides for enchanted-rose
- Photo gallery layout class type system tightened
- Enchanted-rose gallery redesigned with salon wall aesthetic
- Ceremony/reception resolution unified in adapter layer; asset helpers simplified
- Corner-ornaments mixin unified across theme; redundant hero CSS removed
- Section index sorted forwards alphabetically
- Enchanted-rose location overlays and aspect ratios simplified
- Gallery background token simplified
- Hero engraved style simplified; token inheritance constraint enforced for `hero-label-color`
- Music-player CSS custom properties replaced with `var()` fallbacks
- Asset images recompressed (hero, interlude, thank-you portrait, gallery images)
- Validate-schema script deduplicated and cleaned up

### Fixed

- Countdown glow softened and label text-wrap corrected
- Unused location card z-index removed and shadow softened
- RSVP card panel and overlay visuals refined

### Tested

- Schema validation expectations updated for new section variants
- Variant partial boundary tests generalized
- Invitation presenter, render-plan, and section-render-data tests added
- Style-boundary tests expanded
- Theme-presets tests added
- Validate-schema script tests updated and deduplicated
- Header-navigation tests updated

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 0 hints                                    |
| Tests      | 96 suites passed, 1 skipped; 1011 tests passed, 2 skipped                 |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.4.1-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).

## [0.4.1-beta.1] - 2026-05-25

### Fixed

- Gallery lightbox image height constrained with `max-height: 85svh` to prevent overflow on tall
  images

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 0 hints                                    |
| Tests      | 96 suites passed, 1 suite skipped; 1000 tests passed, 2 skipped           |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.4.0-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).

## [0.4.0-beta.1] - 2026-05-25

### Added

- Group filter and group metrics in the guest dashboard for segment-based guest review
- Compact group chips on `GuestCard` and `GuestTableRow` for quick group identification
- Shared guest tag utilities (`src/lib/guests/guest-tags.ts`) unifying group and status helpers
- Collapsible/expanded message toggle on `GuestCard` and `GuestTableRow`, replacing the previous
  tooltip pattern
- Dedicated `resolvePhonePayload` module with discriminated union result for country-code-aware
  phone resolution

### Fixed

- RSVP phone country code preserved when typing plain national digits (dropdown no longer resets on
  input)
- Progress bar test assertion aligned with CSS custom property naming
- Note indicator in `GuestTableRow` now correctly uses the `hasMessage` helper

### Refactored

- Guest progress bar: replaced `useLayoutEffect`/JS-driven sizing with CSS inline style and ARIA
  attributes
- Phone resolution logic extracted from guest presenter into `resolve-phone-payload.ts` with typed
  discriminated union return

### Tested

- `makeGuest` extracted to shared test factory; `normalizeViewPercentage` coverage added
- Phone: `buildWhatsAppNumber` country code, `parsePhoneInput` international detection
- RSVP phone country code preservation through form input
- Phone: `resolvePhonePayload` with country code priority and error handling
- New test files: `GuestFilters.test.tsx`, `GuestGroupMetrics.test.tsx`, `GuestTableRow.test.tsx`,
  `guest-tags.test.ts`

### Validation

| Check      | Result                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Type-check | Passed — 0 errors, 0 warnings, 0 hints                                    |
| Tests      | 96 suites passed, 1 suite skipped; 1000 tests passed, 2 skipped           |
| Build      | Passed — event parity validated, server + client built, sitemap generated |

### Known Caveats

- Windows-specific test (`dashboard.guests.happy`) remains skipped with `test.skip` due to a
  platform limitation in `spawn` — unchanged from `v0.3.0-beta.1`.
- Tests that depend on `git` may fail if `git` is not in `PATH` (CI environments without git).

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
