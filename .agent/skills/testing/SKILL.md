---
name: testing
description:
  Write and maintain tests for Celebra-me using Jest, React Testing Library, and Playwright. Covers
  unit tests, component tests, schema validation, and E2E patterns.
domain: quality
version: 1.0.0
when_to_use:
  - Adding or updating automated tests
  - Choosing regression coverage for a code change
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Source code changes, risk areas, and existing test suites
outputs:
  - Test strategy, test patterns, and framework-specific guidance
related_skills: []
related_docs:
  - docs/core/project-conventions.md
  - docs/domains/invitations/reveal-gate-automation.md
---

# Testing

> **Related skills**: [`astro-patterns`](../astro-patterns/SKILL.md) for understanding what requires
> E2E vs unit tests, [`accessibility`](../accessibility/SKILL.md) for a11y testing queries.

This skill guides testing practices for the Celebra-me project, ensuring code reliability and
preventing regressions.

## Current Library Docs (Context7)

When Jest, React Testing Library, Playwright, or related matcher APIs are uncertain, consult current
library docs via Context7 (or the runtime's equivalent docs MCP) using the versions pinned in
`package.json`. Do not add a repo-local Context7 skill. Prefer existing repo test patterns when they
differ from generic examples.

## Test Organization

```plaintext
tests/
├── setup.ts                 # Global test setup (RTL, mocks)
├── sanity.test.ts           # Basic sanity check
├── utils/
│   └── email.test.ts        # Utility function tests
├── components/
│   ├── RSVP.test.tsx        # Form component tests
│   ├── MusicPlayer.test.tsx # Audio player tests
│   └── FAQList.test.tsx     # List component tests
└── content/
    └── schema.test.ts       # Zod schema validation
```

## Running Tests

| Command                   | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `pnpm validate:changed`   | Working-tree validation, including related Jest |
| `pnpm validate:staged`    | Staged-index pre-commit validation              |
| `pnpm test:changed`       | Standalone related Jest for staged source files |
| `pnpm test`               | Run all tests                                   |
| `pnpm test -- --verbose`  | Verbose output                                  |
| `pnpm test -- --watch`    | Watch mode                                      |
| `pnpm test -- --coverage` | Coverage report                                 |
| `pnpm build`              | Build validation                                |

Select the proportional tier from `.agent/rules/gatekeeper.md` and **name that tier (A/B/C) plus
intentional skips** in the closing report. Do not run `pnpm run ci`, full `pnpm test`, or `pnpm build`
for tier A/B work unless risk escalates. Prefer `pnpm type-check` or focused domain checks over a
full Astro build when only contracts/types need proof (`pnpm build` already re-runs type-check).

Do not follow `pnpm validate:changed` with `pnpm test:changed`; the former already runs Jest
`--findRelatedTests` for changed source files. Reserve the full test suite and build for the
contracts and release checkpoints that require them. When unrelated user-owned changes are in the
working tree, validate explicit task files instead of widening the run to all changed files.

For screenshots and browser proof, follow gatekeeper §5.3 (Visual evidence) and
[`scripts/screenshot/README.md`](../../../scripts/screenshot/README.md) agent recipes. Do not
generalize the five-viewport matrix in `docs/domains/theme/section-intersections.md` to unrelated
UI work.

## Test File Conventions

- **Naming**: `*.test.ts` or `*.test.tsx`
- **Location**: Mirror `src/` structure in `tests/`
- **Example**: `src/utils/email.ts` → `tests/utils/email.test.ts`

## Invitation Copy Assertions

Anti-pattern: **brittle / content-coupled** asserts on host-editable invitation fields (also called
**fragile** tests when they break on editor-only wording changes). Required property for contract /
pipeline / schema / parity suites: **editor-resilient** — they must still pass when invitation
wording changes if structure and propagation remain correct. Intentional exception: named
**content-golden** suites.

Do not couple pipeline/contract coverage to exact editable invitation wording (labels, titles,
phrases, venue names, section copy, and similar host/editor fields).

| Test kind                                                    | Exact invitation copy? | Rule                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pipeline / adapter / descriptor / projection contracts       | No                     | Assert shape, presence/absence, and value propagation: read the value from the fixture/source under test and expect the same value downstream.               |
| Schema allowlist / “parity” fixtures                         | No                     | Use synthetic tokens (`'Honoree'`, `'Open invitation'`). Assert Zod `success`, `toHaveProperty` / unknown-key rejection, enums, and numeric ranges — never client Spanish from a named invitation. |
| Local unit fixtures owned by the test                        | Yes                    | Allowed when the test defines the input and asserts against that same input (prefer named constants; avoid copy-pasting live client wording).                 |
| Invitation content golden / published-content regression     | Yes, when intentional  | Allowed only when the test’s stated purpose is content fidelity for a named fixture; name/describe it as such. Failures mean the wording changed on purpose. |
| Product/system defaults (non-client editable UI/system copy) | Yes                    | Allowed.                                                                                                                                                     |

Editor edits to DB drafts do not by themselves fail provision/fixture-based suites. Do not invent
editor-sync requirements for those tests.

**Acceptance check:** a contract/pipeline test still passes if invitation wording in its source
fixture changes, provided structure and propagation remain correct.

**Author checklist:** would this test fail solely because a host renamed a tooltip or venue in the
editor or package? If yes, reclassify the assert (propagation / shape / enum) or move exact copy
into a named content-golden suite under `tests/content/<slug>-payload.test.ts`.

### Preferred contract patterns

```typescript
// Propagation (good): same constant in / out
const TEASER = 'Sample teaser';
expect(saved.teaserDetails).toBe(baseline.teaserDetails); // or TEASER

// Shape / allowlist (good)
expect(InvitationEditorSectionSchemas.envelope.safeParse(payload).success).toBe(true);
expect(parsed.data).toHaveProperty('revealVariant');

// Literal client copy in a contract suite (bad)
expect(saved.tooltipText).toBe('ABRIR LA INVITACIÓN');
```

Golden content fidelity stays in `tests/content/<slug>-payload.test.ts` (or an equivalently named
describe). Do not embed real client Spanish in schema/mapper/provision contract fixtures “for
parity.”

## Regression locks after remediation

Used by [`.agent/workflows/error-remediation.md`](../../workflows/error-remediation.md) after VERIFY
PASS (`REGRESSION_DECISION`). Choose the smallest lock that closes the defect class; do not default
to E2E or full-invitation corpus.

| Defect class | Preferred lock | Notes |
| --- | --- | --- |
| `trivial` | `none` | Typo, unused, import, lint — VERIFY of the failing command is enough |
| `local-behavior` | `extend-existing-test` or `add-focused-test` | Unit/contract first (pure function, Zod, adapter) |
| `shared-contract` | `extend-existing-test` or `domain-validate` | Schema, mapper, parity, invitation-preparation scripts |
| `family-extension` | Family invariant (synthetic matrix / schema / parity) | Invitations, sections, variants — one generative rule, not N client goldens |

Layer order: unit/contract → domain validate → RTL → E2E/screenshot last (gatekeeper §5.3 for visual
evidence). Any lock written during remediation **must** pass the Invitation Copy Assertions author
checklist above. If the right lock is large or cross-cutting, choose `escalate-test-gap` instead of
shipping a brittle or oversized suite.

## Unit Test Patterns

### Testing Pure Functions

```typescript
import { myFunction } from '@/utils/myUtil';

describe('myFunction', () => {
  it('should return expected value for valid input', () => {
    expect(myFunction('valid')).toBe('expected');
  });

  it('should handle edge cases gracefully', () => {
    expect(myFunction(null)).toBeNull();
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(-1)).toThrow();
  });
});
```

### Testing Async Functions

```typescript
describe('asyncFunction', () => {
  it('should resolve with data', async () => {
    const result = await asyncFunction();
    expect(result).toEqual({ success: true });
  });

  it('should reject on error', async () => {
    await expect(asyncFunction('bad')).rejects.toThrow('Error message');
  });
});
```

## Component Test Patterns

### Basic Rendering

```tsx
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render with required props', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### User Interactions

```tsx
import userEvent from '@testing-library/user-event';

it('should handle click events', async () => {
  const user = userEvent.setup();
  const handleClick = jest.fn();

  render(<Button onClick={handleClick}>Click Me</Button>);
  await user.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Form Testing

```tsx
it('should validate form inputs', async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  // Fill form
  await user.type(screen.getByLabelText(/name/i), 'John');
  await user.type(screen.getByLabelText(/email/i), 'john@test.com');

  // Submit
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Assert
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

## Mocking Patterns

### Mocking Nodemailer (Email)

```typescript
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

import nodemailer from 'nodemailer';
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('should send email successfully', async () => {
  const transport = { sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }) };
  mockedNodemailer.createTransport.mockReturnValue(transport as never);
  const result = await sendEmail(payload);
  expect(result).toBe(true);
});
```

### Mocking Audio API

Already configured in `tests/setup.ts`:

```typescript
window.HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLAudioElement.prototype.pause = jest.fn();
window.HTMLAudioElement.prototype.load = jest.fn();
```

### Mocking SCSS Imports

Configured in `jest.config.cjs`:

```javascript
moduleNameMapper: {
  '\\.scss$': 'identity-obj-proxy',
}
```

### Mocking import.meta.env

Configured in `tests/setup.ts`:

```typescript
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        SENDGRID_API_KEY: 'test-api-key',
        EMAIL_TO: 'test@example.com',
        EMAIL_FROM: 'noreply@test.com',
        SMTP_HOST: 'smtp.test.local',
      },
    },
  },
});
```

## Schema Validation Tests

### Testing Zod Schemas

```typescript
import { z } from 'zod';

