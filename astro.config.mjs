import sitemap from "@astrojs/sitemap"; // Sitemap plugin for generating sitemaps
import tailwind from "@astrojs/tailwind"; // Tailwind CSS plugin for styling
import vercel from "@astrojs/vercel/serverless"; // Vercel adapter for Astro
import robotsTxt from "astro-robots-txt"; // Plugin for generating robots.txt
import { defineConfig } from "astro/config"; // Function to define Astro configuration

// Astro configuration
export default defineConfig({
	// Set the site URL based on the environment (development or production)
	site: import.meta.env.DEV ? "http://localhost:4321" : "https://celebra-me.vercel.app/",
	// Integrate Tailwind CSS, sitemap, and robots.txt plugins
	integrations: [tailwind(), sitemap(), robotsTxt()],
	// Output configuration for server-side rendering
	output: "server",
	// Vercel adapter configuration with web analytics enabled
	adapter: vercel({
		webAnalytics: { enabled: true },
	}),
});
