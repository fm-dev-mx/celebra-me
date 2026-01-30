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
