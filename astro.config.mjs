// astro.config.mjs

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; // Automatic site map generation for SEO
import robotsTxt from 'astro-robots-txt'; // Automatic robots.txt generation for SEO
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'url';

export default defineConfig({
	// The base URL for the site.
	site:
		process.env.NODE_ENV === 'development'
			? 'http://127.0.0.1:4321'
			: process.env.BASE_URL || 'https://www.celebra-me.com',

	integrations: [react(), sitemap(), robotsTxt()],
	image: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'res.cloudinary.com',
			},
			{
				protocol: 'https',
				hostname: 'images.unsplash.com',
			},
		],
	},
	vite: {
		resolve: {
			alias: {
				// Base Src Alias
				'@': fileURLToPath(new URL('./src', import.meta.url)),

				// Core Domain Aliases
				'@api': fileURLToPath(new URL('./src/pages/api', import.meta.url)),
				'@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
				'@components': fileURLToPath(new URL('./src/components', import.meta.url)),
				'@content': fileURLToPath(new URL('./src/content', import.meta.url)),
				'@data': fileURLToPath(new URL('./src/data', import.meta.url)),
				'@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
				'@images': fileURLToPath(new URL('./src/assets/images', import.meta.url)),
				'@interfaces': fileURLToPath(new URL('./src/interfaces', import.meta.url)),
				'@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
				'@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
				'@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
				'@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
			},
		},
	},

	output: 'server',
	adapter: vercel({
		webAnalytics: { enabled: true },
		maxDuration: 30, // Increase limit for serverless functions
		imageService: true, // Enable Vercel's image optimization for local images
		imagesConfig: {
			sizes: [320, 640, 960, 1200, 1800],
			domains: ['images.unsplash.com', 'res.cloudinary.com'], // Allow external images
		},
	}),
});
