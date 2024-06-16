/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
		colors: {
			primary: {
				light: '#F5C1D0',  // Rosa Claro
				DEFAULT: '#E9B5C7',  // Rosa Suave (Champán)
				dark: '#FFACC0',  // Versión más oscura del rosa
			},
			secondary: {
				light: '#A1B3C1',  // Versión más clara del azul grisáceo
				DEFAULT: '#8FA0AF',  // Azul Grisáceo
				dark: '#626870',  // Versión más oscura del azul grisáceo
			},
			white2: "#FFFFFF",
			white: "#fef9f5",
			black: "#161925",
			gray: "#4e5b6e",
			background: {
				DEFAULT: '#F4F4F4',  // Gris Claro
			},
			text: {
				DEFAULT: '#4A4A4A',  // Gris Oscuro
				light: '#FFFFFF',  // Blanco
			},
		},
		fontFamily: {
			sans: ['Open Sans', 'Poppins', 'Montserrat', 'sans-serif'],
			serif: ['Lora', 'Playfair Display', 'Merriweather', 'serif'],
			cursive: ['Satisfy', 'Great Vibes', 'cursive'],
			handwriting: ['Indie Flower', 'cursive'],
		},
		textShadow: {
        'lg': '2px 2px 4px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.shadow-text': {
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    }
  ],
};