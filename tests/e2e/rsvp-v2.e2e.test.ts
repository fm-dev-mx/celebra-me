import { expect, test, type Page } from '@playwright/test';

// A public (hybrid) invitation of the canonical corpus. The RSVP endpoint is mocked: the test proves
// the form, the request it sends and the confirmation the guest sees, never a database write.
const ROUTE = '/cumple/alba-rosa-quinonez?skipEnvelope=true';
const PUBLIC_RSVP = '**/api/invitacion/public/cumple/alba-rosa-quinonez/rsvp';

async function acceptNecessaryCookiesOnly(page: Page) {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'cm_consent',
			JSON.stringify({
				necessary: true,
				analytics: false,
				marketing: false,
				updatedAt: new Date().toISOString(),
			}),
		);
	});
}

async function openRsvp(page: Page) {
	await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
	const rsvp = page.locator('#rsvp');
	await rsvp.scrollIntoViewIfNeeded();
	// A tap before the island hydrates checks the native radio without reaching React.
	await page.waitForFunction(() => {
		const island = document.querySelector('#rsvp')?.closest('astro-island');
		return Boolean(island) && !island?.hasAttribute('ssr');
	});
	await expect(rsvp.locator('label[for="attendance-yes"]')).toBeVisible();
	return rsvp;
}

test.describe('Public RSVP flow', () => {
	test.beforeEach(async ({ page }) => {
		await acceptNecessaryCookiesOnly(page);
	});

	test('a guest confirms attendance and the form sends one RSVP', async ({ page }) => {
		const requests: unknown[] = [];
		await page.route(PUBLIC_RSVP, async (route) => {
			requests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					data: { inviteId: '00000000-0000-4000-8000-000000000001' },
				}),
			});
		});
		const rsvp = await openRsvp(page);

		await rsvp.locator('label[for="attendance-yes"]').click();
		// The answer step folds into a summary and opens the identity step.
		await expect(rsvp.getByRole('button', { name: 'Cambiar' })).toBeVisible();
		await rsvp.getByRole('textbox', { name: /Tu nombre/ }).fill('Invitada de Prueba');
		await rsvp.getByRole('textbox', { name: /Teléfono de contacto/ }).fill('6141234567');
		await rsvp.getByRole('spinbutton', { name: /Número de asistentes/ }).fill('2');
		await rsvp.getByRole('button', { name: 'Confirmar asistencia' }).click();

		await expect.poll(() => requests.length).toBe(1);
		expect(requests[0]).toMatchObject({
			fullName: 'Invitada de Prueba',
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			countryCode: '+52',
		});
		await expect(rsvp).toContainText('Su asistencia ha quedado registrada.');
	});

	test('a declined answer sends no party size above zero', async ({ page }) => {
		const requests: Array<{ attendanceStatus?: string; attendeeCount?: number }> = [];
		await page.route(PUBLIC_RSVP, async (route) => {
			requests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					data: { inviteId: '00000000-0000-4000-8000-000000000002' },
				}),
			});
		});
		const rsvp = await openRsvp(page);

		await rsvp.locator('label[for="attendance-no"]').click();
		await expect(rsvp.getByRole('button', { name: 'Cambiar' })).toBeVisible();
		await rsvp.getByRole('textbox', { name: /Tu nombre/ }).fill('Invitado Ausente');
		await rsvp.getByRole('textbox', { name: /Teléfono de contacto/ }).fill('6141234567');
		await rsvp.getByRole('button', { name: /confirmar|enviar/i }).click();

		await expect.poll(() => requests.length).toBe(1);
		expect(requests[0]?.attendanceStatus).toBe('declined');
		expect(requests[0]?.attendeeCount ?? 0).toBe(0);
	});
});
