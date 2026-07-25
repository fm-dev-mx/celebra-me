import { defineConfig, devices } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	validateAuthenticatedPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const preview = validateAuthenticatedPreviewEnvironment(process.env, {
	requireFixtureId: false,
	requireProvisioningAuthorization: true,
});

export default defineConfig({
	testDir: './tests/e2e/preview',
	testMatch: ['provision-preview-fixture.spec.ts'],
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: 'output/playwright/preview-provision',
	use: {
		...devices['Desktop Chrome'],
		baseURL: preview.runtime.baseURL,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
	},
	projects: [{ name: 'preview-fixture-provision' }],
});
