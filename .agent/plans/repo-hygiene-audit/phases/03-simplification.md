# Phase 03: Domain Simplification

## Objective

Refactor bloated domain areas and resolve utility duplication to improve discoverability and
maintainability.

## Tasks

- [x] Move contents of `src/lib/utils/` to `src/utils/` and update all imports. [weight: 30%]
- [x] Modularize `src/lib/rsvp` into `auth/`, `services/`, `repositories/`, and `security/`
      subdirectories. [weight: 50%]
- [x] Flatten `src/lib/rsvp/service.ts` if possible (reduce re-export layers). [weight: 20%]

## Acceptance Criteria

- `src/lib/utils` is removed.
- `src/lib/rsvp` is structured into clear sub-domains.
- Unit tests for RSVP still pass.

## References

- Anti-Pattern & Bad Practice Identification (Audit Dimensional 4)
- Simplification Opportunities (Audit Dimensional 5)
