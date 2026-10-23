import { test, expect } from '@playwright/test';

test.describe('Invitation Route Isolation', () => {
	test('canonicalizes a valid invite opened on the wrong route', async ({ page }) => {
		const response = await page.goto('/xv/demo-xv-enchanted-rose?invite=invite-1');
		expect(response?.headers()['cache-control']).toBe('no-store, private');
		// The long demo route moves to its short alias and keeps the invite parameter.
		await expect(page).toHaveURL(/\/rose\?invite=invite-1$/);
	});
});
