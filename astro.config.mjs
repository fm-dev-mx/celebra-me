import sitemap from "@astrojs/sitemap"; // Import the sitemap plugin to generate the sitemap
import tailwind from "@astrojs/tailwind"; // Import the Tailwind CSS plugin for styling
import { defineConfig } from "astro/config"; // Import the defineConfig function from Astro to define the configuration

import robotsTxt from "astro-robots-txt"; // Import the robots.txt plugin to generate the robots.txt file
import react from "@astrojs/react"; // Import the react plugin for React components

import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
	// Set the site URL based on the environment (development or production)
	site:
		process.env.NODE_ENV === "development"
			? "http://localhost:4321"
			: "https://celebra-me.vercel.app/",
	// Integrate Tailwind CSS, sitemap, and robots.txt plugins
	integrations: [
		react({
			include: ["**/react/*"],
		}),
		tailwind(),
		sitemap(),
		robotsTxt(),
	],
	vite: {
		resolve: {
			alias: {
				"@": "/src",
				"@components": "/src/components",
				"@utilities": "/src/utilities",
				"@layout": "/src/layout",
			},
		},
	},
	output: "server",
	adapter: vercel(),
});
