# Architecture — Celebra-me

This document describes the **current architectural model** of Celebra-me.

It defines the active system boundaries used by the repository today and should be treated as an
evergreen source of truth for route structure, server boundaries, content flow, and invitation
rendering.

---

## 1) Architectural Principles

Celebra-me follows these guiding principles:

- **SSR by default** Astro runs with `output: 'server'` on Vercel. Individual responses may still be
  cacheable, but routes must be designed for runtime execution.
- **Pragmatism over theory** Patterns are applied only when they reduce real complexity.
- **Explicit boundaries** UI code, route orchestration, and server-only logic stay separated.
- **Deploy safety first** Architecture must remain compatible with Astro and Vercel constraints.

### Validation and operational tooling boundary

`scripts/related-test-files.mjs` owns Jest input selection for the existing local runners. Visual
reference metadata is certified by the visual pipeline; mixed application changes retain their
required Jest checks. Hooks enforce Git policy, staged checks and LFS transfer without querying
invitation databases. `pnpm dbs` remains an explicit read-only operator command. Executable commands
come from `package.json`; [validation procedures](validation-procedures.md) own validation scope and
[Git governance](git-governance.md) owns hook ranges and remote enforcement policy.

### Invitation mutation boundary

Invitation writes use a lightweight ports-and-adapters boundary. Routes and UI collect validated
commands; `src/lib/intake/services/**` owns preconditions, orchestration, operation identity, and
outcome classification; repositories and the Local/hosted/Storage/Auth adapters own persistence. The
Editor and managed CLI share validation, ownership, environment identity, publication, asset, and
outcome contracts while retaining optimistic revisions for interactive saves and baseline-aware
three-way merge for managed releases. The atomic publication RPC remains the publication unit.

Material outcomes use `not_applied`, `applied`, `partial`, or `replayed` and append an immutable
`invitation_mutation_operation_receipts` row. That table is the immutable/idempotency ledger for
managed invitation mutations: `service_role` may `SELECT` and `INSERT` only (never `UPDATE` or
`DELETE`), and a defensive trigger rejects in-place mutation. Atomic mutation RPCs serialize on the
mutable invitation row (`SELECT … FOR UPDATE`), then read receipts without row locks; PostgreSQL row
locks on the receipt table would require `UPDATE` and must not be used. Canonical transaction order
is: acquire invitation serialization → read receipt by `operation_id` → return the stored result on
retry → otherwise mutate → insert exactly one receipt → commit. Unique `operation_id` is the final
duplicate-receipt defense. Latest managed provenance is the reconciliation baseline, not a journal.
Field authority is executable in `src/lib/intake/mutations/ownership.ts`: definitions manage event
type, base demo, theme, kind, and snapshot; title, route slug, client metadata, owner, and login
alias are seeds that become target-owned. Drafts/assets are reconciled, published content is
publication-owned, event linkage is invitation-managed, and guest confirmations/audit are
RSVP-owned.

Structural reconciliation distinguishes absent, `null`, unchanged, and removed values. Managed
assets carry explicit definition/key/hash/operation ownership; only reviewed, unreferenced assets
with matching ownership are pruneable. Editor metadata-reopen and restore-from-published use
dedicated atomic RPCs with revision/version checks and receipts. The Editor and
`pnpm invitation:release` share the same managed-mutation contract (validation, ownership,
environment identity, publication, assets, and operation outcomes) where those paths apply. Auth
password and managed-alias operations mark external success with an operation ID so downstream
audit/receipt repair cannot silently repeat the Auth mutation. Database corrections for this
contract ship only as versioned migrations under `supabase/migrations/` and promote through Local →
Preview → Production; do not apply manual dashboard grants.

---

## 2) Astro Execution Model

