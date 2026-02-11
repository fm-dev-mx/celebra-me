---
name: testing
description:
    Write and maintain tests for Celebra-me using Jest, React Testing Library, and Playwright.
    Covers unit tests, component tests, schema validation, and E2E patterns.
---

> **Related skills**: [`astro-patterns`](../astro-patterns/SKILL.md) for understanding what requires
> E2E vs unit tests, [`accessibility`](../accessibility/SKILL.md) for a11y testing queries.

This skill guides testing practices for the Celebra-me project, ensuring code reliability and
preventing regressions.

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

| Command                      | Purpose                 |
| ---------------------------- | ----------------------- |
| `pnpm test`                  | Run all tests           |
| `pnpm test -- --verbose`     | Verbose output          |
| `pnpm test -- --watch`       | Watch mode              |
| `pnpm test -- --coverage`    | Coverage report         |
| `node scripts/smoke-test.js` | Post-build verification |

## Test File Conventions

- **Naming**: `*.test.ts` or `*.test.tsx`
- **Location**: Mirror `src/` structure in `tests/`
- **Example**: `src/utils/email.ts` → `tests/utils/email.test.ts`

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

### Mocking SendGrid (Email)

```typescript
jest.mock('@sendgrid/mail', () => ({
	setApiKey: jest.fn(),
	send: jest.fn(),
}));

import sgMail from '@sendgrid/mail';
const mockedSgMail = sgMail as jest.Mocked<typeof sgMail>;

beforeEach(() => {
	jest.clearAllMocks();
});

it('should send email successfully', async () => {
	mockedSgMail.send.mockResolvedValue([{ statusCode: 202, headers: {}, body: '' }, {}]);
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

| Component Type              | Reason                         | Alternative       |
| --------------------------- | ------------------------------ | ----------------- |
| Astro components (`.astro`) | Server-rendered, no runtime JS | Smoke test or E2E |
| SCSS visual output          | Can't verify visual rendering  | Visual regression |
| Full page layouts           | Complex hydration              | E2E tests         |
| API routes                  | Need server context            | Integration tests |
| Browser-specific APIs       | Need real browser              | E2E tests         |

## Smoke Test Checks

The `scripts/smoke-test.js` validates build output:

1. **Required Files** — `index.html`, invitation pages, `_astro/`
2. **Asset Bundles** — CSS and JS files present
3. **Meta Tags** — `<title>`, description, Open Graph, viewport
4. **SEO Files** — `robots.txt`, `sitemap-index.xml`
5. **Optimized Images** — WebP/AVIF presence

## E2E Testing (Future)

When Playwright is set up:

```tsx
// e2e/invitation.spec.ts
import { test, expect } from '@playwright/test';

test('XV invitation loads correctly', async ({ page }) => {
	await page.goto('/xv/demo-xv');

	// Check countdown is visible
	await expect(page.locator('.countdown')).toBeVisible();

	// Check RSVP form
	await expect(page.getByRole('heading', { name: /celebrar/i })).toBeVisible();
});

test('RSVP form submission', async ({ page }) => {
	await page.goto('/xv/demo-xv');

	// Select attendance
	await page.getByLabel(/Sí, asistiré/i).click();

	// Submit
	await page.getByRole('button', { name: /Confirmar/i }).click();

	// Check confirmation
	await expect(page.getByText(/Gracias por confirmar/i)).toBeVisible();
});
```

## Verification Checklist

Before submitting a PR:

- [ ] All tests pass (`pnpm test`)
- [ ] New utilities have corresponding tests
- [ ] React components with state have tests
- [ ] Coverage does not decrease
- [ ] Smoke test passes after build
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
