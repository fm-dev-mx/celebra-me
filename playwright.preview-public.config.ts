import { defineConfig, devices } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	PREVIEW_OUTPUT_ROOT,
	validateReadOnlyPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const runtime = validateReadOnlyPreviewEnvironment();

export default defineConfig({
	testDir: './tests/e2e/preview',
	testMatch: ['public-preview-smoke.spec.ts'],
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: `${PREVIEW_OUTPUT_ROOT}/preview-public`,
	preserveOutput: 'never',
	use: {
		...devices['Desktop Chrome'],
		baseURL: runtime.baseURL,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		storageState: undefined,
	},
	projects: [{ name: 'preview-public-smoke' }],
});
