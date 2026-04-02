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
		// Attendance radio - use the text "Sí, asistiré" which is more reliable
		const willAttend = page.locator('#attendance-yes');
		await willAttend.check();

		// Guest count / names
		const guestCount = page.locator('#guestCount');
		if (await guestCount.isVisible()) {
			await guestCount.fill('2');
		}

		// Message
		const guestComment = page.locator('#notes');
		if (await guestComment.isVisible()) {
			await guestComment.fill('¡Gracias por la invitación! Ahí estaremos.');
		}

		// 5. Submit
		const submitButton = page.getByRole('button', { name: /confirmar|enviar/i });
		await submitButton.click();

		// 6. Verify Success
		// Look for success message or state change
		await expect(page.locator('text=/confirmado|gracias/i')).toBeVisible();
	});
});
