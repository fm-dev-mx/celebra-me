# Phase 04: Backend Security and RLS Hardening

## Status

`PENDING`

## Objective

Reduce or isolate service-role usage and align the RSVP repository layer with the documented JWT and
RLS model.

## Current-State Evidence

- `src/lib/rsvp/` contains multiple `useServiceRole: true` call sites across repository and support
  modules.
- `docs/domains/rsvp/architecture.md` states host operations should use authenticated user JWT and
  RLS.
- `docs/domains/rsvp/database.md` documents enforced RLS on RSVP tables.

## Entry Criteria

- Phase 03 is complete.
- Current RSVP architecture, database, and security docs have been reviewed.

## Audit Scope

- `src/lib/rsvp/**/*`
- `src/pages/api/dashboard/**/*`
- `src/pages/api/invitacion/**/*`
- `supabase/migrations/**/*`
- `supabase/verification/rsvp_schema_checks.sql`

## Tasks

1. Inventory all service-role usage and classify each call site.
2. Identify unjustified bypasses versus acceptable privileged boundaries.
3. Remediate least-privilege violations.
4. Update the documented architecture for public, host, and admin access paths.
5. Verify RSVP flows and repository behavior.

## Cross-Phase Gates

- Verification
- Accessibility for any touched auth or dashboard surfaces
- SEO for touched public invitation resolution flows
- Documentation sync
- Evidence capture

## Verification

- `pnpm lint`
- `pnpm type-check`
- `pnpm test:rsvp`

## Docs To Sync

- `.agent/plans/comprehensive-audit-Q1-2026/README.md`
- `.agent/plans/comprehensive-audit-Q1-2026/manifest.json`
- `.agent/plans/comprehensive-audit-Q1-2026/CHANGELOG.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/rsvp/database.md`
- `docs/domains/rsvp/status.md`
- `docs/domains/security/roadmap.md`
- `docs/audit/implementation-log.md`

## Exit Criteria

- Service-role usage is inventoried and justified or remediated.
- Documentation clearly distinguishes public, host, and privileged access patterns.
- Verification passes.
- Plan-level and project-level docs are synchronized.
- A phase completion report is delivered and the audit pauses for user acknowledgment.
