import { expect, test, type Page } from '@playwright/test';

/**
 * «Aparta su fecha» dialog: a WhatsApp CTA opens the form, the form validates, «Solo quiero
 * preguntar» keeps the CTA's WhatsApp link, and a valid submission continues to WhatsApp with
 * the folio. The capture API is mocked, so nothing is written to a database.
 *
 * The dialog renders only with a real contact number (CONTACT_WHATSAPP); without one the CTAs
 * keep linking straight to WhatsApp and this spec has nothing to check.
 */

const LEAD_CODE = 'CM-E2E234';
const DEMO_PATH = '/xv/demo-xv-celestial-blue?skipEnvelope=true';

function futureIsoDate(days = 90): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function mockCapture(page: Page) {
	const requests: Record<string, unknown>[] = [];
	await page.route('**/api/leads/capture', async (route) => {
		requests.push(route.request().postDataJSON() as Record<string, unknown>);
		await route.fulfill({
			status: 201,
			contentType: 'application/json',
			body: JSON.stringify({ data: { leadCode: LEAD_CODE } }),
		});
	});
	// WhatsApp is the destination, not part of the test: answer it locally.
	await page.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }),
	);
	return requests;
}

async function requireDialog(page: Page) {
	const count = await page.locator('[data-lead-capture-dialog]').count();
	test.skip(
		count === 0,
		'CONTACT_WHATSAPP is a placeholder; the capture dialog is not rendered.',
	);
}

async function fillValidForm(page: Page) {
	const dialog = page.locator('[data-lead-capture-dialog]');
	await dialog.getByLabel('Su nombre').fill('Gloria Prueba');
	await dialog.getByLabel('Tipo de evento').selectOption('xv');
	await dialog.getByLabel('Fecha del evento').fill(futureIsoDate());
	await dialog.getByLabel(/Nombre\(s\) de quien celebra/).fill('Andrea');
	await dialog.getByLabel('Su WhatsApp').fill('668 111 2233');
	// The honeypot timer drops submissions faster than a person could type.
	await page.waitForTimeout(2_100);
}

test.describe('lead capture form', () => {
	test('opens from a landing CTA, validates, and continues to WhatsApp with the folio', async ({
		page,
	}, testInfo) => {
		const requests = await mockCapture(page);
		await page.goto('/');
		await requireDialog(page);

		const trigger = page.locator('a[data-lead-capture]:visible').first();
		const triggerHref = await trigger.getAttribute('href');
		await trigger.click();

		const dialog = page.locator('[data-lead-capture-dialog]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('heading', { name: 'Aparte su fecha' })).toBeVisible();
		await expect(page).toHaveURL(/\/$/);

		const ask = dialog.getByRole('link', { name: 'Solo quiero preguntar' });
		await expect(ask).toHaveAttribute('href', triggerHref ?? '');
		await expect(ask).toHaveAttribute('data-track-cta', /__ask$/);

		await dialog.getByRole('button', { name: 'Apartar y continuar en WhatsApp' }).click();
		for (const label of ['Su nombre', 'Tipo de evento', 'Fecha del evento', 'Su WhatsApp']) {
			await expect(dialog.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
		}
		expect(requests).toHaveLength(0);

		await fillValidForm(page);
		await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);
		await expect(dialog.locator('.lead-capture__field-error:visible')).toHaveCount(0);
		await page.screenshot({ path: testInfo.outputPath('lead-capture-filled.png') });

		const whatsapp = page.waitForRequest(/https:\/\/(wa\.me|api\.whatsapp\.com)\//);
		await dialog.getByRole('button', { name: 'Apartar y continuar en WhatsApp' }).click();
		const destination = new URL((await whatsapp).url());

		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			contactName: 'Gloria Prueba',
			eventType: 'xv',
			celebrantNames: 'Andrea',
			phone: '668 111 2233',
			website: '',
		});
		expect(requests[0].eventId).toEqual(expect.any(String));
		expect(Number(requests[0].elapsedMs)).toBeGreaterThanOrEqual(2_000);

		const text = destination.searchParams.get('text') ?? '';
		expect(text).toContain('Hola, soy Gloria Prueba. Quiero apartar mi fecha.');
		expect(text).toContain('XV años de Andrea');
		expect(text).toContain(`Folio ${LEAD_CODE}`);
	});

	test('prefills the demo on a demo page and closes without sending', async ({ page }) => {
		const requests = await mockCapture(page);
		await page.goto(DEMO_PATH);
		await requireDialog(page);

		await page.locator('a[data-lead-capture]:visible').first().click();
		const dialog = page.locator('[data-lead-capture-dialog]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('Tipo de evento')).toHaveValue('xv');
		await expect(dialog.getByLabel(/Diseño que le gustó/)).toHaveValue(
			'demo-xv-celestial-blue',
		);

		await dialog.getByRole('button', { name: 'Cerrar formulario' }).click();
		await expect(dialog).toBeHidden();
		expect(requests).toHaveLength(0);
	});

	test('fits a phone screen with touch-sized controls', async ({ page }, testInfo) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockCapture(page);
		await page.goto('/');
		await requireDialog(page);

		await page.locator('a[data-lead-capture][data-track-cta="whatsapp-hero"]').click();
		const dialog = page.locator('[data-lead-capture-dialog]');
		await expect(dialog).toBeVisible();

		const box = await dialog.boundingBox();
		expect(box?.width ?? 0).toBeLessThanOrEqual(375);
		const controls = dialog.locator(
			'.lead-capture__close, .lead-capture__ask, input:not([name="website"]), select, .lead-capture__submit',
		);
		for (const control of await controls.all()) {
			if (!(await control.isVisible())) continue;
			const size = await control.boundingBox();
			expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
		}
		await page.screenshot({ path: testInfo.outputPath('lead-capture-mobile.png') });
	});
});
