# Phase 04: Complexity Reduction

## Objective

Reduce cyclomatic complexity in application code by extracting pure helpers, section-specific
builders, and narrow validation flows.

## Target Areas

- `src/components/invitation/RSVP.tsx`
- `src/components/invitation/InvitationSections.astro`
- `src/lib/adapters/event.ts`
- `src/lib/invitation/page-data.ts`
- `src/middleware.ts`
- `src/pages/api/auth/register-host.ts`

## Planned Actions

- Split high-branch functions into domain-specific helpers.
- Separate validation, mapping, and side effects.
- Preserve public interfaces unless simplification is explicitly validated.

## Exit Criteria

- Complexity findings in application code fall at or below the enforced threshold.
