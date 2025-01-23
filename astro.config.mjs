// astro.config.mjs

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; // Automatic site map generation for SEO
import tailwind from '@astrojs/tailwind';
import robotsTxt from 'astro-robots-txt'; // Automatic robots.txt generation for SEO
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'url';

export default defineConfig({
	// The base URL for the site.
	site:
		process.env.NODE_ENV === 'development'
			? 'http://localhost:4321'
			: 'https://celebra-me.vercel.app',

	integrations: [react(), tailwind(), sitemap(), robotsTxt()],

	vite: {
		resolve: {
			alias: {
				// Used 'fileURLToPath' for cross-platform compatibility
				'@': fileURLToPath(new URL('./src', import.meta.url)),
				'@components': fileURLToPath(new URL('./src/frontend/components', import.meta.url)),
				'@utilities': fileURLToPath(new URL('./src/core/utilities', import.meta.url)),
				'@layouts': fileURLToPath(new URL('./src/frontend/layouts', import.meta.url)),
				'@interfaces': fileURLToPath(new URL('./src/core/interfaces', import.meta.url)),
			},
		},
	},
	output: 'server',
	adapter: vercel({
		webAnalytics: { enabled: true },
		maxDuration: 8, // Max duration for serverless functions in seconds
		// 'devMode' option is not necessary; Vercel adapter handles it internally
	}),
});
