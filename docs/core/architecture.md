# Architecture — Celebra-me

This document describes the **current architectural model** of Celebra-me.

It defines the active system boundaries used by the repository today and should be treated as an
evergreen source of truth for route structure, server boundaries, content flow, and invitation
rendering.

---

## 1) Architectural Principles

Celebra-me follows these guiding principles:

- **Hybrid by default** Static generation (SSG) is preferred. Server-side rendering (SSR) is used
  only when required by the feature.
- **Pragmatism over theory** Patterns are applied only when they reduce real complexity.
- **Explicit boundaries** UI code, route orchestration, and server-only logic stay separated.
- **Deploy safety first** Architecture must remain compatible with Astro and Vercel constraints.

---

## 2) Astro Execution Model

### Default Strategy

- Pages render at build time whenever possible.
- Runtime server execution is reserved for:
  - user input,
  - side effects,
  - protected operations,
  - integrations requiring secrets.
- Current realtime behavior uses **Server-Sent Events (SSE)** via `/api/dashboard/guests/stream` for
  near-real-time host dashboard updates.

This matches Astro's hybrid model and the repository's current route structure.

---

## 3) Pages, Layouts, and Components

### 3.1 Pages (`src/pages/**`)

- Astro pages define public routes using file-based routing.
- Public invitation rendering lives under:
  - `src/pages/[eventType]/[slug].astro`
  - `src/pages/[eventType]/[slug]/invitado.astro`
  - `src/pages/[eventType]/[slug]/i/[shortId].astro`
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
- `src/utils/**` for shared utilities such as invitation-link and environment helpers

Historical note:

- Historical only: older documentation and audit logs may reference retired route-assembly or legacy
  server-helper paths; those paths are not active architectural hubs in the current tree.

### 5.3 Global Logic

- `src/middleware.ts`: session orchestration, AAL2 enforcement, and route-level authorization
- `src/data/`: static global data and schema-less configuration
- `src/interfaces/`: shared contracts and UI-facing interfaces

These modules must never be imported by purely client-side presentation code when doing so would
pull in server concerns.

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

Astro content collections (`src/content/**`) are used for:

- declarative structured event content,
- public demos,
- internal event templates.

### Active Collection Layout

- `src/content/events/*.json` for live routable events
- `src/content/event-demos/**.json` for showcase demos
- `src/content/event-templates/**.json` for internal master templates

### Rules

- Content remains logic-free.
- Validation and typing are defined through `src/content/config.ts`.
- Runtime behavior must not depend on undocumented ad-hoc content fields.

---

## 8) Styling Architecture

- **SCSS only** for maintained style files.
- **Theme contract driven** variants come from `src/lib/theme/theme-contract.ts`.
- **Logic-based structure**:
  - `src/styles/tokens/` for primitive and semantic tokens
  - `src/styles/themes/` for presets and section themes
  - `src/styles/components/` for shared UI styles
  - `src/styles/invitation/` for invitation section/layout styles
  - `src/styles/dashboard/` for dashboard shell/components
  - `src/styles/events/` for event-specific overrides

### 8.1 Preset Strategy

- Presets are class-scoped through `.theme-preset--{name}` selectors.
- Invitation routes consume preset classes generated from normalized event content.
- Live preset and variant contracts are defined by `src/lib/theme/theme-contract.ts`, not by
  free-form documentation lists.

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
- `/dashboard/eventos`
- `/dashboard/claimcodes`
- `/dashboard/usuarios`
- `/dashboard/admin`
- `/dashboard/mfa-setup`

### Host Dashboard API Endpoints

- `GET /api/dashboard/guests?eventId=...&status=...&search=...`
- `GET /api/dashboard/guests/stream`
- `POST /api/dashboard/guests`
- `PATCH /api/dashboard/guests/:guestId`
- `DELETE /api/dashboard/guests/:guestId`
- `POST /api/dashboard/guests/:guestId/mark-shared`
- `GET /api/dashboard/guests/export.csv?eventId=...`
- `GET /api/dashboard/events`
- `GET /api/dashboard/claimcodes`
- `GET /api/dashboard/admin/events`
- `GET /api/dashboard/admin/users`

### Guest Invitation Access

The active guest-facing patterns are:

- `/{eventType}/{slug}/invitado?invite={inviteId}` for direct personalized access
- `/{eventType}/{slug}/i/{shortId}` for short-link resolution
- `/api/invitacion/:inviteId/context`
- `/api/invitacion/:inviteId/rsvp`
- `/api/invitacion/:inviteId/view`

Historical note:

- Older documents may reference `/invitation/{inviteId}` or `/api/invitation/*`. Those patterns are
  no longer the current public contract.

Detailed RSVP design and constraints are documented in `docs/domains/rsvp/architecture.md`.
