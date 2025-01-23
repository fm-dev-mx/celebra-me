// .prettierrc.mjs
/** @type {import("prettier").Config} */
export default {
	plugins: ["prettier-plugin-astro"],
	overrides: [
		// Astro files
		{
			files: "*.astro",
			options: {
				parser: "astro",
			},
		},
		// JSON and JSONC files
		{
			files: ["*.json", "*.jsonc"],
			options: {
				parser: "json",
				tabWidth: 4,
			},
		},
		// Markdown files
		{
			files: "*.md",
			options: {
				parser: "markdown",
				proseWrap: "always", // Wrap markdown text to the print width
			},
		},
		// CSS, SCSS, and Tailwind files
		{
			files: ["*.css", "*.scss"],
			options: {
				parser: "css",
			},
		},
		// YAML files
		{
			files: "*.yml",
			options: {
				parser: "yaml",
			},
		},
	],
	tabWidth: 4, // Use 4 spaces (or equivalent tabs) for indentation
	useTabs: true, // Use tabs instead of spaces for indentation
	semi: true, // End statements with a semicolon
	singleQuote: true, // Use single quotes instead of double quotes
	trailingComma: "all", // Add trailing commas in objects, arrays, etc.
	printWidth: 100, // Wrap lines longer than 100 characters
	bracketSpacing: true, // Add spaces between brackets in objects
	arrowParens: "always", // Always include parentheses in arrow functions
	bracketSameLine: false, // Place closing brackets on a new line
};
