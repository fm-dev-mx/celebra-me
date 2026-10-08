import { definePreviewPlaywrightConfig } from './scripts/playwright/preview-config';
import {
	loadPlaywrightEnvironment,
	PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS,
	validateAuthenticatedPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const preview = validateAuthenticatedPreviewEnvironment(process.env, {
	executionMode: 'provision',
});
process.env.PLAYWRIGHT_PREVIEW_EXECUTION_MODE = 'provision';

export default definePreviewPlaywrightConfig({
	baseURL: preview.runtime.baseURL,
	testMatch: ['provision-preview-fixture.spec.ts'],
	timeout: PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS * 3,
	outputName: 'preview-provision',
	projectName: 'preview-fixture-provision',
});
