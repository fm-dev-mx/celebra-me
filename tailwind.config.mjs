/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,ts,tsx}"],
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
			textShadow: {
				lg: "2px 2px 4px rgba(0, 0, 0, 0.1)",
			},
		},
	},
	plugins: [
		function ({ addUtilities, addBase }) {
			const newUtilities = {
				".shadow-text": {
					textShadow: "2px 2px 4px rgba(1, 0, 0, .4) !important",
				},
			};
			addUtilities(newUtilities, ["responsive", "hover"]);

			// Add custom properties (CSS variables) to the :root
			const newBase = {
				":root": {
					"--primary-light": "#fda4af",
					"--primary-default": "#fb7185",
					"--primary-dark": "#e11d48",
					"--secondary-light": "#38bdf8",
					"--secondary-default": "#0284c7",
					"--secondary-dark": "#082f49",
					"--white2": "#fdf2f8",
					"--white": "#fdf4ff",
					"--black": "#0f172a",
					"--gray": "#64748b",
					"--background-default": "#F4F4F4",
					"--text-default": "#4a044e",
					"--text-light": "#f9a8d4",
				},
			};
			addBase(newBase);
		},
	],
	// Ensures dynamic class names are preserved in production builds, preventing Tailwind from purging them.
	safelist: (() => {
		const classes = [];
		const breakpoints = ["", "sm:", "md:", "lg:", "xl:"];
		for (let i = 1; i <= 10; i++) {
			breakpoints.forEach((bp) => classes.push(`${bp}grid-cols-${i}`));
		}
		return classes;
	})(),
};
