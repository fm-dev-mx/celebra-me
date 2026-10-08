import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated port for the GA4 production-build regression server. It must not collide with a
 * worktree lane's dev server (4321 Integration/dev-local, 4322 dev-extra, 4323 dev-preview,
 * 4399 unknown; see `scripts/shared/worktree-lane.ts`) or the 4324 fallback Astro picks when a
 * lane port is busy, because the server below never reuses an existing one.
 */
const GA4_DEV_SERVER_PORT = 4330;
const GA4_BASE_URL = `http://127.0.0.1:${GA4_DEV_SERVER_PORT}`;

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/ga4-browser-regression.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: GA4_BASE_URL,
		trace: 'on-first-retry',
		viewport: { width: 1280, height: 720 },
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: `pnpm dev --host 127.0.0.1 --port ${GA4_DEV_SERVER_PORT}`,
		url: GA4_BASE_URL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			VERCEL_ENV: 'production',
			PUBLIC_GA_MEASUREMENT_ID: 'G-TEST',
			PUBLIC_GOOGLE_ANALYTICS_ID: '',
		},
	},
});
