import { test as base, expect } from '@playwright/test';
import {
	loadPlaywrightEnvironment,
	resolvePlaywrightRuntimeEnvironment,
} from '../../../scripts/playwright/preview-environment';
import { establishDeploymentProtectionBypass } from './support';

loadPlaywrightEnvironment();
const publicPreviewRuntime = resolvePlaywrightRuntimeEnvironment();

export const test = base.extend({
	page: async ({ page }, use) => {
		await establishDeploymentProtectionBypass(page, publicPreviewRuntime);
		await use(page);
	},
});

export { expect };
