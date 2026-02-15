import { test, expect } from '@playwright/test';

test.describe('Authentication UI Scenarios (Spanish)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
	});

	test('Scenario: Verify Spanish Labels in Login Form', async ({ page }) => {
		// Assert critical Spanish labels using identified selectors
		await expect(page.locator('#tab-login')).toContainText('Ya tengo cuenta');
		await expect(page.locator('#tab-register')).toContainText('Soy cliente nuevo');

		// Check labels (accents might be missing in DOM as per inspection)
		await expect(page.locator('label[for="login-email"]')).toContainText('Correo');
		await expect(page.locator('label[for="login-password"]')).toContainText('Contrasena');

		await expect(page.locator('#login-submit')).toContainText('Continuar');
	});

	test('Scenario: Switch between Login and Register tabs', async ({ page }) => {
		// Click on Register tab using ID
		await page.click('#tab-register');

		// Verify register specific fields appear
		await expect(page.locator('label[for="register-claim-code"]')).toBeVisible();
		await expect(page.locator('#register-submit')).toContainText('Crear cuenta');

		// Switch back to Login
		await page.click('#tab-login');
		await expect(page.locator('#login-submit')).toContainText('Continuar');
	});

	test('Scenario: Trigger validation errors in Spanish', async ({ page }) => {
		// Trigger error in login (default tab)
		await page.click('#login-submit');

		// Verify Spanish error message
		const status = page.locator('#auth-status');
		await expect(status).toBeVisible();
		await expect(status).toContainText('Escribe un correo valido');
	});

	test('Scenario: Access restricted dashboard without session', async ({ page }) => {
		await page.goto('/dashboard/invitados');

		// Should be redirected to /login
		await expect(page).toHaveURL(/\/login/);
	});
});
