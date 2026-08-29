import { test, expect } from '@playwright/test';
import {
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesCaptureCopy,
	valentinaMemoriesPageCopy,
} from '../../src/data/valentina-memories.data';
import { VALENTINA_MEMORIES_PRODUCTION_SIGN_URL } from '../../src/data/valentina-memories-upload.contract';

const STUB_PUT_URL = 'https://r2-stub.test/put';
const STUB_OBJECT_KEY = 'events/valentina/550e8400-e29b-41d4-a716-446655440000.jpg';

async function uploadSampleJpeg(page: import('@playwright/test').Page) {
	const fileInput = page.locator('[data-capture="valentina-memories"] input[type="file"]');
	await expect(fileInput).toBeEnabled();
	await page.waitForLoadState('networkidle');
	await fileInput.setInputFiles({
		name: 'foto.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
	});
}

test.describe('Valentina Memories capture route', () => {
	test('serves a prerendered noindex capture page and completes a stubbed upload', async ({
		page,
	}) => {
		let signPayload: unknown;
		await page.route(VALENTINA_MEMORIES_PRODUCTION_SIGN_URL, async (route) => {
			if (route.request().method() === 'OPTIONS') {
				await route.fulfill({ status: 204 });
				return;
			}

			signPayload = route.request().postDataJSON();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					uploadUrl: STUB_PUT_URL,
					objectKey: STUB_OBJECT_KEY,
					expiresAt: '2026-08-29T21:50:00.000Z',
				}),
			});
		});
		await page.route('**/api/memories/valentina/session', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify({
						sessionId: 'session-e2e',
						recoveryCode: 'ABCD-2345-EFGH',
					}),
				});
				return;
			}
			await route.fulfill({ status: 404 });
		});
		await page.route('**/api/memories/valentina/items**', async (route) => {
			const method = route.request().method();
			if (method === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ items: [] }),
				});
				return;
			}
			if (method === 'POST') {
				const url = route.request().url();
				const body = url.endsWith('/items')
					? { item: { id: 'media-e2e' } }
					: { item: { id: 'media-e2e', status: 'validating' } };
				await route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify(body),
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true }),
			});
		});
		await page.route(STUB_PUT_URL, async (route) => {
			expect(route.request().method()).toBe('PUT');
			expect(route.request().headers()['content-type']).toBe('image/jpeg');
			await route.fulfill({ status: 200, body: '' });
		});

		const response = await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, {
			waitUntil: 'domcontentloaded',
		});

		expect(response?.ok()).toBeTruthy();
		expect(response?.status()).toBe(200);

		await expect(page.locator('h1.status-page__title')).toHaveText(
			valentinaMemoriesPageCopy.heading,
		);
		await expect(page.locator('.status-page__subtitle')).toHaveText(
			valentinaMemoriesPageCopy.subtitle,
		);
		await expect(page.locator('.status-page__subtitle')).not.toHaveText('Próximamente');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			valentinaMemoriesPageCopy.robots,
		);
		await expect(page.locator('[data-page="valentina-memories"]')).toBeVisible();
		await expect(page.locator('[data-capture="valentina-memories"]')).toBeVisible();
		await expect(page.locator('.event-theme-wrapper')).toHaveCount(0);
		await expect(page.getByText(/events\/valentina|celebra-memories|objectKey/i)).toHaveCount(
			0,
		);

		await uploadSampleJpeg(page);

		await expect(page.getByText(valentinaMemoriesCaptureCopy.validationPending)).toBeVisible();
		await expect(
			page.getByRole('button', { name: valentinaMemoriesCaptureCopy.uploadAnother }),
		).toBeVisible();
		expect(signPayload).toMatchObject({
			mimeType: 'image/jpeg',
			sizeBytes: 4,
			checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
		});
		await expect(page.getByText('events/valentina/e2e.jpg')).toHaveCount(0);
	});

	test('shows a retryable error when the stubbed signer rejects the request', async ({
		page,
	}) => {
		await page.route('**/api/memories/valentina/session', async (route) => {
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ sessionId: 'session-e2e', recoveryCode: 'ABCD-2345-EFGH' }),
			});
		});
		await page.route(VALENTINA_MEMORIES_PRODUCTION_SIGN_URL, async (route) => {
			if (route.request().method() === 'OPTIONS') {
				await route.fulfill({ status: 204 });
				return;
			}

			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({ error: { code: 'unsupported_mime' } }),
			});
		});

		await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, { waitUntil: 'domcontentloaded' });
		await uploadSampleJpeg(page);

		await expect(page.getByRole('alert')).toHaveText(
			valentinaMemoriesCaptureCopy.unsupportedType,
		);
		await expect(
			page.getByRole('button', { name: valentinaMemoriesCaptureCopy.retry }),
		).toBeVisible();
	});
});
