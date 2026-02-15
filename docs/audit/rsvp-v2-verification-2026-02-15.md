# RSVP v2 Verification Report (2026-02-15)

## Scope

- `src/lib/rsvp-v2/**`
- `src/pages/api/dashboard/**`
- `src/pages/api/invitacion/**`
- `src/pages/dashboard/invitados.astro`
- `src/pages/admin/rsvp.astro`
- `src/pages/[eventType]/[slug].astro`
- RSVP v2 tests under `tests/api`, `tests/lib`, `tests/components`

## Traceability Matrix

| Plan Item                                      | Status  | Evidence                                                                                                                                                                                                             |
| ---------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSE + fallback dashboard                       | Done    | `src/pages/api/dashboard/guests/stream.ts`, `src/components/dashboard/guests/GuestDashboardApp.tsx`                                                                                                                  |
| Uniform API errors `{code,message,details?}`   | Done    | `src/lib/rsvp-v2/http.ts`, dashboard/invitacion endpoints                                                                                                                                                            |
| Ownership and RLS protections                  | Partial | SQL policies in `supabase/migrations/20260215000400_rsvp_v2_rls.sql`, guard logic in `src/lib/rsvp-v2/service.ts`; requires integration verification in deployed DB                                                  |
| `/context` side-effect free + `/view` explicit | Done    | `src/pages/api/invitacion/[inviteId]/context.ts`, `src/pages/api/invitacion/[inviteId]/view.ts`                                                                                                                      |
| Distributed rate limiting                      | Partial | `src/lib/rsvp-v2/rateLimitProvider.ts` with Upstash adapter + in-memory fallback; depends on env flags in runtime                                                                                                    |
| Legacy `?t=` bridge                            | Done    | `src/pages/[eventType]/[slug].astro`, `src/pages/api/invitacion/resolve.ts`                                                                                                                                          |
| Login flow host/admin consistency              | Partial | Host redirect exists (`src/pages/dashboard/invitados.astro`), dual login/register UI in `src/pages/login.astro`, auth APIs in `src/pages/api/auth/*`, admin legacy remains Basic Auth (`src/pages/admin/rsvp.astro`) |

## Obsolete / Redundant / Coupled Inventory

### Obsolete Candidates

1. `src/pages/api/rsvp/*.ts`

- Reason: legacy API surface duplicates RSVP v2 behavior.
- Decision: `Mantener temporal` until cutover metrics (>95% v2 traffic).

2. `src/pages/admin/rsvp.astro`

- Reason: legacy admin UI with Basic Auth.
- Decision: `Mantener temporal` with explicit legacy banner and deprecation path.

### Redundant Areas

1. RSVP legacy and v2 run in parallel:

- `src/lib/rsvp/*` and `src/lib/rsvp-v2/*`.
- Decision: `Migrar` consumers to v2 and freeze legacy with no new features.

2. Rate-limit implementations:

- `src/lib/rsvp-v2/rateLimit.ts` and `src/lib/rsvp-v2/rateLimitProvider.ts`.
- Decision: `Deprecado` `rateLimit.ts` como shim temporal; remover en próximo ciclo.

### Coupled Hotspots

1. Legacy token bridge:

- `src/pages/[eventType]/[slug].astro` -> `/api/invitacion/resolve` ->
  `resolveLegacyTokenToCanonicalUrl`.
- Decision: `Encapsular` and keep only until migration cutoff.

2. Auth UX split host/admin:

- Host uses Supabase session, admin uses Basic Auth.
- Decision: `Migrar` to single host auth flow with role-based access.

## Login/UI Admin Verification

### Current State

- Host dashboard guard:
    - redirects unauthenticated users to `/login?next=/dashboard/invitados`.
- Login route:
    - now exists as `src/pages/login.astro`.
    - documents next-step return path and legacy admin notice.
- Admin legacy:
    - `src/pages/admin/rsvp.astro` still requires Basic Auth.
    - now labeled as legacy temporary mode.

### Inconsistencies

1. There is no fully integrated Supabase hosted sign-in page in this repo UI.
2. Host and admin currently use different auth mechanisms.

## Test Verification Summary

- Baseline v2 suites pass (dashboard/invitacion/service/auth).
- Added targeted suites for:
    - stream endpoint,
    - export endpoint,
    - legacy resolve endpoint,
    - rate-limit provider,
    - stream bus,
    - repository mappings,
    - supabase REST wrapper,
    - auth-flow and login helpers,
    - dashboard UI unauthorized state.

### Coverage Snapshot (focused run)

Command:

`pnpm test:rsvp-v2:coverage`

Results:

- `src/lib/rsvp-v2/*`: `77.21%` lines (`73.49%` statements).
- `src/pages/api/dashboard/*`: `~85.54%` lines in nested guests endpoints y `95.83%` in root
  dashboard endpoints.
- `src/pages/api/invitacion/*`: `92.85%` + `90.32%` lines.

Interpretation:

- Dashboard and invitacion API targets are above objective.
- `lib/rsvp-v2` reached line coverage objective (`>=70%`) in focused run.
- Remaining debt is mostly branch/function coverage in `service.ts` and `repository.ts`.

## Residual Risks

1. Branch/function coverage in `service.ts` and `repository.ts` still has room to improve despite
   line target achieved.
2. Distributed rate-limit remains partial without production env/Upstash validation.
3. Legacy bridge and legacy APIs keep migration coupling alive until cutover.
