// tests/setup.ts
// Jest setup file for React Testing Library

import '@testing-library/jest-dom';

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

// Mock framer-motion to avoid issues in JSDOM
jest.mock('framer-motion', () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const React = require('react');
	return {
		motion: {
			div: ({ children, ...props }: Record<string, unknown>) =>
				React.createElement('div', props, children),
			h2: ({ children, ...props }: Record<string, unknown>) =>
				React.createElement('h2', props, children),
			span: ({ children, ...props }: Record<string, unknown>) =>
				React.createElement('span', props, children),
			button: ({ children, ...props }: Record<string, unknown>) =>
				React.createElement('button', props, children),
			form: ({ children, ...props }: Record<string, unknown>) =>
				React.createElement('form', props, children),
		},
		AnimatePresence: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
	};
});
