/** @type {import('ts-jest').JestConfigWithTsJest} */
const strictRsvpCoverage =
	process.env.RSVP_STRICT_COVERAGE === 'true' || process.env.RSVP_V2_STRICT_COVERAGE === 'true';

module.exports = {
	// ESM + TypeScript preset
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'jsdom',

	// Treat TS/TSX as ESM under Jest
	extensionsToTreatAsEsm: ['.ts', '.tsx'],

	// RTL + custom mocks
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: '<rootDir>/tsconfig.json',
			},
		],
	},

	moduleNameMapper: {
		// Fix ESM relative imports that may include ".js" extension in compiled output
		'^(\\.{1,2}/.*)\\.js$': '$1',

		// Styles
		'\\.(css|scss)$': 'identity-obj-proxy',

		// Static assets
		'\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/mocks/fileMock.cjs',

		// Root aliases
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@core/(.*)$': '<rootDir>/src/$1',

		// Components & Layouts
		'^@components/(.*)$': '<rootDir>/src/components/$1',
		'^@layouts/(.*)$': '<rootDir>/src/layouts/$1',

		// Assets & Styles
		'^@styles/(.*)$': '<rootDir>/src/styles/$1',
		'^@images/(.*)$': '<rootDir>/src/assets/images/$1',
		'^@content/(.*)$': '<rootDir>/src/content/$1',

		// Utils & Helpers
		'^@utils/(.*)$': '<rootDir>/src/utils/$1',
		'^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',

		// Pages
		'^@pages/(.*)$': '<rootDir>/src/pages/$1',

		// Astro virtual modules (tests)
		'^astro:content$': '<rootDir>/tests/mocks/astro-content.ts',
		'^astro:middleware$': '<rootDir>/tests/mocks/astro-middleware.ts',
		'^astro/loaders$': '<rootDir>/tests/mocks/astro-loaders.ts',
	},

	// Correct glob patterns (no regex syntax here)
	testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],

	// Coverage
	collectCoverage: true,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/index.ts',
		'!src/**/*.d.ts',
		'!src/**/*.astro',
	],

	coverageDirectory: '<rootDir>/coverage',
	coverageReporters: ['text', 'lcov'],

	...(strictRsvpCoverage
		? {
				// When strict coverage is enabled, scope coverage to the RSVP surface
				// to avoid punishing unrelated code paths.
				collectCoverageFrom: [
					'src/lib/rsvp/**/*.{ts,tsx}',
					'src/pages/api/**/*.{ts,tsx}',

					'!src/**/index.ts',
					'!src/**/*.d.ts',
					'!src/**/*.astro',
				],
				coverageThreshold: {
					global: {
						lines: 70,
						branches: 45,
						functions: 60,
						statements: 65,
					},
				},
			}
		: {}),

	testPathIgnorePatterns: ['/node_modules/', '/dist/', '/\\.vercel/', '/tests/e2e/'],
};
