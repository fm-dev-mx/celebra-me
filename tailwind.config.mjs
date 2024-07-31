/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#FED7AA", // Light Peach
          DEFAULT: "#FB923C", // Peach
          dark: "#EA580C", // Burnt Orange
        },
        secondary: {
          light: "#93C5FD", // Light Sky Blue
          DEFAULT: "#3B82F6", // Sky Blue
          dark: "#0369A1", // Dark Sky Blue
        },
        accent: {
          light: "#FFD6A5", // Light Yellow
          DEFAULT: "#FFAB6E", // Yellow
          dark: "#FF8C42", // Dark Yellow
        },
		neutral: {
		  lightest: "#FFFFFF", // White
		  light: "#F8F9FA", // Light Gray
		  medium: "#CED4DA", // Medium Gray
		  dark: "#495057", // Dark Gray
		  darkest: "#212529", // Black
		},
        background: {
          DEFAULT: "#FFF9F5", // Light Peach
          alt: "#F1F3F5", // Light Gray
        },
        text: {
          DEFAULT: "#212529", // Black
          light: "#495057", // Dark Gray
        },
      },
      textShadow: {
        lg: "2px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [
    function ({ addBase, theme }) {
      // Add custom text shadow utilities
      const textShadowUtilities = {
        ".shadow-text-light": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
        },
        ".shadow-text": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
        },
        ".shadow-text-dark": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
        },
      };
      addBase(textShadowUtilities);

      // Add custom CSS variables
      const cssVariables = {
        ":root": {
          "--primary-light": theme("colors.primary.light"),
          "--primary-default": theme("colors.primary.DEFAULT"),
          "--primary-dark": theme("colors.primary.dark"),
          "--secondary-light": theme("colors.secondary.light"),
          "--secondary-default": theme("colors.secondary.DEFAULT"),
          "--secondary-dark": theme("colors.secondary.dark"),
          "--accent-light": theme("colors.accent.light"),
          "--accent-default": theme("colors.accent.DEFAULT"),
          "--accent-dark": theme("colors.accent.dark"),
          "--neutral-lightest": theme("colors.neutral.lightest"),
          "--neutral-light": theme("colors.neutral.light"),
          "--neutral-medium": theme("colors.neutral.medium"),
          "--neutral-dark": theme("colors.neutral.dark"),
          "--neutral-darkest": theme("colors.neutral.darkest"),
          "--background-default": theme("colors.background.DEFAULT"),
          "--background-alt": theme("colors.background.alt"),
          "--text-default": theme("colors.text.DEFAULT"),
          "--text-light": theme("colors.text.light"),
        },
      };
      addBase(cssVariables);
    },
  ],
  safelist: (() => {
    // Generate safelist for color utilities
    const generateColorSafelist = () => {
      const colors = ['primary', 'secondary', 'accent', 'neutral', 'background', 'text'];
      const shades = ['', 'light', 'dark', 'lightest', 'medium', 'darkest', 'alt'];
      const utilities = ['bg', 'text', 'border', 'hover:bg', 'hover:text', 'hover:border'];

      return colors.flatMap(color =>
        shades.flatMap(shade =>
          utilities.map(utility =>
            shade ? `${utility}-${color}-${shade}` : `${utility}-${color}`
          )
        )
      );
    };

    // Generate safelist for grid columns
    const generateGridSafelist = () => {
      const breakpoints = ['', 'sm:', 'md:', 'lg:', 'xl:'];
      return breakpoints.flatMap(bp =>
        Array.from({ length: 12 }, (_, i) => `${bp}grid-cols-${i + 1}`)
      );
    };

    // Combine color and grid safelists
    return [...generateColorSafelist(), ...generateGridSafelist()];
  })(),
};
