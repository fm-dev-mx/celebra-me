/** @type {import('ts-jest').JestConfigWithTsJest} */
const strictRsvpCoverage = process.env.RSVP_STRICT_COVERAGE === 'true';
const sanitizeHtmlEsmPackages =
	'(?:htmlparser2|entities|domhandler|domelementtype|domutils|dom-serializer)';

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
				tsconfig: '<rootDir>/tsconfig.test.json',
			},
		],
		// Transform only sanitize-html's ESM parser graph for Jest's CJS runtime:
		// htmlparser2 parses markup; entities decodes/encodes entities; domhandler builds
		// the DOM; domelementtype classifies nodes; domutils traverses/manipulates it;
		// dom-serializer serializes the sanitized tree.
		[`[\\\\/]node_modules[\\\\/]${sanitizeHtmlEsmPackages}[\\\\/].+\\.jsx?$`]:
			'<rootDir>/scripts/jest-esm-to-cjs-transform.cjs',
	},

	// Match any node_modules segment so nested htmlparser2/node_modules/* is not ignored.
	// Remove this exception when Jest can execute this ESM graph directly in the repo pipeline.
	transformIgnorePatterns: [`[\\\\/]node_modules[\\\\/](?!${sanitizeHtmlEsmPackages}[\\\\/])`],

	moduleNameMapper: {
		// Fix ESM relative imports that may include ".js" extension in compiled output
		'^(\\.{1,2}/.*)\\.js$': '$1',

		// Styles
		'\\.(css|scss)$': 'identity-obj-proxy',

		// Static assets
		'\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/mocks/fileMock.cjs',

		// Root aliases
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@tests/(.*)$': '<rootDir>/tests/$1',

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

		// Astro virtual modules (tests)
		'^astro:content$': '<rootDir>/tests/mocks/astro-content.ts',
		'^astro:middleware$': '<rootDir>/tests/mocks/astro-middleware.ts',
		'^astro/loaders$': '<rootDir>/tests/mocks/astro-loaders.ts',
	},

	// Correct glob patterns (no regex syntax here)
	testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],

	// Coverage is opt-in through `pnpm test:coverage`.
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
