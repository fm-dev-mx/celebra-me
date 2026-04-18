import { expect, test } from '@playwright/test';

test.describe('RSVP v2 Flow', () => {
	test.setTimeout(60000);

	test('guest can reveal invitation and submit RSVP successfully', async ({ page }) => {
		// Mock the API endpoint since demo events reject public RSVP submissions via API
		await page.route('**/api/invitacion/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'RSVP saved.' }),
			});
		});

		// 1. Visit demo invitation with mock inviteId
		// We use the XV demo as a stable target
		await page.goto(
			'/xv/demo-xv?invite=00000000-0000-0000-0000-000000000000&forceEnvelope=true',
			{
				waitUntil: 'domcontentloaded',
			},
		);

		// 2. Open Envelope
		const openButton = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await expect(openButton).toBeVisible();
		await openButton.click();

		// Wait for revelation animation
		await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
			'data-reveal-state',
			'revealed',
		);
		await page.waitForTimeout(1500);

		// 3. Scroll to RSVP Section
		const rsvpSection = page.locator('#rsvp');
		await rsvpSection.scrollIntoViewIfNeeded();
		await expect(rsvpSection).toBeVisible();

		// Wait for Astro to hydrate the client:visible React island
		await page.waitForTimeout(1500);

		// 4. Fill RSVP Form
		// Attendance - check the radio natively (force: true needed for sr-only inputs and dev-toolbar)
		await page.locator('#attendance-yes').check({ force: true });

		// Name
		const nameInput = page.locator('#name');
		await nameInput.fill('Test Guest');

		// Guest count / names
		try {
			const guestCount = page.locator('#guestCount');
			await guestCount.waitFor({ state: 'visible', timeout: 1000 });
			await guestCount.fill('2');
		} catch (e) {
			// Guest count is optional and might be hidden based on Cap=1
		}

		// Message
		try {
			const guestComment = page.locator('#notes');
			await guestComment.waitFor({ state: 'visible', timeout: 1000 });
			await guestComment.fill('¡Gracias por la invitación! Ahí estaremos.');
		} catch (e) {
			// Notes section is conditionally animated
		}

		// Wait for animation frame to ensure the DOM is settled
		await page.waitForTimeout(500);

		// 5. Submit
		const submitButton = page.getByRole('button', { name: /confirmar|enviar/i });
		await expect(submitButton).toBeVisible();
		await submitButton.click();

		// 6. Verify Success
		// Look for success message or state change
		await expect(
			page.locator('#rsvp').locator('text=/confirmado|gracias/i').first(),
		).toBeVisible();
	});
});
