// astro.config.mjs

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; // Automatic site map generation for SEO
import robotsTxt from 'astro-robots-txt'; // Automatic robots.txt generation for SEO
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

/**
 * Allowlist of project-owned environment variables that local .env may
 * override in development.  This prevents stale terminal/CI exports from
 * shadowing the intended local configuration.
 *
 * Only applied when NODE_ENV is explicitly 'development' so that platform
 * variables (Vercel, CI runners) remain authoritative during production
 * builds and deployments.
 *
 * Non-allowlisted non-prefixed vars are still propagated from .env but
 * only when unset — preserving the original safety guard for everything
 * not on this list.
 */
const LOCAL_OVERRIDE_KEYS = new Set([
	'SUPABASE_URL',
	'SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'PUBLIC_SUPABASE_URL',
	'PUBLIC_SUPABASE_ANON_KEY',
	'BASE_URL',
	'NODE_ENV',
	'TRUST_DEVICE_SECRET',
	'TRUST_DEVICE_MAX_AGE_DAYS',
	'RSVP_CLAIM_CODE_PEPPER',
	'INTAKE_TOKEN_ENCRYPTION_KEY',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
	'RSVP_V2_DISTRIBUTED_RATELIMIT',
	'SUPER_ADMIN_EMAILS',
	'RSVP_ADMIN_USER',
	'RSVP_ADMIN_PASSWORD',
	'LOCAL_SUPER_ADMIN_PASSWORD',
	'REQUIRE_FRESH_MFA_FOR_ADMIN',
	'DEV_MFA_BYPASS',
	'VERCEL_AUTOMATION_BYPASS_SECRET',
	'GMAIL_USER',
	'GMAIL_PASS',
	'CONTACT_FORM_RECIPIENT_EMAIL',
	'CONTACT_WHATSAPP',
	'PUBLIC_GOOGLE_ANALYTICS_ID',
	'PUBLIC_GA_MEASUREMENT_ID',
	'PUBLIC_META_PIXEL_ID',
	'PUBLIC_META_PIXEL_ENABLED',
	'META_CAPI_DELIVERY_MODE',
	'META_CAPI_ACCESS_TOKEN',
	'META_TEST_EVENT_CODE',
]);

const isLocalDev = process.env.NODE_ENV === 'development';

// Propagate .env vars to process.env so server-only code (env.ts, auth-api)
// can read them without a filesystem fallback. Vite 7+ does not do this
// automatically for non-prefixed vars.
for (const [key, value] of Object.entries(env)) {
	if (isLocalDev && LOCAL_OVERRIDE_KEYS.has(key)) {
		// Local development: allow .env to override inherited shell values
		// so terminal/CI exports cannot shadow the intended configuration.
		process.env[key] = value;
	} else if (process.env[key] === undefined) {
		// Production / CI or non-allowlisted key: preserve platform env vars,
		// fill in gaps from .env only when unset.
		process.env[key] = value;
	}
}

const supabasePublicUrl = process.env.PUBLIC_SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL;
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
