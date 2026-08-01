// astro.config.mjs

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; // Automatic site map generation for SEO
import robotsTxt from 'astro-robots-txt'; // Automatic robots.txt generation for SEO
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'url';
import { bootstrapCelebraRuntimeEnv } from './scripts/shared/celebra-runtime-env.ts';
import { getWorktreeDevServerPort } from './scripts/shared/worktree-lane.ts';

const isBuildCommand = process.argv.includes('build');
const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

// Lane-aware env bootstrap: Local lanes use .env/.env.local; Preview lane overlays
// .env.preview.local and sets CELEBRA_RUNTIME_TARGET. Validation is fail-closed for
// local development processes; Vercel platform env remains authoritative on deploy.
const runtimeBootstrap = bootstrapCelebraRuntimeEnv({
	validate: !isVercel && !isBuildCommand,
});

// ASTRO_PORT is the supported Celebra-level override; PORT is reserved for the
// Astro CLI (`astro dev --port`) and would silently fight server.port here.
const astroPort = Number(process.env.ASTRO_PORT ?? '');
const devServerPort =
	Number.isFinite(astroPort) && astroPort > 0
		? astroPort
		: getWorktreeDevServerPort(runtimeBootstrap.lane.id);

const supabasePublicUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseStoragePathname = '/storage/v1/object/public/invitation-assets/**';
const supabaseStorageRemotePattern = supabasePublicUrl
	? (() => {
			const url = new URL(supabasePublicUrl);
			return {
				protocol: url.protocol.replace(':', ''),
				hostname: url.hostname,
				port: url.port,
				pathname: supabaseStoragePathname,
			};
		})()
	: null;
const PROD_SUPABASE_HOST = process.env.PROD_SUPABASE_HOST ?? 'ineitkdkyrxqyressllp.supabase.co';

const externalImageDomains = [
	'images.unsplash.com',
	'res.cloudinary.com',
	PROD_SUPABASE_HOST,
	...(supabaseStorageRemotePattern ? [supabaseStorageRemotePattern.hostname] : []),
];

if (process.env.CELEBRA_ENV_BOOTSTRAP_LOG === '1') {
	console.info(
		`[celebra-env] lane=${runtimeBootstrap.lane.id} target=${runtimeBootstrap.target} source=${runtimeBootstrap.source}`,
	);
}

export default defineConfig({
	// The base URL for the site.
	site:
		process.env.NODE_ENV === 'development'
			? `http://127.0.0.1:${devServerPort}`
			: process.env.BASE_URL || 'https://www.celebra-me.com',

	integrations: [react(), sitemap(), robotsTxt()],
	server: {
		port: devServerPort,
	},
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
			{
				protocol: 'https',
				hostname: PROD_SUPABASE_HOST,
				pathname: supabaseStoragePathname,
			},
			...(supabaseStorageRemotePattern ? [supabaseStorageRemotePattern] : []),
		],
	},
	vite: {
		envPrefix: ['PUBLIC_', 'VITE_'],
		server: {
			// Fail closed on lane port collisions instead of silently binding the next
			// free port (which makes browsers keep hitting another worktree on :4321).
			strictPort: true,
		},
		ssr: {
			// Native image processing must load through Node, not Vite's module runner.
			// Observability and intake image paths import sharp; bundling it under Vite SSR
			// surfaces win32 ERR_DLOPEN_FAILED and collapses API routes to opaque 500 HTML.
			external: ['sharp'],
			// Vercel's serverless loader cannot safely load sanitize-html's runtime graph:
			// bare requires in its bundled CommonJS entrypoint are not traced into the
			// function, and htmlparser2@12 is ESM-only. Bundle the bounded SSR chain.
			noExternal: isBuildCommand
				? [
						'sanitize-html',
						'escape-string-regexp',
						'is-plain-object',
						'deepmerge',
						'parse-srcset',
						'postcss',
						'picocolors',
						'source-map-js',
						'nanoid',
						'launder',
						'dayjs',
						'htmlparser2',
						'entities',
						'domhandler',
						'domelementtype',
						'domutils',
						'dom-serializer',
					]
				: undefined,
		},
		define: {
			'import.meta.env.PUBLIC_GOOGLE_ANALYTICS_ID': JSON.stringify(
				process.env.PUBLIC_GOOGLE_ANALYTICS_ID ?? '',
			),
		},
		optimizeDeps: {
			include: ['framer-motion'],
		},
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
		// Vercel Web Analytics is mounted via <Analytics /> in Layout.astro.
		// Keeping adapter-level webAnalytics off avoids duplicate client script injection
		// with @vercel/analytics 2.x.
		maxDuration: 30, // Increase limit for serverless functions
		imageService: true, // Enable Vercel's image optimization for local images
		imagesConfig: {
			sizes: [320, 640, 960, 1200, 1600, 1800],
			domains: externalImageDomains, // Allow external images
		},
	}),
});
