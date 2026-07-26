import { defineConfig, devices } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS,
	PREVIEW_OUTPUT_ROOT,
	validateAuthenticatedPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const preview = validateAuthenticatedPreviewEnvironment(process.env, {
	executionMode: 'provision',
});
process.env.PLAYWRIGHT_PREVIEW_EXECUTION_MODE = 'provision';

export default defineConfig({
	testDir: './tests/e2e/preview',
	testMatch: ['provision-preview-fixture.spec.ts'],
	timeout: PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS * 3,
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: `${PREVIEW_OUTPUT_ROOT}/preview-provision`,
	preserveOutput: 'never',
	use: {
		...devices['Desktop Chrome'],
		baseURL: preview.runtime.baseURL,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		storageState: undefined,
	},
	projects: [{ name: 'preview-fixture-provision' }],
});
