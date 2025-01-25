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
				// Core aliases
				'@': fileURLToPath(new URL('./src', import.meta.url)),
				'@core': fileURLToPath(new URL('./src/core', import.meta.url)),
				'@config': fileURLToPath(new URL('./src/core/config', import.meta.url)),
				'@customTypes': fileURLToPath(new URL('./src/core/types', import.meta.url)),
				'@interfaces': fileURLToPath(new URL('./src/core/interfaces', import.meta.url)),
				'@utilities': fileURLToPath(new URL('./src/core/utilities', import.meta.url)),
				'@helpers': fileURLToPath(new URL('./src/core/helpers', import.meta.url)),
				'@data': fileURLToPath(new URL('./src/core/data', import.meta.url)),

				// Frontend aliases
				'@frontend': fileURLToPath(new URL('./src/frontend', import.meta.url)),
				'@components': fileURLToPath(new URL('./src/frontend/components', import.meta.url)),
				'@layouts': fileURLToPath(new URL('./src/frontend/layouts', import.meta.url)),
				'@hooks': fileURLToPath(new URL('./src/frontend/hooks', import.meta.url)),
				'@styles': fileURLToPath(new URL('./src/frontend/styles', import.meta.url)),
				'@assets': fileURLToPath(new URL('./src/frontend/assets', import.meta.url)),
				'@images': fileURLToPath(new URL('./src/frontend/assets/images', import.meta.url)),
				'@icons': fileURLToPath(new URL('./src/frontend/assets/icons', import.meta.url)),
				'@fonts': fileURLToPath(new URL('./src/frontend/assets/fonts', import.meta.url)),

				// Backend aliases
				'@backend': fileURLToPath(new URL('./src/backend', import.meta.url)),
				'@api': fileURLToPath(new URL('./src/pages/api', import.meta.url)),
				'@services': fileURLToPath(new URL('./src/backend/services', import.meta.url)),
				'@controllers': fileURLToPath(
					new URL('./src/backend/controllers', import.meta.url),
				),
				'@repositories': fileURLToPath(
					new URL('./src/backend/repositories', import.meta.url),
				),
				'@middlewares': fileURLToPath(
					new URL('./src/backend/middlewares', import.meta.url),
				),
				'@models': fileURLToPath(new URL('./src/backend/models', import.meta.url)),
				'@db': fileURLToPath(new URL('./src/backend/database', import.meta.url)),
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
