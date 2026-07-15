import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/ga4-browser-regression.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4322',
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
		command: 'pnpm dev --host 127.0.0.1 --port 4322',
		url: 'http://127.0.0.1:4322',
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			VERCEL_ENV: 'production',
			PUBLIC_GA_MEASUREMENT_ID: 'G-TEST',
			PUBLIC_GOOGLE_ANALYTICS_ID: '',
		},
	},
});
