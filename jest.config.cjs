/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest/presets/default-esm', // Use ESM preset
	testEnvironment: 'node', // Adjust to "jsdom" if DOM testing is needed
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
	transform: {
		'^.+\\.[tj]sx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
	moduleNameMapper: {
		// Root aliases
		'^@/(.*)$': '<rootDir>/src/$1',

		// Components & Layouts
		'^@components/(.*)$': '<rootDir>/src/components/$1',
		'^@layouts/(.*)$': '<rootDir>/src/layouts/$1',

		// Assets & Styles
		'^@styles/(.*)$': '<rootDir>/src/styles/$1',
		// Assuming assets are directly in public or src/assets if it existed, removing likely invalid frontend/assets paths for now unless confirmed.
		// Keeping generic mapping if compatible or removing specific invalid ones.
		// Given listing didn't show 'assets' in src, but maybe they are deeper?
		// Safest is to map known dirs.

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
	],
	coverageDirectory: '<rootDir>/coverage', // Directory for coverage reports
	coverageReporters: ['text', 'lcov'], // Output formats
};
