import { defineConfig, devices } from '@playwright/test';
import { resolvePlaywrightRuntimeEnvironment } from './scripts/playwright/preview-environment';

// Intentionally does not load `.env.e2e.local`. That file is for Preview harness configs
// (`playwright.preview*.config.ts`). Loading it here would redirect `pnpm test:e2e:ci` /
// `pnpm run ci` at a protected Preview URL whenever the local Preview env file exists.
const webServerCommand =
	process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'pnpm dev --host 127.0.0.1 --port 4321';
const runtime = resolvePlaywrightRuntimeEnvironment();
if (runtime.isVercelPreview) {
	throw new Error(
		'Protected Vercel Preview targets must use test:e2e:preview:public or test:e2e:preview.',
	);
}

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	testIgnore: ['preview/**'],
	use: {
		baseURL: runtime.baseURL,
		trace: runtime.isExternal ? 'off' : 'on-first-retry',
		screenshot: 'off',
		video: 'off',
		viewport: { width: 1280, height: 720 },
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: runtime.isExternal
		? undefined
		: {
				command: webServerCommand,
				url: runtime.webServerURL,
				// Astro 7 auto-backgrounds `astro dev` when it detects an agent runtime. Playwright
				// must own a foreground process or it reports an early exit and leaves a detached
				// Windows server behind. This environment marker suppresses that auto-detection.
				env: { ASTRO_DEV_BACKGROUND: '1' },
				reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true',
				timeout: 120_000,
			},
});