The repository tracks **Astro 7** SSR with the Vercel adapter. Platform version policy (including
the hybrid TypeScript 7 CLI / TypeScript 6 tooling-API arrangement) lives in
[`project-conventions.md`](project-conventions.md#12-platform-version-policy).

### Default Strategy

- Pages execute through the Astro SSR adapter. Public pages may opt into cache headers, while
  personalized and protected responses remain private or non-cacheable. Invitation cache headers are
  specified in
  [`docs/domains/invitations/public-response-cache-policy.md`](../domains/invitations/public-response-cache-policy.md).
  Delivery metrics, HTML budgets, and runtime monitoring are specified in
  [`docs/domains/invitations/performance-metrics.md`](../domains/invitations/performance-metrics.md).
- Runtime server execution covers:
  - user input,
  - side effects,
  - protected operations,
  - integrations requiring secrets.
- Guest dashboard freshness is implemented by the active client/query behavior. Do not document a
  realtime transport unless its route exists in `src/pages/api/**`.

---

## 3) Pages, Layouts, and Components

### 3.1 Pages (`src/pages/**`)

- Astro pages define public routes using file-based routing.
- Public invitation rendering lives under:
- `src/pages/[eventType]/[slug].astro`
- `src/pages/[eventType]/[slug]/i/[shortId].astro`
- `src/pages/captura/[token].astro` for intake capture forms
- Host dashboard pages live under `src/pages/dashboard/**`.
- API routes live under `src/pages/api/**`.

### 3.2 Layouts (`src/layouts/**`)

- Layouts define shared page structure only.
- They must not absorb domain logic that belongs in route-facing assembly modules, services, or
  route handlers.

### 3.3 Components (`src/components/**`)

- Components remain presentation-focused.
- React islands are used for interactive dashboard and RSVP experiences.
- Components must not access secrets or server-only integrations directly.

### 3.4 Route-Facing Assembly Modules

- Route-facing assembly should live close to the owning feature instead of behind a global presenter
  layer.
- The active invitation route uses `src/lib/invitation/page-data.ts` to normalize page-ready data
  from adapters, theme contracts, and guest context before `.astro` rendering.
- Invitation section order, interlude placement, and section-intersection metadata are resolved in
  the invitation render plan. `InvitationSections.astro` renders those explicit descriptors and
  starts one document-level reveal coordinator; individual sections do not own viewport observers.
- A public personalized-only RSVP without guest context is rendered as static Astro markup. The
  React RSVP island is reserved for demo or guest-backed interactive states, so the locked state
  cannot request the RSVP or Framer Motion client graph.
- When route logic becomes non-trivial, prefer a feature-owned `page-data.ts` or equivalent module
  over reintroducing a global route-assembly layer.
- Retire compatibility helpers once their runtime consumers are gone; a helper kept alive only by an
  isolated legacy test is no longer part of the active architecture.

---

## 4) Client Islands (`client:*`)

Client-side JavaScript is opt-in and intentional.

### Rules

- Use islands only when interactivity is required.
- Keep islands small and purpose-driven.
- Prefer server rendering and progressive enhancement when interactivity is not essential.

Unnecessary client-side logic is architectural debt.

---

## 5) Server-Side Logic

### 5.1 API Routes

API routes (`src/pages/api/**`) are the only entry point for:

- handling user input,
- performing side effects,
- accessing secrets,
- integrating with external services.

### 5.2 Server-Only Modules

The active server-only hubs in the repository are:

- `src/lib/rsvp/**` for RSVP, guest management, auth/session support, and dashboard services
- `src/lib/dashboard/**` for typed dashboard API clients and DTO helpers
- `src/lib/assets/**` for asset registry and discovery
- `src/lib/content/**` and `src/lib/adapters/**` for event/content resolution and normalization
- `src/lib/invitation/page-data.ts` for invitation route-facing page assembly
- `src/lib/intake/**` for invitation and optional client-capture management (services, repositories,
  schemas, mappers)
- `src/utils/**` for shared utilities such as invitation-link, environment, and WhatsApp helpers

Historical note:

- Historical only: older documentation and audit logs may reference retired route-assembly or legacy
  server-helper paths; those paths are not active architectural hubs in the current tree.

### 5.3 Global Logic

- `src/middleware.ts`: session orchestration, AAL2 enforcement, and route-level authorization
- `src/data/`: static global data and schema-less configuration
- `src/interfaces/`: shared contracts and UI-facing interfaces

These modules must never be imported by purely client-side presentation code when doing so would
pull in server concerns.

### 5.4 Published Invitation Content

Public published invitation lookups against `published_invitation_content` must use both
`event_type` and `slug` — never `slug` alone. The unique constraint
`published_invitation_content_event_type_slug_key UNIQUE (event_type, slug)` enforces route
identity. See `src/lib/invitation/content-resolver.ts` and
`src/lib/intake/repositories/published-invitation-content.repository.ts`.

Static demo/template fallback preserves the archive check but reads only `archived_at` through
`isInvitationArchivedBySlug`; it must not load the client snapshot or contact fields.

---

## 6) Client → Server Communication

Preferred mechanisms:

- `fetch()` calls to `/api/*` endpoints
- Native HTML forms where progressive enhancement is appropriate

```html
<form action="/api/endpoint" method="post"></form>
```

### 6.1 Session Elevation (MFA)

After MFA on the client:

1. the client completes the challenge flow,
2. fetches the elevated session,
3. calls `/api/auth/sync-session`,
4. and the server persists the AAL2 state in `HttpOnly` cookies.

This keeps middleware authorization aligned with the elevated session state.

---

## 7) Content Collections

Astro content collections (`src/content/**`) are used for public demos and internal event templates.
They are not a temporary fallback for real/client invitations.

### Active Collection Layout

- `src/content/event-demos/**.json` for showcase demos

### Rules

- Content remains logic-free.
- Validation and typing are defined through `src/content.config.ts`.
- Runtime behavior must not depend on undocumented ad-hoc content fields.
- Real/client invitations must be DB-published content resolved from `published_invitation_content`.

---

## 8) Styling Architecture

- **SCSS only** for maintained style files.
- **Theme contract driven** variants come from `src/lib/theme/theme-contract.ts`.
- **Strict token structure**:
  - `src/styles/tokens/system/` for raw SCSS foundation tokens
  - `src/styles/tokens/semantic/` for `:root` semantic CSS custom properties
  - component/layout/section stylesheets for scoped component tokens
  - `src/styles/themes/` for presets, sections, landing, and assets theme files
  - `src/styles/components/` for shared UI styles
  - `src/styles/invitation/` for invitation section/layout styles
  - `src/styles/dashboard/` for dashboard shell/components
  - `src/styles/intake/` for intake form styles
  - `src/styles/auth/` for authentication surface styles
  - `src/styles/home/` for landing page styles
  - `src/styles/ui/` for base UI component styles
  - `src/styles/common/` for shared common styles
  - `src/styles/global/` for global/reset styles
  - `src/styles/layout/` for layout shell styles
  - `src/styles/tools/` for SCSS tools and functions

### 8.1 Preset Strategy

- Presets are class-scoped through `.theme-preset--{name}` selectors.
- Invitation routes consume preset classes generated from normalized event content.
- Live preset and variant contracts are defined by `src/lib/theme/theme-contract.ts`, not by
  free-form documentation lists.
- Presets are the canonical source of theme identity. Section partials are organization and
  presentation, not independent theme identity.

### 8.2 Invitation CSS Delivery

- `src/styles/invitation.scss` emits shared invitation structure and the shared section bases
  exposed by `src/styles/themes/sections/_index.scss`.
- `src/styles/invitation-presets/*.scss` are runtime preset entrypoints. They load preset tokens and
  preset-specific font packages.
- `src/styles/invitation-sections-by-preset/*.scss` are runtime section-bundle entrypoints. They
  import canonical `src/styles/themes/sections/**` modules directly in cascade order.
- `src/lib/invitation/section-css-resolver.ts` resolves one preset bundle, envelope reveal CSS when
  the variant has a dedicated partial, an optional visual profile, and only the requested canonical
  footer/gallery/structural overrides. It does not discover every section variant as an independent
  asset.
- Public invitation and dashboard preview routes use the same resolver and preserve stylesheet
  document order: preset, section bundle, optional footer/gallery override, envelope reveal,
  optional structural partials, then optional visual profile. Sheets not required to paint the
  sealed envelope are non-blocking (`media="not all"`) until first paint, envelope open, a bounded
  paint fallback, or an envelope-skipped visit.

Visual audit tooling records capture-workspace fingerprints and post-capture presentation/resource
evidence in the existing screenshot report. Full invitation harness captures must include active
global/base styles; isolated section captures remain distinct. This does not certify a remote
deployment's revision, per-glyph font fallback or human creative acceptance. The executable evidence
contract and limitations are documented in
[the screenshot tool](../../scripts/screenshot/README.md#capture-evidence-and-comparison-limits).

---

## 9) Environment & Deployment (Vercel)

### Environment Variables

- Defined in deployment/runtime environments
- Typed in `src/env.d.ts`
- Never exposed directly to client code unless explicitly safe

### Platform Constraints

Architectural decisions must account for:

- Linux case sensitivity
- build-time vs runtime execution
- filesystem limitations
- server execution contexts used by Astro/Vercel

---

## 10) Refactor Criteria

Architectural refactors are justified only when they:

- reduce real complexity,
- eliminate bugs or boundary leaks,
- improve clarity or maintainability.

Refactors driven only by pattern aesthetics should be avoided.

---

## 11) Evolution

When implementation diverges from this document:

- update the document,
- then align the code or record the deviation explicitly.

Silent divergence is discouraged.

---

## 12) Universal Asset Registry

Invitation-specific assets are registered through the **Universal Asset Registry**.

- **Location**: `src/lib/assets/asset-registry.ts`
- **Documentation**: `docs/domains/content/collections.md`
- **Mechanism**: components consume semantic keys via registry/discovery helpers instead of raw
  filesystem paths

This keeps asset consumption deterministic and type-safe.

---

## 13) RSVP Module (Multi-tenant)

Celebra-me includes a dedicated RSVP and guest-management module for:

- host-side dashboard operations,
- guest-side invitation access and confirmation,
- protected auth/session flows.

### Host Dashboard Routes

- `/dashboard/invitados`
- `/dashboard/memories`
- `/dashboard/admin/recuerdos`
- `/dashboard/claimcodes`
- `/dashboard/usuarios`
- `/dashboard/admin`
- `/dashboard/mfa-setup`
- `/dashboard/invitaciones`
- `/dashboard/invitaciones/[id]`
- `/dashboard/invitaciones/[id]/draft`
- `/dashboard/invitaciones/[id]/preview`
- `/dashboard/invitaciones/[id]/review`

### Host Dashboard API Endpoints

- `GET /api/dashboard/guests?eventId=...&status=...&search=...`
- `POST /api/dashboard/guests`
- `POST /api/dashboard/guests/bulk`
- `PATCH /api/dashboard/guests/:guestId`
- `DELETE /api/dashboard/guests/:guestId`
- `POST /api/dashboard/guests/:guestId/mark-shared`
- `POST /api/dashboard/guests/:guestId/toggle-branding`
- `GET /api/dashboard/guests/export.csv?eventId=...`
- `GET /api/dashboard/events`
- `GET /api/dashboard/claimcodes`
- `POST /api/dashboard/claimcodes`
- `PATCH /api/dashboard/claimcodes/:claimCodeId`
- `DELETE /api/dashboard/claimcodes/:claimCodeId`
- `POST /api/dashboard/claimcodes/validate`
- `GET /api/dashboard/admin/events`
- `PATCH /api/dashboard/admin/events/:eventId`
- `GET /api/dashboard/admin/users`
- `PATCH /api/dashboard/admin/users/:userId/role`
- `GET /api/dashboard/intake`
- `POST /api/dashboard/intake` (rejected for client creation; managed CLI only)
- `GET /api/dashboard/intake/:id`
- `POST /api/dashboard/intake/:id/request`
- `POST /api/dashboard/intake/:id/request/regenerate-token`
- `POST /api/dashboard/intake/:id/review`

### Intake/Capture API

- `GET /api/captura/[token]` — resolves intake request from raw token
- `POST /api/captura/[token]` — submits intake data

### Local canonical status boundary

- `/dashboard/estado` and `GET /api/dashboard/estado` are available only in the persistent-Local
  runtime to a strongly authenticated `super_admin`.
- One `StatusProbeSession` collects at most one content SQL family and one migration-history probe
  per environment. Canonical classification (`classifySchemaLifecycle`, `classifyLiveInvitation`,
  `decidePromotionAction`, `deriveSchemaOperationFields`) stays in TypeScript. Diagnostics enrich
  that view and never override publication, schema, or readiness.
- The browser payload is `CanonicalStatusView`: classifier tokens, handoff copy, and optional
  diagnostics. It must not include content, UUIDs, hashes, URLs, credentials, or raw errors.
- The React island consumes only browser-safe status types; it never imports database, filesystem,
  or child-process modules. Remote probes run only after explicit refresh.

### Other API Endpoints

- `GET /api/health`
- `POST /api/contact`
- `GET /api/invitacion/public/[eventType]/[slug]/rsvp` — public hybrid RSVP

### Guest Invitation Access

The active guest-facing patterns are:

- `/{eventType}/{slug}?invite={inviteId}` for direct personalized access
- `/{eventType}/{slug}/i/{shortId}` for short-link resolution
- `/api/invitacion/:inviteId/context`
- `/api/invitacion/:inviteId/rsvp`
- `/api/invitacion/:inviteId/view`

Historical note:

- Older documents may reference `/invitation/{inviteId}` or `/api/invitation/*`. Those patterns are
  no longer the current public contract.

Detailed RSVP design and constraints are documented in `docs/domains/rsvp/architecture.md`.

### Event memories (guest photo/video QR)

One private memory space per event, activated by a super admin from `/dashboard/admin/recuerdos`.
The feature is event-neutral: nothing in code names a client, and adding an event never requires a
deployment.

- **Module layout** (enforced by the ESLint `boundaries` elements): `src/lib/memories/contract/` is
  import-free and shared by the app, the islands and the Cloudflare Workers;
  `src/lib/memories/server/` holds repositories (the only modules that name tables and RPCs),
  services, route guards and the Worker gateway; `src/lib/memories/client/` holds the browser API
  client, media preparation and encrypted export; islands live in `src/components/memories/` and
  `src/components/dashboard/memories/`.
- **Routes:** `/r/[slug]` and `/r/[slug]/recuperar` (SSR, `noindex`, `no-store`) resolve the space
  by its immutable public slug; `/dashboard/memories?eventId=` is the owner-only organizer surface;
  `/dashboard/admin/recuerdos` manages spaces.
- **Guest API:** `GET|POST|PATCH|DELETE /api/memories/:slug/session`,
  `GET|POST /api/memories/:slug/items`, `GET|PATCH|POST|DELETE /api/memories/:slug/items/:itemId`.
  Authentication is a per-space `__Host-` cookie; anonymous operations are rate limited by IP and
  everything else by session.
- **Organizer API:** `GET /api/dashboard/memories`, `GET|POST /api/dashboard/memories/:eventId`,
  `GET|PATCH|DELETE /api/dashboard/memories/:eventId/items/:itemId` (owner membership required;
  mutations are CSRF-protected through the dashboard client).
- **Organizer summary:** `GET /api/dashboard/memories/:eventId/summary` (window state, accepted
  photo/video totals, distinct uploaders, remaining capacity as a percentage) and
  `GET /api/dashboard/memories/:eventId/qr` (printable SVG). The host projection never carries
  limits, commercial origin or rejection counts.
- **Admin API:** `GET|POST /api/dashboard/admin/memories` (the list carries per-space usage and the
  committed-capacity total), `PATCH /api/dashboard/admin/memories/:eventId` (edit, pause, resume;
  audited with the previous and new `enabled`), and `GET /api/dashboard/admin/memories/:eventId/qr`.
  Admin usage is aggregate only (counts, bytes, dates): administrators never see guest names,
  aliases, object keys, captions or media.
- **Usage sources:** per-space figures come from `event_memory_items` rows that still hold an R2
  object (the same set the reservation quota counts) and from session counts; the committed-capacity
  total compares them with the shared R2 allowance in `CLOUDFLARE_FREE_TIER`
  (`src/lib/platform/contract/limits.ts`). Account-wide consumption is not part of this domain: the
  super-admin platform console (`/dashboard/admin/plataforma`, `src/lib/platform/`) aggregates
  Cloudflare, Supabase, Vercel and Cloudinary limit and cost metrics from read-only credentials
  (`MEMORIES_CLOUDFLARE_*`, `SUPABASE_MANAGEMENT_TOKEN`, `VERCEL_API_TOKEN`, optional
  `CLOUDINARY_USAGE_*`), one query per provider dataset cached for minutes. Shared quotas are
  labeled "de la cuenta" or "del proyecto", never as a single environment; every provider card
  degrades on its own (`ok` / `unconfigured` / `unavailable`) and the report carries aggregates
  only. Free-plan allowances and the 70 %/90 % warning thresholds live in
  `src/lib/platform/contract/limits.ts`.
- **QR:** `src/lib/memories/qr.ts` renders the printable SVG for both dashboard routes and the
  `memories:qr` CLI; a test pins the SHA-256 of the SVG already printed.
- **Planning and warnings:** `event_memory_settings.expected_guests` and `admin_note` are
  administrator-only planning inputs; the reservation RPC never reads them, the note is never
  audited, and neither reaches the host projection. `contract/capacity.ts` turns a quota into photo,
  video and guest estimates from declared reference sizes (assumptions, not measurements) and
  computes the storage a space commits against the shared R2 allowance; the admin form asks for an
  explicit acknowledgement before committing past it. Both dashboards warn
  `MEMORIES_RETENTION_WARNING_DAYS` before retention ends: the host sees a countdown, and the admin
  console flags spaces with accepted files and no recorded host download (`download_requested` audit
  rows by an organizer). That evidence proves a download happened, not that it was complete. No
  automatic email is sent.
- **Data:** `event_memory_settings` (window, retention, quotas, entitlement; `on delete restrict` to
  `events`), `event_memory_sessions`, `event_memory_items`, `event_memory_audit_events`. The
  reservation RPC decides availability, window and every quota under one advisory lock; a single
  retention instant per space expires sessions, catalog rows and objects together. The R2 lifecycle
  rule (`events/`, maximum object lifetime from the contract) is the final backstop.
- **Workers:** `celebra-memories-sign` (`/sign`, `/upload`) and `celebra-memories-retrieve`
  (`/retrieve`) verify ECDSA-signed app requests, enforce the global media policy and never learn
  about events. Upload capabilities are AES-GCM sealed so the browser cannot read object keys.
  `/upload` answers 412 when the object already exists, so a PUT retried after a lost response goes
  on to confirm instead of failing. Video inspection follows the container's top-level boxes with
  ranged reads to the `moov` atom, because phones write it after the media data and its size is
  unbounded; a fixed tail window is only the last resort.
- **Retries and refusals:** the app rounds a video duration to the catalog scale
  (`MEMORIES_VIDEO_DURATION_DECIMALS`) before reserving, so a retried request replays the same row
  instead of conflicting with it. A refused reservation carries `error.details.reason`
  (`MEMORIES_RESERVATION_REFUSALS`) and a Sign Worker throttle surfaces as 429, so the guest copy
  names the limit and what to do. Quota is counted on rows that still hold an R2 object: a deleted,
  rejected, duplicate or abandoned file keeps its slot until the daily cleanup removes the object.
- **Cleanup:** `GET /api/cron/memories-cleanup` (Vercel cron at 15:17 UTC, an off-hour for events in
  Mexico; bearer secret) settles stale in-flight items from storage evidence, expires
  retention-ended spaces, deletes scheduled objects in leased batches within a time budget,
  anonymizes inactive guest sessions after their last object is gone, and purges audit rows.
  Settling never deletes blindly: a validation is rejected and an abandoned reservation released
  only when the Retrieval Worker answers that the object is absent; an upload whose bytes arrived
  without a browser confirmation is validated instead. Because the cron runs once a day, a guest at
  the in-flight limit settles their own items before the reservation is refused. Anonymization is a
  service-role-only, security-invoker RPC that locks the event and session in the same order as
  reservation; a missing RPC fails closed.
