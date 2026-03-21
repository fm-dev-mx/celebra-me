# Phase 01: Runtime Readiness Contract

## Objective

Bring the executable lifecycle in line with the intended plan states:

- draft plans may exist
- gatekeeper execution requires explicit readiness
- planned headers must be canonical

## Delivered

- updated active-plan validation semantics
- blocked `inspect` when active units are not gatekeeper-ready
- blocked non-canonical `messagePreview.header` values during scaffold/commit
