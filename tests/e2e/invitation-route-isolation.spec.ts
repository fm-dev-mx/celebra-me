import { test, expect } from '@playwright/test';

test.describe('Invitation Route Isolation', () => {
	test('canonicalizes a valid invite opened on the wrong route', async ({ page }) => {
		const response = await page.goto('/xv/demo-xv-jewelry-box?invite=invite-1');
		expect(response?.headers()['cache-control']).toBe('no-store, private');
		await expect(page).toHaveURL(/\/xv\/[^/]+\?invite=invite-1$/);
	});
});
