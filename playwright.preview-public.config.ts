import { defineConfig, devices } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	resolvePlaywrightRuntimeEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
if (!process.env.PLAYWRIGHT_BASE_URL?.trim()) {
	throw new Error('External Preview smoke testing requires PLAYWRIGHT_BASE_URL.');
}
const runtime = resolvePlaywrightRuntimeEnvironment();
if (!runtime.isVercelPreview) {
	throw new Error('External Preview smoke testing requires an HTTPS *.vercel.app URL.');
}
if (!runtime.protectionHeaders) {
	throw new Error('External Preview smoke testing requires VERCEL_AUTOMATION_BYPASS_SECRET.');
}

export default defineConfig({
	testDir: './tests/e2e/preview',
	testMatch: ['public-preview-smoke.spec.ts'],
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: 'output/playwright/preview-public',
	use: {
		...devices['Desktop Chrome'],
		baseURL: runtime.baseURL,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
	},
	projects: [{ name: 'preview-public-smoke' }],
});
