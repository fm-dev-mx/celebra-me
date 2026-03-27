import { defineConfig, devices } from '@playwright/test';

const webServerCommand =
	process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'pnpm dev --host 127.0.0.1 --port 4321';
const webServerUrl = process.env.PLAYWRIGHT_WEB_SERVER_URL || 'http://127.0.0.1:4321';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || webServerUrl,
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
		command: webServerCommand,
		url: webServerUrl,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
