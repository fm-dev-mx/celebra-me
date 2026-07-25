import { test as base, expect } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	validateAuthenticatedPreviewEnvironment,
} from '../../../scripts/playwright/preview-environment';
import { establishDeploymentProtectionBypass } from './support';

loadPlaywrightEnvironment();
export const previewEnvironment = validateAuthenticatedPreviewEnvironment(process.env, {
	requireFixtureId: false,
});

export const test = base.extend({
	page: async ({ page }, use) => {
		await establishDeploymentProtectionBypass(page, previewEnvironment.runtime);
		await use(page);
	},
});

export { expect };
