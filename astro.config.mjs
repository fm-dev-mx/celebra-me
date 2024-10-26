import sitemap from "@astrojs/sitemap"; // Automatic site map generation for SEO
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import robotsTxt from "astro-robots-txt"; // Automatic robots.txt generation for SEO
import react from "@astrojs/react";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
	// The base URL for the site.
	site:
		process.env.NODE_ENV === "development"
			? "http://localhost:4321"
			: "https://celebra-me.vercel.app/",

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
				"@images": "/src/images",
			},
		},
	},

	adapter: vercel({
		webAnalytics: { enabled: true },
		maxDuration: 8, // Max duration for serverless functions in seconds
		devMode: process.env.NODE_ENV === "development",
	}),
});
