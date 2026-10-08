import { definePreviewPlaywrightConfig } from './scripts/playwright/preview-config';
import {
	loadPlaywrightEnvironment,
	validateReadOnlyPreviewEnvironment,
} from './scripts/playwright/preview-environment';

loadPlaywrightEnvironment();
const runtime = validateReadOnlyPreviewEnvironment();

export default definePreviewPlaywrightConfig({
	baseURL: runtime.baseURL,
	testMatch: [
		'public-preview-smoke.spec.ts',
		'invitation-public-content.spec.ts',
		'all-published-image-delivery.spec.ts',
	],
	outputName: 'preview-public',
	projectName: 'preview-public-smoke',
});
