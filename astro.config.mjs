import sitemap from "@astrojs/sitemap"; // Import sitemap plugin for automatic sitemap generation
import tailwind from "@astrojs/tailwind"; // Import Tailwind CSS plugin for styling
import { defineConfig } from "astro/config"; // Import Astro's configuration function
import robotsTxt from "astro-robots-txt"; // Import robots.txt plugin for search engine crawling rules
import react from "@astrojs/react"; // Import React integration for using React components
import vercel from "@astrojs/vercel/serverless"; // Import Vercel adapter for serverless deployment

export default defineConfig({
  // Set the site URL based on the environment
  site: process.env.NODE_ENV === "development"
    ? "http://localhost:4321" // Development URL
    : "https://celebra-me.vercel.app/", // Production URL

  // Configure project integrations
  integrations: [
    // React integration: Process React components only in specified directories
    react({
      include: ["**/react/*"],
    }),
    tailwind(), // Enable Tailwind CSS for styling
    sitemap(), // Generate sitemap for better SEO
    robotsTxt(), // Generate robots.txt file for search engine crawling rules
  ],

  // Configure Vite (the underlying build tool)
  vite: {
    resolve: {
      alias: {
        // Set up import aliases for easier imports and better organization
        "@": "/src",
        "@components": "/src/components",
        "@utilities": "/src/utilities",
        "@layout": "/src/layout",
		"@images": "/src/images",
      },
    },
  },

  // Set output mode to hybrid for both static and server-side rendering capabilities
  output: "hybrid",

  // Configure Vercel adapter for deployment
  adapter: vercel({
    webAnalytics: { enabled: true }, // Enable Vercel's web analytics
    maxDuration: 8, // Set maximum duration for serverless functions (in seconds)
    devMode: process.env.NODE_ENV === "development", // Enable development mode features only in development
  }),

  // Additional configuration for image handling
  image: {
    // List of allowed domains for external images
    // Add your image CDN or other trusted sources here
    domains: ['example.com'],

    // Supported image formats
    // The order determines the priority of formats in content negotiation
    formats: ['webp', 'avif', 'png', 'jpg'],

    // Device sizes for responsive images
    // These sizes will be used to generate srcset attributes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],

    // Minimum cache TTL (Time To Live) for images in seconds
    // Here set to 1 day (60 seconds * 60 minutes * 24 hours)
    minimumCacheTTL: 60 * 60 * 24,
  },
});
