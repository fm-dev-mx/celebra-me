# RSVP Documentation Alignment Audit

Date: 2026-02-15  
Scope: `README.md`, `docs/DB_RSVP.md`, `docs/RSVP_STATUS.md`, `docs/TESTING.md`, `package.json`,
`supabase/*`, `src/lib/rsvp/*`, `src/pages/api/rsvp/*`.

## Objective

Validate that RSVP/Supabase documentation is aligned with:

1. the current codebase behavior,
2. operational runbook reality, and
3. active migration/security model.

## Method

- Extracted operational claims from docs.
- Cross-checked claims against code and scripts.
- Validated migration status against Supabase remote project.
- Verified critical RSVP test suite command.

## Findings

### Critical

None.

### Major

1. `docs/DB_RSVP.md` referenced `npx supabase ...` as the operational interface, while project
   scripts and runbook currently use `supabase ...` directly.
2. `docs/TESTING.md` stated API routes should not be tested with Jest, which is no longer true given
   existing RSVP API suites.

### Minor

1. `README.md` documentation section did not explicitly list RSVP operational docs.
2. Proxy failure mode (`127.0.0.1:9`) observed in real execution was undocumented.

## Remediation Applied

1. Updated `docs/DB_RSVP.md`:

- replaced legacy `npx supabase` references with `supabase` CLI usage.
- added connectivity troubleshooting for proxy-related failures.

2. Updated `docs/TESTING.md`:

- added `tests/api/*` coverage to test organization.
- corrected guidance for API route testing.

3. Updated `README.md`:

- added explicit links to `docs/DB_RSVP.md` and `docs/RSVP_STATUS.md`.

## Runtime Validation Evidence

1. Supabase project linked successfully (`ineitkdkyrxqyressllp`).
2. `supabase db push` applied:

- `20260215000100_rsvp_init.sql`
- `20260215000200_rsvp_hardening.sql`

3. `supabase migration list` confirmed local/remote alignment.
4. RSVP critical API tests passed:

- `tests/api/rsvp.context.test.ts`
- `tests/api/rsvp.post-canonical.test.ts`
- `tests/api/rsvp.channel.test.ts`
- `tests/api/rsvp.admin.test.ts`
- `tests/api/rsvp.export.test.ts`

## Current Source-of-Truth Map

- DB schema and security: `supabase/migrations/*`
- DB operations runbook: `docs/DB_RSVP.md`
- RSVP release/operational state: `docs/RSVP_STATUS.md`
- Test policy and examples: `docs/TESTING.md`
- Entry-point onboarding: `README.md`

## Remaining Risks

1. Public RSVP endpoints still have no rate limiting (already documented as residual risk).
2. Local shell proxy variables may break Supabase CLI in some environments if not normalized.
