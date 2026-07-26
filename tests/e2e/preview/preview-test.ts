import { test as base, expect } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	type PreviewExecutionMode,
	validateAuthenticatedPreviewEnvironment,
} from '../../../scripts/playwright/preview-environment';
import { establishDeploymentProtectionBypass } from './support';

loadPlaywrightEnvironment();
const configuredExecutionMode = process.env.PLAYWRIGHT_PREVIEW_EXECUTION_MODE ?? 'read-only';
if (!['read-only', 'provision', 'publication'].includes(configuredExecutionMode)) {
	throw new Error('PLAYWRIGHT_PREVIEW_EXECUTION_MODE is invalid.');
}
const executionMode = configuredExecutionMode as PreviewExecutionMode;
export const previewEnvironment = validateAuthenticatedPreviewEnvironment(process.env, {
	executionMode,
});

export const test = base.extend({
	page: async ({ page }, use) => {
		await establishDeploymentProtectionBypass(page, previewEnvironment.runtime);
		await use(page);
	},
});

export { expect };
