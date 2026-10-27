import { expect, test } from '@playwright/test';
import {
	CANONICAL_ADMIN_ACCESS_TOKEN,
	CANONICAL_HOST_ACCESS_TOKEN,
} from '../../scripts/playwright/canonical-host-fixture';
import { getActiveCampaign, getPackagePrice } from '../../src/data/promo-campaign.data';

test.describe('dashboard orders', () => {
	test.use({ viewport: { width: 390, height: 844 } });
	for (const partial of [false, true]) {
		test(`creates a customer, order and ${partial ? 'partial' : 'full'} transfer on mobile`, async ({
			page,
			context,
			baseURL,
		}, testInfo) => {
			test.skip(
				process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true',
				'Requires isolated synthetic authentication; never uses a real account.',
			);
			await context.addCookies([
				{ name: 'sb-access-token', value: CANONICAL_ADMIN_ACCESS_TOKEN, url: baseURL! },
			]);
			const customer = {
				id: 'customer-orders-fixture',
				displayName: 'Cliente de prueba',
				phoneE164: '+526681234567',
			};
			const price = getPackagePrice('esencial', getActiveCampaign());
			let order: Record<string, unknown> | null = null;
			const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
			await page.route('**/api/dashboard/commercial/**', async (route) => {
				const request = route.request();
				const path = new URL(request.url()).pathname;
				const body =
					request.method() === 'POST'
						? (request.postDataJSON() as Record<string, unknown>)
						: {};
				if (request.method() === 'POST') writes.push({ path, body });
				let data: unknown;
				if (path.endsWith('/customers')) data = { outcome: 'created', customer };
				else if (path.endsWith('/deposit-paid')) {
					// Matches the existing RPC: even a full transfer retains deposit_paid.
					order = { ...order, amountPaid: body.amountPaid, status: 'deposit_paid' };
					data = { order };
				} else if (path.endsWith('/invitation-data')) {
					data =
						request.method() === 'GET'
							? null
							: {
									url: `${baseURL}/mi-invitacion/synthetic-orders-token`,
									whatsappUrl: 'https://wa.me/526681234567?text=Datos',
									expiresAt: '2027-01-01T00:00:00Z',
									summary: null,
								};
				} else if (path.endsWith('/orders') && request.method() === 'POST') {
					order = {
						...body,
						id: 'order-orders-fixture',
						orderNumber: 'CMO-FIXTURE',
						amountPaid: 0,
					};
					data = order;
				} else data = { items: order ? [order] : [], nextOffset: null };
				await route.fulfill({ json: { success: true, data } });
			});
			await page.goto('/dashboard/pedidos');
			await expect(page.getByRole('heading', { name: 'Paso 1: Cliente' })).toBeVisible();
			const started = Date.now();
			await page.getByLabel('Nombre', { exact: true }).fill(customer.displayName);
			await page.getByLabel('Teléfono', { exact: true }).fill('6681234567');
			await page.getByRole('button', { name: 'Crear cliente y continuar' }).click();
			await expect(page.getByLabel('Total (MXN)')).toHaveValue(String(price));
			await page.getByRole('button', { name: 'Crear pedido y continuar' }).click();
			await expect(page.getByLabel('Monto recibido (MXN)')).toHaveValue(String(price));
			const amount = partial ? 250 : price;
			if (partial) await page.getByLabel('Monto recibido (MXN)').fill(String(amount));
			await page.getByRole('button', { name: 'Guardar pago por transferencia' }).click();
			await expect(
				page.getByRole('heading', { name: 'Datos de su invitación' }),
			).toBeVisible();
			await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
			await context.grantPermissions(['clipboard-read', 'clipboard-write']);
			await page.getByRole('button', { name: 'Copiar enlace' }).click();
			await expect(page.getByRole('button', { name: 'Copiado' })).toBeVisible();
			expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
				'/mi-invitacion/synthetic-orders-token',
			);
			await expect(page.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute(
				'href',
				/^https:\/\/wa.me\//,
			);
			expect(Date.now() - started).toBeLessThan(60_000);
			expect(writes).toHaveLength(4);
			expect(writes[1].body).not.toHaveProperty('depositAmount');
			expect(writes[2].body).toMatchObject({
				amountPaid: amount,
				paidAt: expect.any(String),
			});
			await expect(page.locator('.orders-workspace__row')).toContainText(
				partial ? 'Pagado parcial' : 'Pagado',
			);
			await expect(page.locator('.orders-workspace')).not.toContainText(/anticipo|50 %/i);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			).toBe(true);
			const smallTargets = await page
				.locator(
					'.orders-workspace button:visible, .orders-workspace a:visible, .orders-workspace input:visible, .orders-workspace select:visible',
				)
				.evaluateAll(
					(nodes) =>
						nodes.filter((node) => node.getBoundingClientRect().height < 44).length,
				);
			expect(smallTargets).toBe(0);
			if (!partial)
				await page.screenshot({
					path: testInfo.outputPath('orders-mobile.png'),
					fullPage: true,
				});
		});
	}
	test('redirects a host away from owner orders', async ({ context, page, baseURL }) => {
		test.skip(
			process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true',
			'Requires synthetic authentication.',
		);
		await context.addCookies([
			{ name: 'sb-access-token', value: CANONICAL_HOST_ACCESS_TOKEN, url: baseURL! },
		]);
		await page.goto('/dashboard/pedidos');
		await expect(page).toHaveURL(/\/dashboard\/invitados/);
	});
});
