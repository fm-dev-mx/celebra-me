// astro.config.mjs

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; // Automatic site map generation for SEO
import robotsTxt from 'astro-robots-txt'; // Automatic robots.txt generation for SEO
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import cloudflare from '@astrojs/cloudflare';
import { fileURLToPath } from 'url';
import {
	bootstrapCelebraRuntimeEnv,
	parseDeployEnvironment,
} from './scripts/shared/celebra-runtime-env.ts';
import { getWorktreeDevServerPort } from './scripts/shared/worktree-lane.ts';
import { buildRobotsPolicy } from './src/lib/seo/robots-policy.ts';
import { SECURITY_HEADERS } from './src/lib/server/security-headers.ts';
import { appendStaticSecurityHeaders } from './scripts/shared/cloudflare-static-headers.ts';
import { readFile, writeFile } from 'node:fs/promises';

const isBuildCommand = process.argv.includes('build');
// Temporary dual hosting target while Preview moves to Cloudflare Workers: `vercel` (default)
// or `cloudflare`. The Cloudflare build reads wrangler.jsonc and bundles src/worker.ts.
const buildTarget = process.env.CELEBRA_BUILD_TARGET || 'vercel';
if (buildTarget !== 'vercel' && buildTarget !== 'cloudflare') {
	throw new Error('CELEBRA_BUILD_TARGET must be "vercel" or "cloudflare" when set.');
}
const isCloudflareBuild = buildTarget === 'cloudflare';
// Hosted builds declare their deploy identity; local processes never do. An invalid
// declaration fails the build instead of producing a bundle that throws at runtime.
const isHostedBuild = parseDeployEnvironment(process.env.CELEBRA_DEPLOY_ENV) !== null;
// Build identity reported by /api/health. GitHub Actions exposes GITHUB_SHA; the
// Vercel build fallbacks leave together with the Vercel build.
const buildCommitSha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
const buildGitRef = process.env.GITHUB_REF_NAME || process.env.VERCEL_GIT_COMMIT_REF || '';
const configuredBaseUrl = process.env.BASE_URL;
const publicSiteUrl =
	configuredBaseUrl &&
	!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/i.test(configuredBaseUrl)
		? configuredBaseUrl
		: 'https://www.celebra-me.com';

