import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroParser from 'astro-eslint-parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginImport from 'eslint-plugin-import';
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
			'.astro/',
			'.vercel/',
			'.build/',
			'coverage/',
			'public/',
			'*.log',
			'*.tmp',
			'*.min.js',
			'*.min.css',
			'astro/types.d.ts',
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
	// Prettier integration
	// Keep it global, but we'll selectively disable for .astro if needed
	// ------------------------------------------------------------
	eslintPluginPrettierRecommended,

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
			import: eslintPluginImport,
			boundaries: eslintPluginBoundaries,
		},
		settings: {
			'import/resolver': {
				typescript: true,
			},
			'boundaries/elements': [
				{
					type: 'domain',
					pattern: 'src/lib/rsvp/services/*',
					mode: 'folder',
				},
				{
					type: 'adapter',
					pattern: 'src/lib/adapters/*',
					mode: 'folder',
				},
				{
					type: 'page',
					pattern: 'src/pages/*',
					mode: 'folder',
				},
			],
		},
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			'prettier/prettier': [
				'error',
				{
					endOfLine: 'auto',
					tabWidth: 4,
					useTabs: true,
				},
			],
			// God Objects & Complexity (Increased slightly to allow common logic while remaining strict)
			'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 20],
			// Coupling
			'import/no-cycle': 'error',
			'boundaries/dependencies': [
				'error',
				{
					default: 'allow',
					rules: [
						{
							from: 'domain',
							disallow: ['page'],
						},
						{
							from: 'adapter',
							disallow: ['page'],
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
	// TypeScript-specific rules (TS/TSX only)
	// ------------------------------------------------------------
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
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

			// Prettier + Astro can be noisy depending on plugin version.
			// Keep it off for .astro (you're already formatting via prettier-plugin-astro).
			'prettier/prettier': 'off',
		},
	},

	// ------------------------------------------------------------
	// Node scripts (scripts/**/*.js|cjs|mjs)
	// Allow require/import flexibility in tooling scripts
	// ------------------------------------------------------------
	{
		files: [
			'scripts/**/*.{js,cjs,mjs}',
			'.agent/governance/bin/**/*.{js,cjs,mjs}',
			'**/*.config.{js,cjs,mjs}',
		],
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
		},
	},
];
