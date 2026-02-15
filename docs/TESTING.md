# Testing Guide

This document describes the testing strategy and practices for the Celebra-me project.

## Overview

To maintain high quality and developer velocity, this project leverages **Husky** and
**lint-staged** for automated local gatekeeping.

| Layer           | Framework                    | Purpose                       |
| --------------- | ---------------------------- | ----------------------------- |
| Unit Tests      | Jest                         | Pure functions, utilities     |
| Component Tests | Jest + React Testing Library | React components              |
| Schema Tests    | Jest + Zod                   | Content collection validation |
| Smoke Tests     | Node.js script               | Build artifact verification   |
| E2E Tests       | Playwright (future)          | Full user flows               |

## Running Tests

### All Tests

```bash
pnpm test
```

### With Verbose Output

```bash
pnpm test -- --verbose
```

### Watch Mode (for development)

```bash
pnpm test -- --watch
```

### Coverage Report

```bash
pnpm test -- --coverage
```

Coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` — Open in browser for detailed view
- `coverage/lcov.info` — For CI integration

### Smoke Test (after build)

```bash
pnpm build
node scripts/smoke-test.js
```

## Test File Organization

```text
tests/
├── setup.ts                 # Global test setup (RTL, mocks)
├── sanity.test.ts           # Basic sanity check
├── api/
│   ├── rsvp.context.test.ts        # RSVP context endpoint tests
│   ├── rsvp.post-canonical.test.ts # RSVP canonical/legacy POST flow tests
│   ├── rsvp.channel.test.ts        # RSVP channel telemetry endpoint tests
│   ├── rsvp.admin.test.ts          # RSVP admin endpoint auth/list tests
│   ├── rsvp.export.test.ts         # RSVP CSV export endpoint tests
│   └── rsvp.invitations.test.ts    # RSVP invitation links endpoint tests
├── utils/
│   └── email.test.ts        # Email utility tests
├── components/
│   ├── RSVP.test.tsx        # RSVP form tests
│   ├── MusicPlayer.test.tsx # Audio player tests
│   └── FAQList.test.tsx     # FAQ list tests
└── content/
    └── schema.test.ts       # Zod schema validation tests
```

## Writing Tests

### Naming Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Place in `tests/` directory mirroring `src/` structure
- Example: `src/utils/email.ts` → `tests/utils/email.test.ts`

### Unit Test Template

```typescript
// tests/utils/myUtil.test.ts
import { myFunction } from '@/utils/myUtil';

describe('myFunction', () => {
	it('should return expected value', () => {
		const result = myFunction(input);
		expect(result).toBe(expectedOutput);
	});

	it('should handle edge case', () => {
		expect(() => myFunction(null)).toThrow();
	});
});
```

### Component Test Template

```typescript
// tests/components/MyComponent.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent prop="value" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('After Click')).toBeInTheDocument();
  });
});
```

## Mocking Patterns

### Mocking Nodemailer (Email Tests)

```typescript
jest.mock('nodemailer');
import nodemailer from 'nodemailer';

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockSendMail = jest.fn();

// In beforeEach
(mockedNodemailer.createTransport as jest.Mock).mockReturnValue({
	sendMail: mockSendMail,
});

// In test
mockSendMail.mockResolvedValue({ messageId: '123' });
```

### Mocking Audio API (MusicPlayer Tests)

Already configured in `tests/setup.ts`:

```typescript
window.HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLAudioElement.prototype.pause = jest.fn();
```

### Mocking SCSS Imports

Configured in `jest.config.cjs` using `identity-obj-proxy`:

```javascript
moduleNameMapper: {
  '\\.scss$': 'identity-obj-proxy',
}
```

### Mocking import.meta.env

Already configured in `tests/setup.ts`:

```typescript
Object.defineProperty(global, 'import', {
	value: {
		meta: {
			env: {
				GMAIL_USER: 'test@gmail.com',
				// ... other env vars
			},
		},
	},
});
```

## What NOT to Test with Jest

| Component Type               | Why                                                           | Alternative                  |
| ---------------------------- | ------------------------------------------------------------- | ---------------------------- |
| Astro components (`.astro`)  | Server-rendered, no runtime JS                                | Smoke test or E2E            |
| SCSS visual output           | Can't verify visual rendering                                 | Visual regression            |
| Full page layouts            | Complex hydration                                             | E2E tests                    |
| API routes (`src/pages/api`) | Supported via handler-level tests with mocked request/context | Jest integration-style tests |

## Coverage Goals

| Metric                      | Target   | Current |
| --------------------------- | -------- | ------- |
| Critical utilities          | 80%+     | —       |
| React components with state | 70%+     | —       |
| Content schemas             | 90%+     | —       |
| Static components           | Optional | —       |

## Smoke Test Checks

The enhanced `scripts/smoke-test.js` verifies:

1. **Required Files** — `index.html`, invitation pages, `_astro/` directory
2. **Asset Bundles** — CSS and JS files in `_astro/`
3. **Meta Tags** — `<title>`, description, Open Graph, viewport
4. **SEO Files** — `robots.txt`, `sitemap-index.xml`
5. **Optimized Images** — WebP/AVIF presence

## CI/CD Integration

Tests run automatically on pull requests. See `.github/workflows/` for configuration.

### Required Checks for PR Merge

- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] Coverage does not decrease

## Troubleshooting

### "Cannot find module '@/...'"

Ensure `jest.config.cjs` has the correct `moduleNameMapper` for your path alias.

### SCSS import errors

Make sure `identity-obj-proxy` is installed and mapped in Jest config.

### Audio API errors

Check that `tests/setup.ts` is listed in `setupFilesAfterEnv` in Jest config.

### Environment variable errors

Verify mocks in `tests/setup.ts` match your code's expected `import.meta.env` keys.
