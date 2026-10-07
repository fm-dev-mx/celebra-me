import { expect, test, type Page, type Route } from '@playwright/test';
import { CANONICAL_MEMORIES_SLUG } from '../../scripts/playwright/canonical-memories-fixture';
import { memoriesCaptureCopy as copy } from '../../src/lib/memories/copy';

/**
 * Guest capture flow in a real browser engine, run per device project by
 * `playwright.memories.config.ts`. The page is rendered by the server from a
 * memory space; every guest API and the upload Worker are mocked, so nothing is
 * stored anywhere.
 *
 * The space comes from the canonical fixture transport
 * (PLAYWRIGHT_USE_CANONICAL_FIXTURES=true) or from MEMORIES_E2E_SLUG, an
 * activated space with an open window. Without either, the flow is skipped.
 *
 * Not covered here, by design: real video decoding (the bundled engines ship
 * without the phone codecs) and the true in-app browsers of WhatsApp, Instagram
 * and Facebook. Those are on the phone rehearsal checklist in
 * workers/celebra-memories-sign/OWNER.md.
 */

const SLUG =
	process.env.MEMORIES_E2E_SLUG ??
	(process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES === 'true' ? CANONICAL_MEMORIES_SLUG : '');

const UPLOAD_URL = 'https://upload.e2e.invalid/upload';
const PNG_1X1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64',
);
const PROFILE = { displayName: 'Invitado E2E', expiresAt: '2027-01-01T00:00:00.000Z' };
const QUOTA = {
	files: { used: 0, remaining: 15, limit: 15 },
	videos: { used: 0, remaining: 3, limit: 3 },
	bytes: { used: 0, remaining: 314_572_800, limit: 314_572_800 },
	inFlight: { used: 0, remaining: 2, limit: 2 },
};

type Item = { id: string; mimeType: string; status: string };
type ReserveBody = { clientRequestId: string; mimeType: string; durationSeconds?: number };

function publicItem(item: Item) {
	return {
		...item,
		sizeBytes: PNG_1X1.byteLength,
		durationSeconds: null,
		caption: '',
		createdAt: '2026-10-30T00:00:00.000Z',
		updatedAt: '2026-10-30T00:00:00.000Z',
		acceptedAt: item.status === 'accepted' ? '2026-10-30T00:00:00.000Z' : null,
		rejectedAt: null,
		deletedAt: null,
	};
}

/**
 * Mocks the guest API for one session. `reserve` and `put` decide how each
 * attempt goes; the catalog reflects what the mock has accepted so far.
 */
async function mockGuestApi(
	page: Page,
	options: {
		hasSession?: boolean;
		reserve?: (route: Route, attempt: number) => Promise<void> | void;
		put?: (route: Route, attempt: number) => Promise<void> | void;
	} = {},
) {
	const sessionPath = `/api/memories/${SLUG}/session`;
	const itemsPath = `/api/memories/${SLUG}/items`;
	const state = {
		hasSession: options.hasSession ?? false,
		items: [] as Item[],
		reserveBodies: [] as ReserveBody[],
		putAttempts: 0,
	};

	await page.route(`**${sessionPath}`, async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({ json: { profile: state.hasSession ? PROFILE : null } });
			return;
		}
		state.hasSession = true;
		await route.fulfill({
			status: 201,
			json: { profile: PROFILE, recoveryCode: 'ABCD-EFGH-JKLM', recovered: false },
		});
	});
	await page.route(`**${itemsPath}`, async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({ json: { items: state.items.map(publicItem), quota: QUOTA } });
			return;
		}
		const body = route.request().postDataJSON() as ReserveBody;
		state.reserveBodies.push(body);
		if (options.reserve) {
			await options.reserve(route, state.reserveBodies.length);
			return;
		}
		const id = '11111111-1111-4111-8111-111111111111';
		if (!state.items.some((item) => item.id === id))
			state.items.push({ id, mimeType: body.mimeType, status: 'uploading' });
		await route.fulfill({
			status: 201,
			json: {
				item: publicItem({ id, mimeType: body.mimeType, status: 'uploading' }),
				upload: {
					uploadUrl: UPLOAD_URL,
					requiredHeaders: {
						Authorization: 'Bearer e2e-opaque-capability',
						'Content-Type': body.mimeType,
						'x-amz-checksum-sha256': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
					},
					expiresAt: '2027-01-01T00:00:00.000Z',
				},
			},
		});
	});
	await page.route(UPLOAD_URL, async (route) => {
		state.putAttempts += 1;
		if (options.put) {
			await options.put(route, state.putAttempts);
			return;
		}
		await route.fulfill({
			status: 201,
			json: { uploaded: true },
			headers: { 'Access-Control-Allow-Origin': '*' },
		});
	});
	await page.route(`**${itemsPath}/*`, async (route) => {
		if (route.request().method() === 'POST') {
			for (const item of state.items) item.status = 'accepted';
			await route.fulfill({ json: { item: publicItem(state.items[0]) } });
			return;
		}
		await route.fulfill({ status: 200, body: PNG_1X1, contentType: 'image/png' });
	});
	return state;
}

