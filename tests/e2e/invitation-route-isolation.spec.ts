import { test, expect } from '@playwright/test';

test.describe('Invitation Route Isolation', () => {
	test('canonicalizes a valid invite opened on the wrong route', async ({ page }) => {
		await page.goto('/xv/demo-xv?invite=invite-1');
		await expect(page).toHaveURL(/\/xv\/[^/]+\?invite=invite-1$/);
	});
});