const eventSchema = z.object({
  title: z.string(),
  date: z.string().datetime(),
});

describe('Event Schema', () => {
  it('should validate correct data', () => {
    const result = eventSchema.safeParse({
      title: 'Test',
      date: '2025-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = eventSchema.safeParse({
      title: 'Test',
      date: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
```

## What NOT to Test with Jest

| Component Type              | Reason                         | Alternative             |
| --------------------------- | ------------------------------ | ----------------------- |
| Astro components (`.astro`) | Server-rendered, no runtime JS | Build validation or E2E |
| SCSS visual output          | Can't verify visual rendering  | Visual regression       |
| Full page layouts           | Complex hydration              | E2E tests               |
| API routes                  | Need server context            | Integration tests       |
| Browser-specific APIs       | Need real browser              | E2E tests               |

## Build Validation

Use `pnpm build` when a change affects route assembly, static assets, or metadata generation.

## E2E Testing (Playwright)

Playwright is configured; specs live in `tests/e2e/`. Run them through the `test:e2e*` scripts in
`package.json`.

```ts
// tests/e2e/invitation.spec.ts
import { test, expect } from '@playwright/test';

test('XV invitation loads correctly', async ({ page }) => {
  await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');

  await expect(page.locator('.countdown')).toBeVisible();
  await expect(page.getByRole('heading', { name: /celebrar/i })).toBeVisible();
});
```

### Invitation reveal gate

Public invitation routes render a reveal gate (sealed envelope or editorial cover) in front of the
content. Never drive it with a bare `click()` plus a fixed sleep: the real open transition takes
~3.2–3.4 s, and a short sample reports a false hang or, worse, measures a gated page as if it were
open.

Use `?skipEnvelope=true` for any spec that is not testing the transition itself, and wait on
`data-reveal-state` with a bounded `waitForFunction` that throws on timeout. The supported URL
contract, the state values, a copy-pasteable helper, and stuck-at-`sealed` diagnosis live in
[`docs/domains/invitations/reveal-gate-automation.md`](../../../docs/domains/invitations/reveal-gate-automation.md).

## Verification Checklist

Before submitting a PR:

- [ ] The Gatekeeper validation tier selected for the change passes
- [ ] The full suite passes when the change is at a pre-push or pre-deploy checkpoint
- [ ] New utilities have corresponding tests
- [ ] React components with state have tests
- [ ] If coverage was executed, the relevant coverage does not decrease
- [ ] Behavior changes cover the success path and the relevant denial/error path, or document why a
      path is not applicable
- [ ] Build validation passes when route assembly or assets changed
- [ ] No console errors in tests

## Coverage Thresholds

| Category                        | Target   | Priority |
| ------------------------------- | -------- | -------- |
| Critical utilities (`email.ts`) | 80%+     | High     |
| React components with state     | 70%+     | Medium   |
| Content schemas                 | 90%+     | Medium   |
| Static display components       | Optional | Low      |

## Troubleshooting

### "Cannot find module '@/...'"

Ensure `jest.config.cjs` has correct `moduleNameMapper`:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### SCSS import errors

Verify `identity-obj-proxy` is installed and mapped.

### Audio API errors

Check `tests/setup.ts` is in `setupFilesAfterEnv`.

### Environment variable errors

Update mocks in `tests/setup.ts` to match expected keys.
