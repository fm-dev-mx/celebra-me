import { test, expect } from '@playwright/test';

test.describe('Demo Routing Parity', () => {
	test('renders a public demo event correctly without an inviteId', async ({ page }) => {
		// A demo event provides high-fidelity showcase without requiring personalization
		const response = await page.goto('/xv/demo-xv?forceEnvelope=true', {
			waitUntil: 'networkidle',
		});
		expect(response?.ok()).toBeTruthy();

		// Should render the main envelope, revealing the event
		await expect(page.locator('.envelope-wrapper')).toBeVisible();

		// Opening the envelope exposes the underlying components
		await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
		await page.waitForFunction(() => document.body.classList.contains('invitation-revealed'));

		// Core sections should mount correctly
		await expect(page.locator('#inicio')).toBeVisible();
		await expect(page.locator('#family-section')).toBeVisible();

		// The RSVP component should mount (even if in a limited demo mode or hybrid access mode)
		const rsvpSection = page.locator('#rsvp');
		await expect(rsvpSection).toBeVisible();
	});

	test('degrades gracefully without redirecting when demo route is accessed with invalid inviteId', async ({
		page,
	}) => {
		// The route personalization layer must catch errors but NOT block demo routes
		const response = await page.goto('/xv/demo-xv?invite=invalid-demo-id', {
			waitUntil: 'networkidle',
		});
		expect(response?.ok()).toBeTruthy();

		// Validate that the URL remains intact and standard fallback rendering occurs
		const url = page.url();
		expect(url).toContain('invite=invalid-demo-id');
		await expect(page.locator('main')).toBeVisible();
	});
});
