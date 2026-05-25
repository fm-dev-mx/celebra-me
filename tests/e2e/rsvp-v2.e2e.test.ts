import { expect, test, type Page } from '@playwright/test';

async function openEnvelope(page: Page) {
	const openButton = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
	await expect(openButton).toBeVisible();
	await openButton.click();
	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);
	await page.waitForTimeout(1500);
}

async function scrollToRsvp(page: Page) {
	const rsvpSection = page.locator('#rsvp');
	await rsvpSection.scrollIntoViewIfNeeded();
	await expect(rsvpSection).toBeVisible();
	await page.waitForTimeout(1500);
}

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

		await page.goto(
			'/xv/demo-xv-jewelry-box?invite=00000000-0000-0000-0000-000000000000&forceEnvelope=true',
			{ waitUntil: 'domcontentloaded' },
		);

		await openEnvelope(page);
		await scrollToRsvp(page);

		// 4. Fill RSVP Form
		// Attendance - check the radio natively (force: true needed for sr-only inputs and dev-toolbar)
		await page.locator('#attendance-yes').check({ force: true });

		// Name is only visible for public RSVP or unlocked personalized invitations.
		const nameInput = page.locator('#name');
		if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
			await nameInput.fill('Test Guest');
		}

		// Guest count / names
		try {
			const guestCount = page.locator('#guestCount');
			await guestCount.waitFor({ state: 'visible', timeout: 1000 });
			await guestCount.fill('2');
		} catch {
			// Guest count is optional and might be hidden based on Cap=1
		}

		// Message
		try {
			const guestComment = page.locator('#notes');
			await guestComment.waitFor({ state: 'visible', timeout: 1000 });
			await guestComment.fill('¡Gracias por la invitación! Ahí estaremos.');
		} catch {
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

	test('mobile menu closes when RSVP attendance radio is selected', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });

		// Dismiss envelope (same pattern as layout-verify-fix.spec.ts)
		await page.evaluate(() => {
			document.querySelectorAll('ds-envelope-reveal').forEach((envelope) => {
				envelope.setAttribute('data-reveal-state', 'revealed');
				(envelope as HTMLElement).style.pointerEvents = 'none';
			});
			document.querySelectorAll('.envelope-tease').forEach((tease) => {
				(tease as HTMLElement).style.pointerEvents = 'none';
			});
		});
		await page.waitForSelector('.rsvp-section', { timeout: 5000 });
		await page.evaluate(() => {
			const section = document.querySelector('#rsvp');
			if (section) section.scrollIntoView({ block: 'center', behavior: 'instant' });
		});

		// Wait for React hydration to complete
		await page.waitForTimeout(2000);

		// Open mobile menu
		await page.evaluate(() => {
			const toggle = document.querySelector<HTMLButtonElement>('[data-nav-mobile-toggle]');
			if (toggle) toggle.click();
		});
		await page.waitForFunction(
			() =>
				document.querySelector('[data-nav-mobile-menu]')?.getAttribute('data-state') ===
				'open',
			{ timeout: 3000 },
		);

		// Interact with RSVP control — select attendance
		await page.locator('#attendance-yes').check({ force: true });
		await page.waitForTimeout(1000);

		// Menu should now be closed
		await expect(page.locator('[data-nav-mobile-menu]')).toHaveAttribute(
			'data-state',
			'closed',
			{ timeout: 5000 },
		);
	});

	test('mobile menu closes when RSVP attendance radio is selected — manual event dispatch', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });

		await page.evaluate(() => {
			document.querySelectorAll('ds-envelope-reveal').forEach((envelope) => {
				envelope.setAttribute('data-reveal-state', 'revealed');
				(envelope as HTMLElement).style.pointerEvents = 'none';
			});
			document.querySelectorAll('.envelope-tease').forEach((tease) => {
				(tease as HTMLElement).style.pointerEvents = 'none';
			});
		});
		await page.waitForSelector('.rsvp-section', { timeout: 5000 });
		await page.evaluate(() => {
			const section = document.querySelector('#rsvp');
			if (section) section.scrollIntoView({ block: 'center', behavior: 'instant' });
		});
		await page.waitForTimeout(2000);

		// Open mobile menu
		await page.evaluate(() => {
			const toggle = document.querySelector<HTMLButtonElement>('[data-nav-mobile-toggle]');
			if (toggle) toggle.click();
		});
		await page.waitForFunction(
			() =>
				document.querySelector('[data-nav-mobile-menu]')?.getAttribute('data-state') ===
				'open',
			{ timeout: 3000 },
		);

		// Manually dispatch the custom event (bypass React to test the NavBarMobile listener)
		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('celebrame:close-navigation'));
		});
		await page.waitForTimeout(500);

		// Menu should close via the custom event listener
		await expect(page.locator('[data-nav-mobile-menu]')).toHaveAttribute(
			'data-state',
			'closed',
			{ timeout: 3000 },
		);
	});
});
