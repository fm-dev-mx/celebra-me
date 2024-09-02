import sitemap from "@astrojs/sitemap"; // Plugin for automatic sitemap generation to improve SEO
import tailwind from "@astrojs/tailwind"; // Plugin to integrate Tailwind CSS for styling
import { defineConfig } from "astro/config"; // Astro's configuration function to define the project setup
import robotsTxt from "astro-robots-txt"; // Plugin for generating robots.txt for controlling search engine crawling
import react from "@astrojs/react"; // React integration to use React components within Astro
import vercel from "@astrojs/vercel/serverless"; // Vercel adapter for serverless deployment

export default defineConfig({
  // Define the site URL based on the environment (development or production)
  site: process.env.NODE_ENV === "development"
    ? "http://localhost:4321" // URL used during development
    : "https://celebra-me.vercel.app/", // Production URL when deployed to Vercel

  // Integrations to enhance the project's capabilities
  integrations: [
    react({ // Enables React component usage in specified directories
      include: ["**/react/*"], // Limits React processing to specific paths
    }),
    tailwind(), // Integrates Tailwind CSS for rapid styling
    sitemap(), // Generates a sitemap to improve search engine indexing
    robotsTxt(), // Creates a robots.txt file to manage crawler access
  ],

  // Configuration for Vite, Astro's underlying build tool
  vite: {
    resolve: {
      alias: {
        "@": "/src", // Simplifies imports by setting path aliases
        "@components": "/src/components", // Alias for components directory
        "@utilities": "/src/utilities", // Alias for utility functions
        "@layout": "/src/layout", // Alias for layout-related components
        "@images": "/src/images", // Alias for images folder
      },
    },
  },

  // Define output mode as "hybrid" to combine static and server-rendered content
  output: "hybrid", // Allows for both pre-rendered and server-rendered pages based on configuration

  // Vercel adapter configuration for deployment settings
  adapter: vercel({
    webAnalytics: { enabled: true }, // Enables Vercel's web analytics to track site usage
    maxDuration: 8, // Maximum execution time for serverless functions in seconds
    devMode: process.env.NODE_ENV === "development", // Activates development-specific features
  }),

  // Configuration for handling images with optimized settings
  image: {
    domains: ['example.com'], // Specify domains from which external images can be loaded
    formats: ['webp', 'avif', 'png', 'jpg'], // Supported image formats prioritized in this order
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Set responsive image sizes for srcset attributes
    minimumCacheTTL: 60 * 60 * 24, // Cache images for at least 24 hours (in seconds)
  },
});
