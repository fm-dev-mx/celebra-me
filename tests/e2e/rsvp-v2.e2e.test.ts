import { expect, test } from '@playwright/test';

test.describe('RSVP v2 Flow', () => {
	test.setTimeout(60000);

	test('guest can reveal invitation and submit RSVP successfully', async ({ page }) => {
		// 1. Visit demo invitation with mock inviteId
		// We use the XV demo as a stable target
		await page.goto('/xv/demo-xv?invite=demo-invite&forceEnvelope=true', {
			waitUntil: 'networkidle',
		});

		// 2. Open Envelope
		const openButton = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await expect(openButton).toBeVisible();
		await openButton.click();

		// Wait for revelation animation
		await page.waitForFunction(() => document.body.classList.contains('invitation-revealed'));
		await page.waitForTimeout(1500);

		// 3. Scroll to RSVP Section
		const rsvpSection = page.locator('#rsvp');
		await rsvpSection.scrollIntoViewIfNeeded();
		await expect(rsvpSection).toBeVisible();

		// 4. Fill RSVP Form
		// Attendance radio
		const willAttend = page.getByLabel('Confirmar asistencia');
		await willAttend.check();

		// Guest count / names
		const guestCount = page.locator('select[name="attendeeCount"]');
		if (await guestCount.isVisible()) {
			await guestCount.selectOption('2');
		}

		// Message
		const guestMessage = page.locator('textarea[name="guestMessage"]');
		if (await guestMessage.isVisible()) {
			await guestMessage.fill('¡Gracias por la invitación! Ahí estaremos.');
		}

		// 5. Submit
		const submitButton = page.getByRole('button', { name: /confirmar|enviar/i });
		await submitButton.click();

		// 6. Verify Success
		// Look for success message or state change
		await expect(page.locator('text=/confirmado|gracias/i')).toBeVisible();
	});
});
