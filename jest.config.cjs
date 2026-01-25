/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest/presets/default-esm', // Use ESM preset
	testEnvironment: 'jsdom', // DOM environment for React component testing
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // RTL + custom mocks
	transform: {
		'^.+\\.[tj]sx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
	moduleNameMapper: {
		// SCSS files - mock with identity-obj-proxy
		'\\.scss$': 'identity-obj-proxy',

		// Root aliases
		'^@/(.*)$': '<rootDir>/src/$1',

		// Components & Layouts
		'^@components/(.*)$': '<rootDir>/src/components/$1',
		'^@layouts/(.*)$': '<rootDir>/src/layouts/$1',

		// Assets & Styles
		'^@styles/(.*)$': '<rootDir>/src/styles/$1',

		// Utils & Helpers
		'^@utils/(.*)$': '<rootDir>/src/utils/$1',
		'^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',

		// Pages
		'^@pages/(.*)$': '<rootDir>/src/pages/$1',
	},
	testMatch: ['**/tests/**/*.test.(ts|tsx)'],
	collectCoverage: true, // Enable coverage reports
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/index.ts', // Exclude barrel files
		'!src/**/*.d.ts', // Exclude type definitions
		'!src/**/*.astro', // Astro components tested via E2E
	],
	coverageDirectory: '<rootDir>/coverage', // Directory for coverage reports
	coverageReporters: ['text', 'lcov'], // Output formats
	// Ignore patterns
	testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.vercel/'],
};
