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

// Mock framer-motion to avoid issues in JSDOM and suppress Prop Leakage warnings
jest.mock('framer-motion', () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const React = require('react');

	// Helper to filter out motion props
	const filterMotionProps = (props: Record<string, any>) => {
		const {
			_initial,
			_animate,
			_exit,
			_variants,
			_transition,
			_whileHover,
			_whileTap,
			_whileInView,
			_whileFocus,
			_whileDrag,
			_viewport,
			_onAnimationStart,
			_onAnimationComplete,
			_onUpdate,
			_layout,
			_custom,
			_inherit,
			...validProps
		} = props;
		return validProps;
	};

	const createMotionComponent = (Tag: string) => {
		return ({ children, ...props }: any) =>
			React.createElement(Tag, filterMotionProps(props), children);
	};

	return {
		motion: {
			div: createMotionComponent('div'),
			h2: createMotionComponent('h2'),
			span: createMotionComponent('span'),
			button: createMotionComponent('button'),
			form: createMotionComponent('form'),
			fieldset: createMotionComponent('fieldset'),
			p: createMotionComponent('p'),
			section: createMotionComponent('section'),
		},
		AnimatePresence: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
		useReducedMotion: () => false,
	};
});
