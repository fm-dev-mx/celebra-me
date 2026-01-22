import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroParser from 'astro-eslint-parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...eslintPluginAstro.configs.recommended,
	eslintPluginPrettierRecommended,
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
	{
		rules: {
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'prettier/prettier': [
				'error',
				{
					endOfLine: 'auto',
					tabWidth: 4,
					useTabs: true,
				},
			],
		},
	},
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
			'prettier/prettier': 'off',
		},
	},

	{
		ignores: [
			'dist/',
			'node_modules/',
			'.astro/',
			'.vercel/',
			'.build/',
			'public/',
			'package-lock.json',
			'pnpm-lock.yaml',
			'*.log',
			'*.tmp',
			'.env',
			'.env.local',
			'.env.*.local',
			'coverage/',
			'*.min.js',
			'*.min.css',
			'astro/types.d.ts',
		],
	},
];
