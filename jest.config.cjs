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
		'^.+\\.astro$': 'astro-jest', // Support for Astro files (optional)
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@components/(.*)$': '<rootDir>/src/frontend/components/$1',
		'^@utilities/(.*)$': '<rootDir>/src/core/utilities/$1',
		'^@layouts/(.*)$': '<rootDir>/src/frontend/layouts/$1',
		'^@images/(.*)$': '<rootDir>/src/frontend/assets/images/$1',
		'^@interfaces/(.*)$': '<rootDir>/src/core/interfaces/$1',
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
