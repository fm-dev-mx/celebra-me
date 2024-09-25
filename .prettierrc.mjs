/** @type {import("prettier").Config} */
export default {
	plugins: ["prettier-plugin-astro"],
	overrides: [
		{
			files: "*.astro",
			options: {
				parser: "astro",
			},
		},
	],
	tabWidth: 4, // default: 2
	useTabs: true, // default: false
	semi: true, // add semicolon at the end of statements
	singleQuote: false, // use single quote instead of double quote
	trailingComma: "all", // comma at the end of objects and arrays
	printWidth: 100, // Adjust the print width of the code
	bracketSpacing: true, // Add spaces after opening and before closing brackets
	arrowParens: "always", // Add parentheses around a sole arrow function parameter
	bracketSameLine: false, // Add line breaks after opening and before closing brackets
};