async function startSession(page: Page): Promise<void> {
	await page.goto(`/r/${SLUG}`);
	await page.getByLabel(copy.displayNameLabel).fill(PROFILE.displayName);
	await page.getByRole('button', { name: copy.continueLabel }).click();
	await expect(page.getByLabel(copy.chooseFile)).toBeAttached();
}

async function choosePhoto(page: Page, name = 'e2e.png', mimeType = 'image/png'): Promise<void> {
	await page
		.locator('[data-capture="memories"] input[type="file"]')
		.setInputFiles({ name, mimeType, buffer: PNG_1X1 });
}

test.describe('memories guest flow', () => {
	test.skip(
		!SLUG,
		'No memory space: set PLAYWRIGHT_USE_CANONICAL_FIXTURES or MEMORIES_E2E_SLUG.',
	);

	test('starts a session and uploads a photo without overflowing the screen', async ({
		page,
	}) => {
		const api = await mockGuestApi(page);
		await startSession(page);

		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();

		await expect(page.getByText(copy.successCount(1))).toBeVisible();
		await expect(page.getByText(copy.recoveryCodeTitle)).toBeVisible();
		expect(api.putAttempts).toBe(1);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('offers the picker every accepted format, including iPhone HEIC and MOV', async ({
		page,
	}) => {
		await mockGuestApi(page, { hasSession: true });
		await page.goto(`/r/${SLUG}`);

		const accept = await page
			.locator('[data-capture="memories"] input[type="file"]')
			.getAttribute('accept');
		expect(accept?.split(',')).toEqual(
			expect.arrayContaining(['image/heic', 'image/heif', 'video/quicktime', 'video/mp4']),
		);
	});

	test('uploads an iPhone HEIC photo that arrives without a declared type', async ({ page }) => {
		const api = await mockGuestApi(page, { hasSession: true });
		await page.goto(`/r/${SLUG}`);

		await choosePhoto(page, 'IMG_0001.HEIC', '');
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();

		await expect(page.getByText(copy.successCount(1))).toBeVisible();
		expect(api.reserveBodies[0].mimeType).toBe('image/heic');
	});

	test('reports a video the browser cannot read instead of waiting forever', async ({ page }) => {
		const api = await mockGuestApi(page, { hasSession: true });
		await page.goto(`/r/${SLUG}`);

		// Not a real container: the engine must answer with an error, not silence.
		await choosePhoto(page, 'IMG_0002.MOV', 'video/quicktime');
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();

		await expect(page.getByRole('alert')).toHaveText(copy.videoUnreadable, { timeout: 20_000 });
		expect(api.reserveBodies).toHaveLength(0);
	});

	test('a connection cut during the upload is retried on the same reservation', async ({
		page,
	}) => {
		const api = await mockGuestApi(page, {
			hasSession: true,
			put: async (route, attempt) => {
				if (attempt === 1) {
					await route.abort('connectionfailed');
					return;
				}
				await route.fulfill({
					status: 201,
					json: { uploaded: true },
					headers: { 'Access-Control-Allow-Origin': '*' },
				});
			},
		});
		await page.goto(`/r/${SLUG}`);

		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();
		await expect(page.getByRole('alert')).toHaveText(copy.putFailed);

		await page.getByRole('button', { name: copy.retry }).click();

		await expect(page.getByText(copy.successCount(1))).toBeVisible();
		expect(api.reserveBodies).toHaveLength(2);
		expect(api.reserveBodies[1].clientRequestId).toBe(api.reserveBodies[0].clientRequestId);
	});

	test('a file the storage already holds (412) is confirmed instead of failing', async ({
		page,
	}) => {
		await mockGuestApi(page, {
			hasSession: true,
			put: (route) =>
				route.fulfill({
					status: 412,
					json: { error: { code: 'already_uploaded' } },
					headers: { 'Access-Control-Allow-Origin': '*' },
				}),
		});
		await page.goto(`/r/${SLUG}`);

		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();

		await expect(page.getByText(copy.successCount(1))).toBeVisible();
	});

	test('without signal, waits and resumes on its own when the connection returns', async ({
		page,
	}) => {
		const api = await mockGuestApi(page, { hasSession: true });
		// The guest opens the page with no signal at all.
		await page.addInitScript(() => {
			let online = false;
			Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
			(window as unknown as { setOnline: (value: boolean) => void }).setOnline = (value) => {
				online = value;
				window.dispatchEvent(new Event(value ? 'online' : 'offline'));
			};
		});
		await page.goto(`/r/${SLUG}`);

		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();
		await expect(page.getByText(copy.offline)).toBeVisible();
		await expect(page.getByText(copy.statusWaiting)).toBeVisible();
		expect(api.reserveBodies).toHaveLength(0);

		await page.evaluate(() =>
			(window as unknown as { setOnline: (value: boolean) => void }).setOnline(true),
		);

		await expect(page.getByText(copy.successCount(1))).toBeVisible();
		expect(api.putAttempts).toBe(1);
	});

	test('after a reload mid-upload, the session survives and the pending file is listed', async ({
		page,
	}) => {
		const pendingPut = { release: () => undefined as void };
		const api = await mockGuestApi(page, {
			hasSession: true,
			// The upload never finishes before the guest reloads.
			put: () =>
				new Promise<void>((resolve) => {
					pendingPut.release = resolve;
				}),
		});
		await page.goto(`/r/${SLUG}`);
		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();
		await expect(page.getByText(copy.progressTitle(1, 1))).toBeVisible();
		// Reload only once the server holds the reservation.
		await expect.poll(() => api.items.length).toBe(1);

		await page.reload();
		pendingPut.release();

		await expect(page.getByText(PROFILE.displayName)).toBeVisible();
		await expect(page.getByText(copy.validationPending)).toBeVisible();
		expect(api.items).toHaveLength(1);
	});

	test('names the limit when the server refuses another video', async ({ page }) => {
		await mockGuestApi(page, {
			hasSession: true,
			reserve: (route) =>
				route.fulfill({
					status: 409,
					json: {
						success: false,
						error: {
							code: 'limit_reached',
							message: 'Alcanzó el máximo de videos para esta sesión.',
							details: { reason: 'session_videos' },
						},
					},
				}),
		});
		await page.goto(`/r/${SLUG}`);

		await choosePhoto(page);
		await page.getByRole('button', { name: copy.confirmUploadCount(1) }).click();

		await expect(page.getByRole('alert')).toHaveText(copy.sessionVideosReached);
	});

	test('shows why the session could not start', async ({ page }) => {
		await page.route(`**/api/memories/${SLUG}/session`, async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({ json: { profile: null } });
				return;
			}
			await route.fulfill({
				status: 429,
				json: { success: false, error: { code: 'rate_limited', message: 'Demasiadas.' } },
			});
		});
		await page.goto(`/r/${SLUG}`);

		await page.getByLabel(copy.displayNameLabel).fill(PROFILE.displayName);
		await page.getByRole('button', { name: copy.continueLabel }).click();

		await expect(page.getByRole('alert')).toHaveText(copy.rateLimited);
	});
});
