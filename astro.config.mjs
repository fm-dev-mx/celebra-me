import sitemap from "@astrojs/sitemap"; // Import sitemap plugin for automatic sitemap generation
import tailwind from "@astrojs/tailwind"; // Import Tailwind CSS plugin for styling
import { defineConfig } from "astro/config"; // Import Astro's configuration function
import robotsTxt from "astro-robots-txt"; // Import robots.txt plugin for search engine crawling rules
import react from "@astrojs/react"; // Import React integration for using React components
import vercel from "@astrojs/vercel/serverless"; // Import Vercel adapter for serverless deployment

export default defineConfig({
  // Set the site URL based on the environment (development or production)
  site: process.env.NODE_ENV === "development"
    ? "http://localhost:4321" // Development URL
    : "https://celebra-me.vercel.app/", // Production URL

  // Configure project integrations
  integrations: [
    react({
      include: ["**/react/*"], // Only process React components in directories containing "react"
    }),
    tailwind(), // Enable Tailwind CSS
    sitemap(), // Generate sitemap
    robotsTxt(), // Generate robots.txt file
  ],

  // Configure Vite (the underlying build tool)
  vite: {
    resolve: {
      alias: {
        // Set up import aliases for easier imports
        "@": "/src",
        "@components": "/src/components",
        "@utilities": "/src/utilities",
        "@layout": "/src/layout",
      },
    },
  },

  output: "hybrid", // Enable hybrid rendering (SSR + client-side hydration)

  // Configure Vercel adapter
  adapter: vercel({
    webAnalytics: { enabled: true }, // Enable Vercel's web analytics
    maxDuration: 8, // Set maximum duration for serverless functions (in seconds)
    devMode: process.env.NODE_ENV === "development", // Enable development mode features only in development
  })

});