// Lane-aware env bootstrap: Local lanes use .env/.env.local; Preview lane overlays
// .env.preview.local and sets CELEBRA_RUNTIME_TARGET. Validation is fail-closed for
// local development processes; the hosting platform env remains authoritative on deploy.
const runtimeBootstrap = bootstrapCelebraRuntimeEnv({
	validate: !isHostedBuild && !isBuildCommand,
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
	'media.celebra-me.com',
	'media-staging.celebra-me.com',
	PROD_SUPABASE_HOST,
	...(supabaseStorageRemotePattern ? [supabaseStorageRemotePattern.hostname] : []),
];

if (process.env.CELEBRA_ENV_BOOTSTRAP_LOG === '1') {
	console.info(
		`[celebra-env] lane=${runtimeBootstrap.lane.id} target=${runtimeBootstrap.target} source=${runtimeBootstrap.source}`,
	);
}

/**
 * Dev-only integration: injects the visual test harness route (/test/variant) exclusively
 * when running local Playwright visual suites (ENABLE_TEST_VARIANT_HARNESS=1) under `astro dev`.
 * The harness page lives at tests/e2e/harness/variant.astro (outside src/). It is never injected
 * during builds or standard dev servers, so the route is absent from the production bundle, sitemap,
 * and deployed routes.
 */
function testVariantHarnessIntegration() {
	return {
		name: 'test-variant-harness',
		hooks: {
			'astro:config:setup': ({ command, injectRoute }) => {
				if (command === 'dev' && process.env.ENABLE_TEST_VARIANT_HARNESS === '1') {
					injectRoute({
						pattern: '/test/variant',
						entrypoint: './tests/e2e/harness/variant.astro',
						prerender: false,
					});
				}
			},
		},
	};
}

/**
 * Dev-only integration: checks if local Supabase is responding and warns if unreachable.
 * Service recovery belongs to the operator; starting Astro must not restart shared containers.
 */
function supabaseDevPreflightIntegration() {
	return {
		name: 'supabase-dev-preflight',
		hooks: {
			'astro:server:start': async () => {
				const supabaseUrl = process.env.SUPABASE_URL;
				if (
					!supabaseUrl ||
					(!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost'))
				) {
					return;
				}
				try {
					const controller = new AbortController();
					const timer = setTimeout(() => controller.abort(), 350);
					const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`, {
						signal: controller.signal,
					}).catch(() => null);
					clearTimeout(timer);

					if (res && res.ok) return;

					console.warn(
						'\x1b[33m%s\x1b[0m',
						`▲ [supabase] Aviso: El servicio local de Supabase no responde en ${supabaseUrl}.`,
					);
					console.warn(
						'\x1b[33m%s\x1b[0m',
						'  Si va a utilizar autenticación de anfitriones o base de datos, ejecute: pnpm db:start\n',
					);
				} catch {
					// Non-blocking preflight check
				}
			},
		},
	};
}

/**
 * Cloudflare build only: prerendered pages are static assets that skip the middleware, so
 * their security headers come from a `_headers` rule (Vercel applies vercel.json instead).
 */
function cloudflareStaticSecurityHeadersIntegration() {
	return {
		name: 'cloudflare-static-security-headers',
		hooks: {
			'astro:build:done': async ({ dir }) => {
				if (!isCloudflareBuild) return;
				const headersPath = new URL('./_headers', dir);
				const existing = await readFile(headersPath, 'utf8').catch(() => '');
				await writeFile(
					headersPath,
					appendStaticSecurityHeaders(existing, SECURITY_HEADERS),
				);
			},
		},
	};
}

export default defineConfig({
	// The base URL for the site.
	site:
		!isHostedBuild && !isBuildCommand && process.env.NODE_ENV === 'development'
			? `http://127.0.0.1:${devServerPort}`
			: publicSiteUrl,

	integrations: [
		react(),
		sitemap({
			filter: (page) => {
				const url = new URL(page);
				const p = url.pathname;
				const clean = p.replace(/\/+$/, '');
				return (
					!p.startsWith('/dashboard') &&
					!p.startsWith('/api') &&
					!p.startsWith('/r/') &&
					!p.startsWith('/captura') &&
					!['/login', '/404'].includes(clean)
				);
			},
		}),
		// Open site, private paths closed, AI training refused, AI assistants kept off invitations.
		robotsTxt({ policy: buildRobotsPolicy() }),
		testVariantHarnessIntegration(),
		supabaseDevPreflightIntegration(),
		cloudflareStaticSecurityHeadersIntegration(),
	],
	server: {
		port: devServerPort,
	},
	image: {
		// `astro dev` renders through sharp; match the hosted Cloudflare fit (see the service).
		...(isCloudflareBuild
			? {}
			: { service: { entrypoint: './src/lib/assets/dev-image-service.ts' } }),
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'res.cloudinary.com',
			},
			{
				protocol: 'https',
				hostname: 'media.celebra-me.com',
			},
			{
				protocol: 'https',
				hostname: 'media-staging.celebra-me.com',
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
			{
				protocol: 'http',
				hostname: '127.0.0.1',
				port: '54321',
				pathname: supabaseStoragePathname,
			},
			{
				protocol: 'http',
				hostname: 'localhost',
				port: '54321',
				pathname: supabaseStoragePathname,
			},
			...(supabaseStorageRemotePattern ? [supabaseStorageRemotePattern] : []),
		],
	},
	vite: {
		envPrefix: ['PUBLIC_', 'VITE_'],
		server: {
			// Immutable browser fixtures must not consume Astro's buffered startup reload.
			// Keep hot reload available for normal interactive development.
			hmr: process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES === 'true' ? false : undefined,
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
			// The Cloudflare adapter bundles every dependency itself.
			noExternal:
				isBuildCommand && !isCloudflareBuild
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
			'import.meta.env.CELEBRA_BUILD_SHA': JSON.stringify(buildCommitSha),
			'import.meta.env.CELEBRA_BUILD_REF': JSON.stringify(buildGitRef),
		},
		optimizeDeps: {
			include: ['framer-motion'],
		},
		resolve: {
			alias: {
				// Base Src Alias
				'@': fileURLToPath(new URL('./src', import.meta.url)),

				// Asset Aliases
				'@images': fileURLToPath(new URL('./src/assets/images', import.meta.url)),
				'@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
			},
		},
	},

	output: 'server',
	// The app never uses Astro.session; without this the Cloudflare adapter provisions a KV
	// session namespace on every deploy.
	...(isCloudflareBuild ? { session: false } : {}),
	adapter: isCloudflareBuild
		? cloudflare({
				// Image transforms through the IMAGES binding declared in wrangler.jsonc.
				imageService: 'cloudflare-binding',
			})
		: vercel({
				maxDuration: 30, // Increase limit for serverless functions
				imageService: true, // Enable Vercel's image optimization for local images
				imagesConfig: {
					sizes: [320, 640, 960, 1200, 1600, 1800],
					domains: externalImageDomains, // Allow external images
				},
			}),
});
