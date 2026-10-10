import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as astroParser from 'astro-eslint-parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginBoundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

export default [
	// ------------------------------------------------------------
	// Global ignores (apply first)
	// ------------------------------------------------------------
	{
		ignores: [
			'dist/',
			'node_modules/',
			'.worktrees/',
			'.opencode/',
			'.agent/tmp/',
			'.astro/',
			'.vercel/',
			'.build/',
			'coverage/',
			'public/',
			'temp/',
			'**/.tmp/',
			'**/.wrangler/',
			'*.log',
			'*.tmp',
			'*.min.js',
			'*.min.css',
			'workers/**/worker-configuration.d.ts',
			// Lockfiles
			'package-lock.json',
			'pnpm-lock.yaml',
			// Env files
			'.env',
			'.env.local',
			'.env.*.local',
		],
	},

	// ------------------------------------------------------------
	// Base recommended (JS)
	// ------------------------------------------------------------
	eslint.configs.recommended,

	// ------------------------------------------------------------
	// TypeScript recommended (only for TS/TSX)
	// This prevents TS rules from incorrectly applying to .js
	// ------------------------------------------------------------
	...tseslint.configs.recommended.map((cfg) => ({
		...cfg,
		files: ['**/*.{ts,tsx}'],
	})),

	// ------------------------------------------------------------
	// Astro recommended (Astro files only)
	// ------------------------------------------------------------
	...eslintPluginAstro.configs.recommended.map((cfg) => ({
		...cfg,
		files: ['**/*.astro'],
	})),

	// ------------------------------------------------------------
	// Global language options
	// ------------------------------------------------------------
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
	},

	// ------------------------------------------------------------
	// Project-wide rules (reasonable defaults)
	// ------------------------------------------------------------
	{
		plugins: {
			'import-x': eslintPluginImportX,
			boundaries: eslintPluginBoundaries,
		},
		settings: {
			'import-x/resolver': {
				typescript: true,
			},
			'boundaries/elements': [
				{
					type: 'domain',
					pattern: 'src/lib/rsvp/services/*',
				},
				{
					type: 'adapter',
					pattern: 'src/lib/adapters/*',
				},
				{
					type: 'page',
					pattern: 'src/pages/*',
				},
				// Event memories: contract (isomorphic) ← server / client / ui / workers.
				{
					type: 'memories-contract',
					pattern: 'src/lib/memories/contract/*',
				},
				{
					type: 'memories-server',
					pattern: 'src/lib/memories/server/*',
				},
				{
					type: 'memories-client',
					pattern: 'src/lib/memories/client/*',
				},
				{
					type: 'memories-ui',
					pattern: ['src/components/memories/*', 'src/components/dashboard/memories/*'],
				},
				// Platform usage: contract (isomorphic) <- server / client / ui.
				{
					type: 'platform-contract',
					pattern: 'src/lib/platform/contract/*',
				},
				{
					type: 'platform-server',
					pattern: 'src/lib/platform/server/*',
				},
				{
					type: 'platform-client',
					pattern: 'src/lib/platform/client/*',
				},
				{
					type: 'platform-ui',
					pattern: 'src/components/dashboard/platform/*',
				},
				{
					type: 'worker',
					pattern: 'workers/*',
				},
			],
		},
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			// God Objects & Complexity (Increased slightly to allow common logic while remaining strict)
			'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 20],
			// Coupling
			'import-x/no-cycle': 'error',
			'boundaries/dependencies': [
				'error',
				{
					default: 'allow',
					policies: [
						{
							from: { element: { type: 'domain' } },
							disallow: [{ to: { element: { type: 'page' } } }],
						},
						{
							from: { element: { type: 'adapter' } },
							disallow: [{ to: { element: { type: 'page' } } }],
						},
						// The memories contract stays import-free so Workers can bundle it by path.
						{
							from: { element: { type: 'memories-contract' } },
							disallow: [
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'memories-client' } } },
								{ to: { element: { type: 'memories-ui' } } },
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'platform-client' } } },
								{ to: { element: { type: 'platform-ui' } } },
								{ to: { element: { type: 'page' } } },
								{ to: { element: { type: 'domain' } } },
							],
						},
						{
							from: { element: { type: 'memories-client' } },
							disallow: [
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						{
							from: { element: { type: 'memories-ui' } },
							disallow: [
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						{
							from: { element: { type: 'memories-server' } },
							disallow: [
								{ to: { element: { type: 'memories-client' } } },
								{ to: { element: { type: 'memories-ui' } } },
								{ to: { element: { type: 'platform-client' } } },
								{ to: { element: { type: 'platform-ui' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						// The platform contract stays import-free for the same bundling reason.
						{
							from: { element: { type: 'platform-contract' } },
							disallow: [
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'platform-client' } } },
								{ to: { element: { type: 'platform-ui' } } },
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'memories-client' } } },
								{ to: { element: { type: 'memories-ui' } } },
								{ to: { element: { type: 'page' } } },
								{ to: { element: { type: 'domain' } } },
							],
						},
						{
							from: { element: { type: 'platform-client' } },
							disallow: [
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						{
							from: { element: { type: 'platform-ui' } },
							disallow: [
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						{
							from: { element: { type: 'platform-server' } },
							disallow: [
								{ to: { element: { type: 'platform-client' } } },
								{ to: { element: { type: 'platform-ui' } } },
								{ to: { element: { type: 'memories-client' } } },
								{ to: { element: { type: 'memories-ui' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
						{
							from: { element: { type: 'worker' } },
							disallow: [
								{ to: { element: { type: 'memories-server' } } },
								{ to: { element: { type: 'memories-client' } } },
								{ to: { element: { type: 'memories-ui' } } },
								{ to: { element: { type: 'platform-server' } } },
								{ to: { element: { type: 'platform-client' } } },
								{ to: { element: { type: 'platform-ui' } } },
								{ to: { element: { type: 'domain' } } },
								{ to: { element: { type: 'page' } } },
							],
						},
					],
				},
			],
			// Language Governance (Enforce English / Disallow Spanish accents)
			'id-match': ['error', '^[a-zA-Z0-9_$]+$', { properties: false }],
			// Block Inline Styles & Scripts
			'no-restricted-syntax': [
				'error',
				{
					selector: 'JSXAttribute[name.name="style"]',
					message:
						'Inline styles style={} are strictly forbidden. Use CSS classes instead.',
				},
				{
					selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
					message:
						'dangerouslySetInnerHTML is forbidden for security and architectural reasons.',
				},
			],
		},
	},

	// ------------------------------------------------------------
	// TypeScript-specific rules (TS/TSX only)
	// ------------------------------------------------------------
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],
		},
	},

	// ------------------------------------------------------------
	// Astro parsing + Astro-specific rules
	// ------------------------------------------------------------
	{
		files: ['**/*.astro'],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: ['.astro'],
			},
		},
		rules: {
			'astro/no-unused-css-selector': 'warn',
		},
	},

	// ------------------------------------------------------------
	// Node scripts (scripts/**/*.{js,cjs,mjs,ts})
	// Allow require/import flexibility in tooling scripts
	// ------------------------------------------------------------
	{
		files: ['scripts/**/*.{js,cjs,mjs,ts}', '**/*.config.{js,cjs,mjs}'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			// Tooling scripts often legitimately use console
			'no-console': 'off',

			// If TS-eslint rules accidentally get picked up (via future changes),
			// keep scripts permissive.
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-var-requires': 'off',
		},
	},

	// ------------------------------------------------------------
	// Tests: allow slightly looser rules
	// (you are already enforcing strictness via your console.error guard)
	// ------------------------------------------------------------
	{
		files: ['tests/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
		rules: {
			// Tests frequently use "any" for mocks
			'@typescript-eslint/no-explicit-any': 'off',

			// Tests may use console in debugging; keep warn but allow log if you want.
			// If you prefer strict, leave as-is.
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

			// Test files may be long (comprehensive data-driven scenarios)
			'max-lines': 'off',

			// Integration tests legitimately branch across many cases
			// (render descriptors, schema validation, fallback paths). 30 is
			// generous enough for comprehensive integration tests but still
			// catches obvious refactor candidates.
			complexity: ['error', 30],
		},
	},
	// ------------------------------------------------------------
	// React-specific: block inline scripts in JSX (TSX)
	// (Astro files are allowed to use idiomatic <script> tags)
	// ------------------------------------------------------------
	{
		files: ['**/*.tsx'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['./*', '../*'],
							message:
								'Use @/* alias in TSX components; relative imports are not allowed.',
						},
					],
				},
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'JSXAttribute[name.name="style"]',
					message:
						'Inline styles style={} are strictly forbidden. Use CSS classes instead.',
				},
				{
					selector: 'JSXElement[openingElement.name.name="script"]',
					message:
						'Inline <script> tags in JSX are forbidden. Use separate files or idiomatic Astro scripts.',
				},
				{
					selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
					message:
						'dangerouslySetInnerHTML is forbidden for security and architectural reasons.',
				},
			],
		},
	},

	// ------------------------------------------------------------
	// Temporarily increase complexity limit for feature implementation
	// ------------------------------------------------------------
	{
		files: ['src/components/invitation/RSVP.tsx', 'src/hooks/use-rsvp-submission.ts'],
		rules: {
			complexity: ['off'],
		},
	},
];
