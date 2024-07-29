/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#FED7AA", // Light Peach
          DEFAULT: "#FB923C", // Peach
          dark: "#EA580C", // Burnt Orange
        },
        secondary: {
			light: "#A7C7E7", // Light Blue
			DEFAULT: "#0288D1", // Blue
			dark: "#1D70B7", // Dark Blue
		},
        accent: {
			light: "#FFC1CC", // Rosado Claro
			DEFAULT: "#FF6F61", // Coral
			dark: "#D97706", // Dorado oscuro
        },
        white: {
          DEFAULT: "#FFFFFF", // White
          light: "#F8F9FA", // Off-White
          dark: "#CED4DA", // Light Gray
        },
        background: {
          DEFAULT: "#FFF9F5", // Cream
          alt: "#F1F3F5", // Light Gray
        },
        text: {
          DEFAULT: "#212529", // Near Black
          light: "#495057", // Dark Gray
        },
      },
      textShadow: {
        lg: "2px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [
    function ({ addUtilities, addBase }) {
      // Add custom text shadow utility
      const newUtilities = {
        ".shadow-text-light": {
          textShadow: "2px 2px 4px rgba(1, 0, 0, .3) !important",
        },
		".shadow-text": {
          textShadow: "2px 2px 4px rgba(1, 0, 0, .5) !important",
        },
		".shadow-text-dark": {
          textShadow: "2px 2px 4px rgba(1, 0, 0, .8) !important",
        },
      };
      addUtilities(newUtilities, ["responsive", "hover"]);

      // Add custom CSS variables
      const newBase = {
        ":root": {
          "--primary-light": "#FED7AA",
          "--primary-default": "#FB923C",
          "--primary-dark": "#EA580C",
          "--secondary-light": "#93C5FD",
          "--secondary-default": "#3B82F6",
          "--secondary-dark": "#0369A1",
          "--accent-light": "#FFD6A5",
          "--accent-default": "#FFAB6E",
          "--accent-dark": "#FF8C42",
          "--neutral-lightest": "#FFFFFF",
          "--neutral-light": "#F8F9FA",
          "--neutral-medium": "#CED4DA",
          "--neutral-dark": "#495057",
          "--neutral-darkest": "#212529",
          "--background-default": "#FFF9F5",
          "--background-alt": "#F1F3F5",
          "--text-default": "#212529",
          "--text-light": "#495057",
        },
      };
      addBase(newBase);
    },
  ],
  safelist: (() => {
    // Generate safelist for color utilities
    const generateColorSafelist = () => {
      const colors = ['primary', 'secondary', 'accent', 'neutral', 'background', 'text', 'white'];
      const variants = ['', 'light', 'dark', 'lightest', 'medium', 'darkest', 'alt'];
      const elements = ['bg', 'text', 'border', 'hover:bg', 'hover:text', 'hover:border'];

      return colors.flatMap(color =>
        variants.flatMap(variant =>
          elements.map(element =>
            variant ? `${element}-${color}-${variant}` : `${element}-${color}`
          )
        )
      );
    };

    // Generate safelist for grid columns
    const generateGridSafelist = () => {
      const breakpoints = ['', 'sm:', 'md:', 'lg:', 'xl:'];
      return breakpoints.flatMap(bp =>
        Array.from({ length: 10 }, (_, i) => `${bp}grid-cols-${i + 1}`)
      );
    };

    // Combine color and grid safelists
    return [...generateColorSafelist(), ...generateGridSafelist()];
  })(),
};
