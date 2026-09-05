---
name: backend-engineering
description:
  Standardize the development of server-side logic, API routes, data validation, and external
  service integration (Supabase, Email) for Celebra-me.
domain: backend
version: 1.1.0
when_to_use:
  - Updating API routes, services, repositories, or server-side validation
  - Reviewing external integrations or server-only code paths
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - API handlers, service layers, repositories, schemas, and integration code
outputs:
  - Layer-safe backend guidance and implementation constraints
related_skills:
  - astro-patterns
  - supabase
related_docs:
  - docs/core/architecture.md
  - docs/domains/rsvp/architecture.md
  - docs/domains/rsvp/database.md
---

# Backend Engineering

Use for API, service, repository, validation, and server integration changes. Read the affected
handler and consumers before choosing the implementation boundary.

## Contracts to load

- [API contract](../../rules/api-contracts.md): response envelopes, CSRF, admin authorization, and
  rate limiting. Use the existing helpers in src/lib/rsvp/core/http.ts and typed ApiError; do not
  introduce a second response shape or expose raw upstream errors.
- [Auth/session contract](../../rules/auth-session.md) when changing authentication transport,
  cookies, token refresh, or middleware.
- [Architecture](../../../docs/core/architecture.md): routes orchestrate HTTP, services own business
  rules, and repositories/adapters own persistence. Extend existing owners; do not add layers solely
  to satisfy an example template.
- [Database safety](../../rules/database.md) before operational database work. Runtime application
  writes and agent-operated database changes have different authority.

## Implementation and verification

1. Trace input validation, authorization, service calls, persistence, and the client-visible result.
   Reuse canonical Zod schemas, bounded request readers, sanitizers, and DTO mappers. Do not create
   ad-hoc phone normalization, guessed field limits, or duplicate response types.
2. Keep credentials and privileged clients server-only. Preserve RLS and authenticated context; use
   service-role access only inside an established, guarded server operation.
3. Preserve public response compatibility, authorization order, optimistic locking, idempotency, and
   atomic publication where applicable. Use existing typed REST wrappers at persistence edges.
4. Verify the changed behavior with focused tests covering success and relevant denial/error paths;
   select broader checks from Gatekeeper. Do not call live services merely to validate local code.

When dependency behavior is uncertain, consult current official documentation for the package.json
version. Framework documentation does not override the repository's API or data contracts.
