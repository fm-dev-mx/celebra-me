/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#FDE2E2", // Soft Blush Pink
          DEFAULT: "#F8AFAF", // Rose Pink
          dark: "#E47676", // Deep Rose
        },
        secondary: {
          light: "#FFF4CC", // Pale Gold
          DEFAULT: "#F0B76D", // Rich Gold (warmer and elegant)
          dark: "#B8893A", // Deep Golden Brown
        },
        accent: {
          light: "#FDE8C5", // Light Peach Beige
          DEFAULT: "#F6B99E", // Soft Peach
          dark: "#DE8976", // Muted Coral
        },
        neutral: {
          lightest: "#FFFFFF", // White
          light: "#F5F5F5", // Light Gray
          medium: "#E1E1E1", // Medium Gray
          dark: "#7A7A7A", // Charcoal Gray
          darkest: "#404040", // Dark Gray
        },
        background: {
          DEFAULT: "#FFFFFf", // Warm off-white
          alt: "#FFFFFF", // Creamy Peach
        },
        text: {
          DEFAULT: "#2D2D2D", // Almost Black
          light: "#5A5A5A", // Soft Dark Gray
        },
        whatsapp: {
          DEFAULT: "#25D366", // WhatsApp Green
          hover: "#20b157", // Darker WhatsApp Green for hover
        },
      },
      textShadow: {
        lg: "2px 2px 4px rgba(0, 0, 0, 0.1)", // Large subtle shadow
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [
    function ({ addBase, addUtilities, theme }) {
      // Add custom text shadow utilities
      const textShadowUtilities = {
        ".shadow-text-light": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)", // Light shadow for subtle effect
        },
        ".shadow-text": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)", // Standard shadow for balanced contrast
        },
        ".shadow-text-dark": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)", // Dark shadow for strong emphasis
        },
      };

      // Add custom blur background utilities
      const backgroundBlurUtilities = {
        ".bg-blur-overlay": {
          backgroundColor: theme("colors.background.alt"),
          backdropFilter: "blur(8px)", // Soft glass-like blur for backgrounds
        },
        ".bg-blur-soft": {
          backgroundColor: theme("colors.background.alt"),
          backdropFilter: "blur(4px)", // Light blur for subtle background effects
        },
        ".bg-blur-intense": {
          backgroundColor: theme("colors.background.alt"),
          backdropFilter: "blur(16px)", // More pronounced blur for strong focus separation
        },
      };

      addBase(textShadowUtilities);
      addUtilities(backgroundBlurUtilities);

      // Add custom CSS variables to enhance theme control
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
          "--background-default-rgb": "255, 255, 255",
          "--background-primary-rgb": "228, 118, 118",
          "--background-alt": theme("colors.background.alt"),
          "--text-default": theme("colors.text.DEFAULT"),
          "--text-light": theme("colors.text.light"),
		  "--whatsapp": theme("colors.whatsapp.DEFAULT"),
        },
      };
      addBase(cssVariables);
    },
  ],
  safelist: (() => {
    // Generate safelist for color utilities to prevent purging
    const generateColorSafelist = () => {
      const colors = ["primary", "secondary", "accent", "neutral", "background", "text", "whatsapp"];
      const shades = ["", "light", "dark", "lightest", "medium", "darkest", "alt", "DEFAULT"];
      const utilities = ["bg", "text", "border", "hover:bg", "hover:text", "hover:border"];

      return colors.flatMap((color) =>
        shades.flatMap((shade) =>
          utilities.map((utility) => (shade ? `${utility}-${color}-${shade}` : `${utility}-${color}`))
        )
      );
    };

    // Generate safelist for responsive grid columns
    const generateGridSafelist = () => {
      const breakpoints = ["", "sm:", "md:", "lg:", "xl:"];
      return breakpoints.flatMap((bp) =>
        Array.from({ length: 12 }, (_, i) => `${bp}grid-cols-${i + 1}`)
      );
    };

    // Safelist for custom blur utilities
    const customUtilitiesSafelist = [
      "bg-blur-overlay",
      "bg-blur-soft",
      "bg-blur-intense",
    ];

    // Combine and return the generated safelists
    return [...generateColorSafelist(), ...generateGridSafelist(), ...customUtilitiesSafelist];
  })(),
};
