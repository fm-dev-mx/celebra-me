# Celebra-me: Testing Standards & Guidelines

This document outlines the testing philosophy and standards for the Celebra-me project.

## 1. Core Principles

- **Reliability First**: Tests must be deterministic. Avoid flaky tests by properly mocking external
  services (Supabase, Mailer).
- **English Documentation**: All technical docs, test names, and comments within `tests/` must be in
  English.
- **Spanish UI Validation**: Since the application is for a Spanish-speaking audience, E2E tests
  must verify that labels, placeholders, and error messages are in Spanish.

## 2. Testing Layers

### Unit Tests (`Jest`)

- Located in `tests/unit/` and `src/**/*.test.ts`.
- Focus on pure functions (validators, data transformers).
- **Goal**: Verify logic without side effects.

### API/Integration Tests (`Jest`)

- Located in `tests/api/` and `tests/integration/`.
- Focus on API routes and middleware.
- Use `fetch` mocking or lightweight Supabase wrappers.
- **Goal**: Verify that API endpoints return correct status codes and data structures.

### End-to-End Tests (`Playwright`)

- Located in `tests/e2e/`.
- Focus on critical user journeys (Login, Registration, MFA).
- **Goal**: Verify that the entire stack works together and the UI is correct.

## 3. Naming Conventions

- **Test files**: `[feature].[type].test.ts` (e.g., `auth.register.test.ts`).
- **Test descriptions**: Use the standard `describe`/`it` or `describe`/`test` blocks.
- **Descriptions format**: `Scenario: [description]`, `Method: [description]`,
  `should [expected behavior]`.

## 4. Running Tests

```bash
# Run all unit and integration tests
pnpm test

# Run a specific test file
pnpm test -- tests/api/auth.test.ts

# Run E2E tests
npx playwright test
```

## 5. UI Localization Assertions

When testing UI elements, use descriptive Spanish strings:

```typescript
// Example Playwright assertion
await expect(page.getByLabel('Correo electrónico')).toBeVisible();
await expect(page.locator('.auth-status')).toContainText('La contraseña es demasiado débil');
```
