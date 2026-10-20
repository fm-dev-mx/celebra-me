import { test as base, expect } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	validateReadOnlyPreviewEnvironment,
} from '../../../scripts/playwright/preview-environment';
import { establishDeploymentProtectionBypass, previewAccessHeaders } from './support';

loadPlaywrightEnvironment();
const publicPreviewRuntime = validateReadOnlyPreviewEnvironment();

/** Access headers for direct page.request calls; browser requests get them from a route. */
export const publicPreviewAccessHeaders = previewAccessHeaders(publicPreviewRuntime);

export const test = base.extend({
	page: async ({ page }, use) => {
		await establishDeploymentProtectionBypass(page, publicPreviewRuntime);
		await use(page);
	},
});

export { expect };
