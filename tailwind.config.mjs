/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				primary: {
					light: "#fda4af", // Rose-300
					DEFAULT: "#fb7185", // Rose-400
					dark: "#e11d48", // Rose-600
				},
				secondary: {
					light: "#38bdf8", // Sky-400
					DEFAULT: "#0284c7", // Sky-600
					dark: "#082f49", // Sky-950
				},
				white2: "#fdf2f8", // Fuchsia-50
				white: "#fdf4ff", // Pink-50
				black: "#0f172a", // Slate-900
				gray: "#64748b", // Slate-500
				background: {
					DEFAULT: "#F4F4F4", // Light Gray
				},
				text: {
					DEFAULT: "#4a044e", // Fuchsia-950
					light: "#f9a8d4", // Pink-300
				},
			},
			fontFamily: {
				sans: ["Open Sans", "Poppins", "Montserrat", "sans-serif"],
				serif: ["Lora", "Playfair Display", "Merriweather", "serif"],
				cursive: ["Satisfy", "Great Vibes", "cursive"],
				handwriting: ["Indie Flower", "cursive"],
			},
			textShadow: {
				lg: "2px 2px 4px rgba(0, 0, 0, 0.1)",
			},
		},
	},
	plugins: [
		function ({ addUtilities }) {
			const newUtilities = {
				".shadow-text": {
					textShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
				},
			};
			addUtilities(newUtilities, ["responsive", "hover"]);
		},
	],
	// The safelist below ensures that certain dynamic class names are available for use in production builds,
	// preventing Tailwind from purging them during build optimization. This is particularly useful for classes
	// that are generated or used dynamically in the code (e.g., through concatenation) and might not be directly
	// scanned by Tailwind's purge process.
	safelist: [
		...Array(10)
			.fill(0)
			.map((_, i) => `grid-cols-${i + 1}`), // Generates grid classes from 'grid-cols-1' to 'grid-cols-10'
		...Array(10)
			.fill(0)
			.map((_, i) => `xl:grid-cols-${i + 1}`), // Generates corresponding classes for xl breakpoints
		...Array(10)
			.fill(0)
			.map((_, i) => `lg:grid-cols-${i + 1}`), // Generates corresponding classes for lg breakpoints
		...Array(10)
			.fill(0)
			.map((_, i) => `md:grid-cols-${i + 1}`), // Generates corresponding classes for md breakpoints
		...Array(10)
			.fill(0)
			.map((_, i) => `sm:grid-cols-${i + 1}`), // Generates corresponding classes for sm breakpoints
	],
};
