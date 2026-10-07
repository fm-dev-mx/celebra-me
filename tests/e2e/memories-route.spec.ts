import { expect, test } from '@playwright/test';
import { memoriesCaptureCopy } from '../../src/lib/memories/copy';

/**
 * Public memories routes resolve a space from the database. Without a seeded
 * space only the fail-closed paths are exercised; set MEMORIES_E2E_SLUG to an
 * activated space with an open window to run the guest capture flow against
 * mocked guest APIs.
 */

const SLUG = process.env.MEMORIES_E2E_SLUG ?? '';

test.describe('memories public routes', () => {
	test('unknown public slug fails closed with 404 and no caching', async ({ page }) => {
		const response = await page.goto('/r/no-such-space-000');
		expect(response?.status()).toBe(404);
		expect(response?.headers()['cache-control']).toContain('no-store');
	});

	test('malformed public slug fails closed', async ({ page }) => {
		const response = await page.goto('/r/Not%20A%20Slug');
		expect(response?.status()).toBe(404);
	});

	test('recovery route of an unknown space fails closed', async ({ page }) => {
		const response = await page.goto('/r/no-such-space-000/recuperar');
		expect(response?.status()).toBe(404);
	});
});

test.describe('memories guest capture', () => {
	test.skip(!SLUG, 'MEMORIES_E2E_SLUG is not configured');

	test('starts a session and uploads through the signed capability', async ({ page }) => {
		const sessionPath = `/api/memories/${SLUG}/session`;
		const itemsPath = `/api/memories/${SLUG}/items`;
		const mediaId = '11111111-1111-4111-8111-111111111111';
		let completed = false;

		await page.route(`**${sessionPath}`, async (route) => {
			const method = route.request().method();
			if (method === 'GET') {
				await route.fulfill({ json: { profile: null } });
				return;
			}
			await route.fulfill({
				status: 201,
				json: {
					profile: { displayName: 'Invitado E2E', expiresAt: '2027-01-01T00:00:00.000Z' },
					recoveryCode: 'ABCD-EFGH-JKLM',
					recovered: false,
				},
			});
		});
		await page.route(`**${itemsPath}`, async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					json: {
						items: completed
							? [
									{
										id: mediaId,
										mimeType: 'image/png',
										sizeBytes: 68,
										durationSeconds: null,
										caption: '',
										status: 'accepted',
										createdAt: '2026-10-30T00:00:00.000Z',
										updatedAt: '2026-10-30T00:00:00.000Z',
										acceptedAt: '2026-10-30T00:00:00.000Z',
										rejectedAt: null,
										deletedAt: null,
									},
								]
							: [],
						quota: {
							files: { used: 0, remaining: 20, limit: 20 },
							videos: { used: 0, remaining: 5, limit: 5 },
							bytes: { used: 0, remaining: 1, limit: 1 },
							inFlight: { used: 0, remaining: 2, limit: 2 },
						},
					},
				});
				return;
			}
			await route.fulfill({
				status: 201,
				json: {
					item: { id: mediaId, status: 'uploading' },
					upload: {
						uploadUrl: 'https://upload.e2e.invalid/upload',
						requiredHeaders: {
							Authorization: 'Bearer e2e-opaque-capability',
							'Content-Type': 'image/png',
							'x-amz-checksum-sha256': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
						},
						expiresAt: '2027-01-01T00:00:00.000Z',
					},
				},
			});
		});
		await page.route('https://upload.e2e.invalid/upload', async (route) => {
			await route.fulfill({ status: 201, json: { uploaded: true } });
		});
		await page.route(`**${itemsPath}/${mediaId}`, async (route) => {
			if (route.request().method() === 'POST') {
				completed = true;
				await route.fulfill({ json: { item: { id: mediaId, status: 'accepted' } } });
				return;
			}
			await route.fulfill({ status: 200, body: '', contentType: 'image/png' });
		});

		await page.goto(`/r/${SLUG}`);
		await page.getByLabel(memoriesCaptureCopy.displayNameLabel).fill('Invitado E2E');
		await page.getByRole('button', { name: memoriesCaptureCopy.continueLabel }).click();
		await expect(page.getByLabel(memoriesCaptureCopy.chooseFile)).toBeAttached();

		await page.locator('[data-capture="memories"] input[type="file"]').setInputFiles({
			name: 'e2e.png',
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
				'base64',
			),
		});
		await page.getByRole('button', { name: memoriesCaptureCopy.confirmUploadCount(1) }).click();
		await expect(page.getByText(memoriesCaptureCopy.successCount(1))).toBeVisible();
		// The recovery code appears once the first memory is saved.
		await expect(page.getByText(memoriesCaptureCopy.recoveryCodeTitle)).toBeVisible();
	});
});
