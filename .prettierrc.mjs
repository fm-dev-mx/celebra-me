// .prettierrc.mjs
/** @type {import("prettier").Config} */
export default {
	// Load the Astro plugin for formatting Astro files
	plugins: ['prettier-plugin-astro'],

	overrides: [
		// Astro files
		{
			files: '*.astro',
			options: {
				parser: 'astro',
			},
		},
		// JSON and JSONC files
		{
			files: ['*.json', '*.jsonc'],
			options: {
				parser: 'json',
				useTabs: false, // JSON doesn't support tabs
				tabWidth: 4,
			},
		},
		// Markdown files
		{
			files: '*.md',
			options: {
				parser: 'markdown',
				proseWrap: 'always', // Wrap markdown text at the print width
			},
		},
		// CSS and SCSS files
		{
			files: ['*.css', '*.scss'],
			options: {
				parser: 'scss',
			},
		},
		// YAML files (support both .yml and .yaml extensions)
		{
			files: ['*.yml', '*.yaml'],
			options: {
				parser: 'yaml',
				useTabs: false, // YAML doesn't support tabs
				tabWidth: 4,
			},
		},
		// HTML files
		{
			files: '*.html',
			options: {
				parser: 'html',
			},
		},
	],

	// Global Prettier options
	tabWidth: 4, // Set tab width to 4 spaces or equivalent
	useTabs: true, // Use tabs for indentation in most files
	semi: true, // End statements with a semicolon
	singleQuote: true, // Use single quotes instead of double quotes
	trailingComma: 'all', // Include trailing commas wherever valid
	printWidth: 100, // Wrap lines that exceed 100 characters
	bracketSpacing: true, // Add spaces between brackets in object literals
	arrowParens: 'always', // Always include parentheses around arrow function arguments
	bracketSameLine: false, // Place the closing bracket of JSX elements on a new line
	endOfLine: 'lf', // Enforce line feed (\n) as the line ending
};
