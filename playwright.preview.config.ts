import { defineConfig, devices } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	PREVIEW_OUTPUT_ROOT,
	validateAuthenticatedPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const preview = validateAuthenticatedPreviewEnvironment();
process.env.PLAYWRIGHT_PREVIEW_EXECUTION_MODE = 'read-only';

export default defineConfig({
	testDir: './tests/e2e/preview',
	testMatch: ['authenticated-preview.spec.ts'],
	grepInvert: /no-change publication stays limited to the synthetic fixture/,
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: `${PREVIEW_OUTPUT_ROOT}/preview-authenticated`,
	preserveOutput: 'never',
	use: {
		...devices['Desktop Chrome'],
		baseURL: preview.runtime.baseURL,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		storageState: undefined,
	},
	projects: [{ name: 'preview-authenticated' }],
});
