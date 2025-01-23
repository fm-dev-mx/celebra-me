// .stylelintrc.js
module.exports = {
	extends: [
		'stylelint-config-standard', // Basic CSS/SCSS rules
		'stylelint-config-prettier', // Avoids conflicts with Prettier
		'stylelint-config-tailwindcss', // TailwindCSS-specific rules
	],
	plugins: [
		'stylelint-prettier', // Integrates Prettier with Stylelint
	],
	rules: {
		'prettier/prettier': true, // Enforces Prettier rules
		'at-rule-no-unknown': null, // Allows Tailwind directives like @apply, @screen
		'no-empty-source': null, // Avoids errors for empty CSS files (common with Tailwind)
	},
	ignoreFiles: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.md', '**/*.json'],
};
