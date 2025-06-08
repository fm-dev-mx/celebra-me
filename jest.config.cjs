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
		// Core aliases
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@core/(.*)$': '<rootDir>/src/core/$1',
		'^@config/(.*)$': '<rootDir>/src/core/config/$1',
		'^@customTypes/(.*)$': '<rootDir>/src/core/types/$1',
		'^@interfaces/(.*)$': '<rootDir>/src/core/interfaces/$1',
		'^@utilities/(.*)$': '<rootDir>/src/core/utilities/$1',
		'^@helpers/(.*)$': '<rootDir>/src/core/helpers/$1',
		'^@data/(.*)$': '<rootDir>/src/core/data/$1',

		// Frontend aliases
		'^@frontend/(.*)$': '<rootDir>/src/frontend/$1',
		'^@components/(.*)$': '<rootDir>/src/frontend/components/$1',
		'^@layouts/(.*)$': '<rootDir>/src/frontend/layouts/$1',
		'^@hooks/(.*)$': '<rootDir>/src/frontend/hooks/$1',
		'^@styles/(.*)$': '<rootDir>/src/frontend/styles/$1',
		'^@assets/(.*)$': '<rootDir>/src/frontend/assets/$1',
		'^@images/(.*)$': '<rootDir>/src/frontend/assets/images/$1',
		'^@icons/(.*)$': '<rootDir>/src/frontend/assets/icons/$1',
		'^@fonts/(.*)$': '<rootDir>/src/frontend/assets/fonts/$1',

		// Backend aliases
		'^@backend/(.*)$': '<rootDir>/src/backend/$1',
		'^@api/(.*)$': '<rootDir>/src/pages/api/$1',
		'^@services/(.*)$': '<rootDir>/src/backend/services/$1',
		'^@controllers/(.*)$': '<rootDir>/src/backend/controllers/$1',
		'^@repositories/(.*)$': '<rootDir>/src/backend/repositories/$1',
		'^@middlewares/(.*)$': '<rootDir>/src/backend/middlewares/$1',
		'^@models/(.*)$': '<rootDir>/src/backend/models/$1',
		'^@db/(.*)$': '<rootDir>/src/backend/database/$1',
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
