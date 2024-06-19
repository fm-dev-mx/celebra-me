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
	tabWidth: 4,
	useTabs: true,
	semi: true, // Añadir punto y coma al final de las declaraciones
	singleQuote: false, // Usar comillas dobles en lugar de comillas simples
	trailingComma: "all", // Añadir coma al final de los elementos en objetos y arrays
	printWidth: 80, // Ajustar el ancho máximo de línea
	bracketSpacing: true, // Añadir espacios dentro de los corchetes de los objetos
	arrowParens: "always", // Incluir paréntesis alrededor de argumentos únicos en funciones de flecha
};
