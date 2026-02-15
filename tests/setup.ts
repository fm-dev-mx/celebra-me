// tests/setup.ts
// Jest setup file for React Testing Library

import '@testing-library/jest-dom';

class TestHeaders {
	private readonly store = new Map<string, string>();

	constructor(init?: Record<string, string>) {
		if (init) {
			for (const [key, value] of Object.entries(init)) {
				this.store.set(key.toLowerCase(), value);
			}
		}
	}

	get(name: string): string | null {
		return this.store.get(name.toLowerCase()) ?? null;
	}
}

class TestResponse {
	status: number;
	headers: TestHeaders;
	private readonly body: string;

	constructor(body?: BodyInit | null, init?: ResponseInit) {
		this.status = init?.status ?? 200;
		this.headers = new TestHeaders(init?.headers as Record<string, string> | undefined);
		this.body = typeof body === 'string' ? body : body ? String(body) : '';
	}

	async json(): Promise<unknown> {
		return this.body ? JSON.parse(this.body) : {};
	}

	async text(): Promise<string> {
		return this.body;
	}
}

if (typeof global.Response === 'undefined') {
	(global as typeof globalThis & { Response: typeof Response }).Response =
		TestResponse as unknown as typeof Response;
}

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

// Mock HTMLAudioElement for MusicPlayer tests
window.HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLAudioElement.prototype.pause = jest.fn();
window.HTMLAudioElement.prototype.load = jest.fn();

// Mock import.meta.env for Astro environment variables
// This prevents errors when testing modules that use import.meta.env
Object.defineProperty(global, 'import', {
	value: {
		meta: {
			env: {
				GMAIL_USER: 'test@gmail.com',
				GMAIL_PASS: 'test-pass',
				CONTACT_FORM_RECIPIENT_EMAIL: 'recipient@test.com',
			},
		},
	},
});

// Mock global fetch
global.fetch = jest.fn().mockImplementation(() =>
	Promise.resolve({
		ok: true,
		json: () => Promise.resolve({}),
	}),
) as jest.Mock;

const allowedConsoleErrorPatterns: RegExp[] = [];

beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
		const message = args
			.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
			.join(' ');

		const isAllowed = allowedConsoleErrorPatterns.some((pattern) => pattern.test(message));
		if (isAllowed) return;

		throw new Error(`Unexpected console.error in test: ${message}`);
	});
});

afterEach(() => {
	jest.restoreAllMocks();
});

// Mock framer-motion to avoid issues in JSDOM and suppress Prop Leakage warnings
jest.mock('framer-motion', () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const React = require('react');

	// Helper to filter out motion props
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

		for (const propName of blockedProps) {
			delete validProps[propName];
		}

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
