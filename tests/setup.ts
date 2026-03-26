// tests/setup.ts
// Jest setup file for React Testing Library

import '@testing-library/jest-dom';
import React from 'react';

/**
 * Fetch API Polyfills for JSDOM
 * JSDOM does not provide Response, Request, or Headers globals by default.
 * Since we are on Node 20, we can pull them from globalThis if they are missing.
 */
if (typeof global.Response === 'undefined') {
	// Attempt to get from globalThis (Node 18+)
	if (typeof globalThis.Response !== 'undefined') {
		global.Response = globalThis.Response as unknown as typeof Response;
	} else {
		// Minimal polyfill for JSDOM environments where Response is missing
		global.Response = class Response {
			headers: Headers;
			ok: boolean;
			statusText: string = 'OK';
			constructor(
				public body: unknown,
				public init: ResponseInit = {},
			) {
				this.headers = new Headers(init.headers);
				const status = init.status || 200;
				this.ok = status >= 200 && status < 300;
			}
			get status() {
				return this.init.status || 200;
			}
			async json(): Promise<unknown> {
				return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
			}
			async text(): Promise<string> {
				return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
			}
		} as unknown as typeof Response;
	}
}
if (typeof global.Request === 'undefined') {
	if (typeof globalThis.Request !== 'undefined') {
		global.Request = globalThis.Request as unknown as typeof Request;
	} else {
		global.Request = class Request {
			headers: Headers;
			method: string;
			url: string;
			constructor(
				input: string | Request,
				public init: RequestInit = {},
			) {
				this.url = typeof input === 'string' ? input : input.url;
				this.headers = new Headers(init.headers);
				this.method = init.method || 'GET';
			}
			async text(): Promise<string> {
				return (this.init.body as string) || '';
			}
			async json(): Promise<unknown> {
				return JSON.parse((this.init.body as string) || '{}');
			}
		} as unknown as typeof Request;
	}
}
if (typeof global.Headers === 'undefined' && typeof globalThis.Headers !== 'undefined') {
	global.Headers = globalThis.Headers as unknown as typeof Headers;
}

/**
 * Environment variables for tests.
 * Standardizing import.meta.env mock for Vite/Astro compatibility in Jest.
 */
Object.defineProperty(global, 'import', {
	value: {
		meta: {
			env: {
				SENDGRID_API_KEY: 'test-api-key',
				EMAIL_TO: 'test@example.com',
				EMAIL_FROM: 'noreply@test.com',
				...process.env,
			},
		},
	},
	configurable: true,
});

process.env.GMAIL_USER ??= 'test@gmail.com';
process.env.GMAIL_PASS ??= 'test-pass';
process.env.CONTACT_FORM_RECIPIENT_EMAIL ??= 'recipient@test.com';

// Mock window.matchMedia for responsive component tests
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: jest.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(), // Deprecated but still used by some libs
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Mock HTMLAudioElement for MusicPlayer tests (guarded)
if (window.HTMLAudioElement?.prototype) {
	window.HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
	window.HTMLAudioElement.prototype.pause = jest.fn();
	window.HTMLAudioElement.prototype.load = jest.fn();
}

/**
 * Global fetch mock.
 * Default behavior returns a 200 with empty JSON, but it is intentionally simple.
 * Override per-test when validating error paths.
 */
const defaultFetchMock = jest.fn(async () => {
	const body = JSON.stringify({});
	return {
		ok: true,
		status: 200,
		headers: new Headers({ 'Content-Type': 'application/json' }),
		json: async () => JSON.parse(body),
		text: async () => body,
	} as Response;
});

global.fetch = defaultFetchMock as unknown as typeof fetch;

// Console error policy: fail tests on unexpected console.error calls.
// Keep patterns tight to avoid masking real issues.
const allowedConsoleErrorPatterns: RegExp[] = [
	/RSVP Sync/i,
	/GuestDashboard API/i,
	/\bRSVP\b/i, // allows both "RSVP" and "RSVP-V2" variants
];

beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
		const message = args
			.map((arg) => (typeof arg === 'string' ? arg : safeJson(arg)))
			.join(' ');

		const isAllowed = allowedConsoleErrorPatterns.some((pattern) => pattern.test(message));
		if (isAllowed) return;

		throw new Error(`Unexpected console.error in test: ${message}`);
	});
});

afterEach(() => {
	jest.restoreAllMocks();
});

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

jest.mock('@/lib/assets/discovery', () => jest.requireActual('./mocks/assets/discovery'));

// Mock framer-motion to avoid issues in JSDOM and suppress motion prop leakage warnings
jest.mock('framer-motion', () => {
	const filterMotionProps = (props: Record<string, unknown>) => {
		const validProps = { ...props };
		const blockedProps = [
			'initial',
			'animate',
			'exit',
			'variants',
			'transition',
			'whileHover',
			'whileTap',
			'whileInView',
			'whileFocus',
			'whileDrag',
			'viewport',
			'onAnimationStart',
			'onAnimationComplete',
			'onUpdate',
			'layout',
			'custom',
			'inherit',
		] as const;

		for (const propName of blockedProps) delete validProps[propName];
		return validProps;
	};

	const createMotionComponent = (Tag: string) => {
		return ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
			React.createElement(Tag, filterMotionProps(props), children);
	};

	const motionComponents = new Map<string, ReturnType<typeof createMotionComponent>>();
	const motion = new Proxy(
		{},
		{
			get: (_, tag: string) => {
				if (!motionComponents.has(tag)) {
					motionComponents.set(tag, createMotionComponent(tag));
				}
				return motionComponents.get(tag);
			},
		},
	);

	return {
		motion,
		AnimatePresence: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
		useReducedMotion: () => false,
	};
});
