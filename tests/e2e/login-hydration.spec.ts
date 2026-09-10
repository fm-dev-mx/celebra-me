import { expect, test } from '@playwright/test';

test.describe('Authentication before hydration', () => {
	test.use({ javaScriptEnabled: false });

	test('keeps credentials out of navigation before the handlers are ready', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('#login-submit')).toBeDisabled();
		await expect(page.locator('#register-submit')).toBeDisabled();
		await expect(page.locator('#login-form')).toHaveAttribute('method', 'post');
		await expect(page.locator('#register-form')).toHaveAttribute('method', 'post');
		expect(await page.locator('noscript').textContent()).toContain(
			'Para iniciar sesión o registrarse, active JavaScript en su navegador.',
		);
		await page.locator('#login-email').fill('synthetic@example.test');
		await page.locator('#login-password').fill('not-a-real-password');
		await page.locator('#login-password').press('Enter');
		await expect(page).toHaveURL(/\/login$/);
	});
});

test('submits credentials once as JSON after hydration', async ({ page }) => {
	let submissions = 0;
	await page.route('**/api/auth/login-host', async (route) => {
		submissions++;
		expect(route.request().method()).toBe('POST');
		expect(new URL(route.request().url()).search).toBe('');
		expect(route.request().postDataJSON()).toMatchObject({
			password: 'not-a-real-password',
		});
		await route.fulfill({ status: 401, json: { error: 'Credenciales de prueba rechazadas.' } });
	});
	await page.goto('/login');
	await expect(page.locator('#login-submit')).toBeEnabled();
	await page.locator('#login-email').fill('synthetic@example.test');
	await page.locator('#login-password').fill('not-a-real-password');
	const response = page.waitForResponse('**/api/auth/login-host');
	await page.locator('#login-submit').click();
	await response;
	await expect(page.locator('#login-submit')).toBeEnabled();
	expect(submissions).toBe(1);
	await expect(page).toHaveURL(/\/login$/);
});
