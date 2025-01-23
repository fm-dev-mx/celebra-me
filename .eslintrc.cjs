// .eslintrc.cjs

// ESLint configuration for consistent coding practices across file types
module.exports = {
	env: {
		browser: true, // Browser environment
		es2021: true, // ES2021 features
		node: true, // Node.js environment
	},
	extends: [
		"eslint:recommended", // Base rules
		"plugin:@typescript-eslint/recommended", // TypeScript rules
		"plugin:astro/recommended", // Astro-specific rules
		"plugin:prettier/recommended", // Prettier integration
	],
	overrides: [
		{
			env: { node: true }, // Node-specific
			files: [".eslintrc.{js,cjs}"], // ESLint config files
			parserOptions: { sourceType: "script" }, // CommonJS
		},
		{
			files: ["*.astro"], // Astro files
			parser: "astro-eslint-parser",
			parserOptions: {
				parser: "@typescript-eslint/parser",
				extraFileExtensions: [".astro"],
			},
			rules: {
				"astro/no-unused-css-selector": "warn", // Warn for unused CSS
			},
		},
		{
			files: ["*.tsx"], // React TSX files
			extends: ["plugin:react/recommended"],
			settings: { react: { version: "detect" } }, // Auto-detect React
		},
		{
			files: ["*.json", "*.yaml", "*.yml"], // JSON & YAML
			parser: "yaml-eslint-parser",
			rules: {
				"prettier/prettier": [
					"error",
					{ tabWidth: 4 }, // Consistent indentation
				],
			},
		},
		{
			files: ["*.md"], // Markdown files
			plugins: ["markdown"],
			extends: ["plugin:markdown/recommended"],
			rules: {},
		},
	],
	parserOptions: {
		ecmaVersion: "latest", // Latest ECMAScript
		parser: "@typescript-eslint/parser", // TypeScript support
		sourceType: "module", // ES Modules
	},
	plugins: [
		"@typescript-eslint", // TypeScript plugin
		"prettier", // Prettier plugin
	],
	rules: {
		"@typescript-eslint/explicit-module-boundary-types": "off", // No forced return types
		"@typescript-eslint/no-explicit-any": "warn", // Warn on 'any'
		"prettier/prettier": [
			"error", // Prettier issues as errors
			{
				endOfLine: "auto",
				tabWidth: 4,
				useTabs: true,
			},
		],
	},
};
