import { test, expect, type Page } from '@playwright/test';

/**
 * Collector edition of the editorial cover (/xv/destenid-sofia): drag-to-turn, tap, keyboard,
 * reduced motion, and frame smoothness under mobile CPU throttling.
 */

const ROUTE = '/xv/destenid-sofia?forceEnvelope=true';
const MOBILE = { width: 390, height: 844 };

async function openCover(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { __openedEvents: number };
		w.__openedEvents = 0;
		window.addEventListener('envelope:opened', () => {
			w.__openedEvents += 1;
		});
		try {
			localStorage.clear();
		} catch {
			// Storage can be unavailable; the cover still renders.
		}
	});
	await page.setViewportSize(MOBILE);
	await page.goto(ROUTE, { waitUntil: 'networkidle' });
	await expect(
		page.locator('ds-editorial-cover[data-cover-experience="collector"]'),
	).toBeVisible();
	await page.waitForFunction(() => {
		const img = document.querySelector<HTMLImageElement>('.ec-book__front img');
		return Boolean(img && img.complete && img.naturalWidth > 0);
	});
	// Let the arrival (magazine drop, ribbon drop) settle before interacting.
	await page.waitForTimeout(2000);
}

async function bookBox(page: Page) {
	const box = await page.locator('[data-collector-book]').boundingBox();
	if (!box) throw new Error('Collector book not rendered');
	return box;
}

async function dragFromCorner(page: Page, fraction: number, steps = 18) {
	const box = await bookBox(page);
	const startX = box.x + box.width - 6;
	const startY = box.y + box.height - 10;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	for (let i = 1; i <= steps; i += 1) {
		await page.mouse.move(startX - box.width * fraction * (i / steps), startY - 4 * i, {
			steps: 1,
		});
		await page.waitForTimeout(16);
	}
	await page.mouse.up();
}

async function expectRevealed(page: Page) {
	// The hand-off waits for the hero entrance, so allow the whole choreography.
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						document.querySelector<HTMLElement>('.event-theme-wrapper')?.dataset
							.revealState,
				),
			{
				timeout: 9000,
			},
		)
		.toBe('revealed');
	await expect(page.locator('ds-editorial-cover')).toBeHidden();
	expect(
		await page.evaluate(() => (window as unknown as { __openedEvents: number }).__openedEvents),
	).toBe(1);
}

test.describe('collector editorial cover', () => {
	test('tapping the call to action turns the page and opens the invitation', async ({ page }) => {
		await openCover(page);
		// The bookmark ribbon sways continuously, so skip Playwright's stability wait.
		await page.locator('.editorial-cover__cta').click({ force: true });
		await expectRevealed(page);
		await expect(page.locator('#inicio')).toBeFocused();
	});

	test('a short drag falls back closed without opening', async ({ page }) => {
		await openCover(page);
		await dragFromCorner(page, 0.35);
		await page.waitForTimeout(900);
		const state = await page.evaluate(() => ({
			reveal: document.querySelector<HTMLElement>('.event-theme-wrapper')?.dataset
				.revealState,
			flap: document.querySelector<HTMLElement>('[data-collector-flap]')?.style.clipPath,
			stored: localStorage.getItem('envelope-opened-destenid-sofia'),
		}));
		expect(state.reveal).not.toBe('revealed');
		expect(state.flap).toBe('polygon(0px 0px, 0px 0px, 0px 0px)');
		expect(state.stored).toBeNull();
		await expect(page.locator('ds-editorial-cover')).toBeVisible();
	});

	test('dragging the page past the middle opens the invitation', async ({ page }) => {
		await openCover(page);
		await dragFromCorner(page, 1.4);
		await expectRevealed(page);
	});

	test('the keyboard opens the cover from the call to action', async ({ page }) => {
		await openCover(page);
		await page.locator('.editorial-cover__cta').focus();
		await page.keyboard.press('Enter');
		await expectRevealed(page);
	});

	test('reduced motion opens immediately', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await openCover(page);
		// The bookmark ribbon sways continuously, so skip Playwright's stability wait.
		await page.locator('.editorial-cover__cta').click({ force: true });
		await expect
			.poll(
				() =>
					page.evaluate(
						() =>
							document.querySelector<HTMLElement>('.event-theme-wrapper')?.dataset
								.revealState,
					),
				{ timeout: 600 },
			)
			.toBe('revealed');
	});

	test('the turn, spread, and hand-off stay smooth under 4× CPU throttling', async ({
		page,
	}, testInfo) => {
		await openCover(page);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

		try {
			await page.evaluate(() => {
				const w = window as unknown as { __frames: number[] };
				w.__frames = [];
				let last = performance.now();
				const tick = (now: number) => {
					w.__frames.push(now - last);
					last = now;
					if (w.__frames.length < 260) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			});
			// The bookmark ribbon sways continuously, so skip Playwright's stability wait.
			await page.locator('.editorial-cover__cta').click({ force: true });
			await page.waitForTimeout(4600);
			const frames = await page.evaluate(() =>
				(window as unknown as { __frames: number[] }).__frames.slice(2),
			);

			const sorted = [...frames].sort((a, b) => a - b);
			const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
			const long = frames.filter((f) => f > 50).length / Math.max(1, frames.length);
			testInfo.annotations.push({
				type: 'frames',
				description: `n=${frames.length} p95=${p95.toFixed(1)}ms long(>50ms)=${(long * 100).toFixed(1)}%`,
			});
			expect(frames.length).toBeGreaterThan(20);
			expect(long).toBeLessThan(0.05);
		} finally {
			await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		}
	});
});
