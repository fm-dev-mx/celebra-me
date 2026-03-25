# Celebra-me Testing Guide

This directory contains the automated test suites for the public site, invitation flows, dashboard
flows, and supporting libraries.

## Principles

- Tests should be deterministic and isolate external systems with mocks or fixtures.
- Test names, comments, and supporting docs in `tests/` stay in English.
- UI-facing assertions should validate Spanish copy when they cover user-visible text.

## Current Test Layout

```text
tests/
├── api/          # API handlers for auth, dashboard, and invitacion flows
├── components/   # React island/component tests
├── content/      # Content-schema validation tests
├── e2e/          # Playwright scenarios and premium invitation audits
├── fixtures/     # Fixture repos and governance test fixtures
├── helpers/      # Shared test-only helpers
├── integration/  # Cross-module integration tests such as middleware
├── lib/          # Library and service-layer tests
├── mocks/        # Shared mocks
├── unit/         # Pure unit tests
├── utils/        # Utility helper tests
├── setup.ts      # Global Jest setup
└── sanity.test.ts
```

## Active Test Layers

| Layer       | Primary Tooling              | Current Scope                                           |
| ----------- | ---------------------------- | ------------------------------------------------------- |
| Unit        | Jest                         | helpers, adapters, validation, commit/tooling contracts |
| Component   | Jest + React Testing Library | interactive React islands and client helpers            |
| API         | Jest                         | `src/pages/api/**` request/response behavior            |
| Integration | Jest                         | middleware and multi-module flows                       |
| Content     | Jest + Zod                   | content collection and schema contracts                 |
| E2E         | Playwright                   | login scenarios and invitation UX audits                |

## Commands

```bash
pnpm test
pnpm test -- --coverage
pnpm test -- tests/api/auth.endpoints.test.ts
pnpm exec playwright test
```

## Naming Guidance

- Keep file names descriptive and feature-first, such as `dashboard.guests.happy.test.ts`.
- Use `describe`/`it` or `describe`/`test`.
- Prefer scenario-oriented descriptions that state the expected behavior.

## Fixture Guidance

- Put reusable repo fixtures under `tests/fixtures/`.
- Keep mocks and helpers under `tests/mocks/` and `tests/helpers/`.
- When a test relies on a real route pattern, mirror the current public surface instead of legacy
  aliases.
