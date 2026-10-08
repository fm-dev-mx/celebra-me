import { definePreviewPlaywrightConfig } from './scripts/playwright/preview-config';
import {
	loadPlaywrightEnvironment,
	validateAuthenticatedPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const preview = validateAuthenticatedPreviewEnvironment(process.env, {
	executionMode: 'publication',
});
process.env.PLAYWRIGHT_PREVIEW_EXECUTION_MODE = 'publication';

export default definePreviewPlaywrightConfig({
	baseURL: preview.runtime.baseURL,
	testMatch: ['authenticated-preview.spec.ts'],
	grep: /publication stays limited to the synthetic fixture/,
	outputName: 'preview-publication',
	projectName: 'preview-publication',
});
