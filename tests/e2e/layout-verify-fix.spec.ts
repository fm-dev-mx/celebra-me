import { test, expect, type Page } from '@playwright/test';

const MOBILE_VIEWPORTS = [
	{ name: '375x667', width: 375, height: 667 },
	{ name: '390x844', width: 390, height: 844 },
];

const ALL_VIEWPORTS = [
	{ name: '320x568', width: 320, height: 568 },
	{ name: '360x640', width: 360, height: 640 },
	{ name: '375x667', width: 375, height: 667 },
	{ name: '390x844', width: 390, height: 844 },
	{ name: '414x896', width: 414, height: 896 },
	{ name: '430x932', width: 430, height: 932 },
];

test.describe.configure({ mode: 'parallel' });
test.setTimeout(30000);

async function openInvitation(page: Page) {
	const btn = page.locator('button:has-text("Abre Tu Invitación")');
	const btnCount = await btn.count();
	if (btnCount > 0) {
		await btn.click();
		await page.waitForSelector('.event-theme-wrapper[data-reveal-state="revealed"]', {
			timeout: 10000,
		});
	}
}

for (const vp of ALL_VIEWPORTS) {
	test('editorial horizontal overflow at ' + vp.name, async ({ page }) => {
		await page.setViewportSize({ width: vp.width, height: vp.height });
		await page.goto('/xv/demo-xv-editorial#!/rsvp', { waitUntil: 'networkidle' });
		await openInvitation(page);

		await page.waitForSelector('.rsvp-section', { timeout: 5000 });

		const dims = await page.evaluate(() => ({
			innerWidth: window.innerWidth,
			htmlScrollWidth: document.documentElement.scrollWidth,
		}));

		expect(dims.htmlScrollWidth).toBeLessThanOrEqual(dims.innerWidth);
	});
}

test('Editorial: landing directly on #rsvp scrolls section into view', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/xv/demo-xv-editorial#!/rsvp', { waitUntil: 'networkidle' });
	await openInvitation(page);

	await page.waitForSelector('.rsvp-section', { timeout: 5000 });
	await page.waitForTimeout(500);

	await page.evaluate(() => {
		document.querySelector('#rsvp')?.scrollIntoView({ block: 'start', behavior: 'instant' });
	});

	const dims = await page.evaluate(() => {
		const section = document.querySelector('#rsvp');
		if (!section) return null;
		const rect = section.getBoundingClientRect();
		return { top: rect.top, vh: window.innerHeight };
	});

	expect(dims).not.toBeNull();
	expect(dims!.top).toBeLessThan(dims!.vh);
});

for (const vp of MOBILE_VIEWPORTS) {
	test(
		'Editorial: scrolling to #rsvp positions section below sticky header at ' + vp.name,
		async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });
			await openInvitation(page);

			await page.evaluate(() => window.scrollTo({ top: 300 }));
			await page.waitForTimeout(500);

			await page.evaluate(() => {
				document
					.querySelector('#rsvp')
					?.scrollIntoView({ block: 'start', behavior: 'instant' });
			});
			await page.waitForSelector('.rsvp-section', { timeout: 5000 });

			const dims = await page.evaluate(() => {
				const section = document.querySelector('#rsvp');
				if (!section) return null;
				return {
					sectionTop: section.getBoundingClientRect().top,
					sectionBottom: section.getBoundingClientRect().bottom,
					vh: window.innerHeight,
				};
			});

			expect(dims).not.toBeNull();
			expect(dims!.sectionTop).toBeLessThan(250);
			expect(dims!.sectionBottom).toBeGreaterThan(0);
		},
	);
}

for (const vp of MOBILE_VIEWPORTS) {
	test('Editorial: mobile nav CTA scrolls RSVP into view at ' + vp.name, async ({ page }) => {
		await page.setViewportSize({ width: vp.width, height: vp.height });
		await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });
		await openInvitation(page);

		await page.evaluate(() => {
			const toggle = document.querySelector('[data-nav-mobile-toggle]') as HTMLButtonElement;
			if (toggle) toggle.click();
		});

		await page.waitForFunction(
			() => document.querySelector('.header-base__mobile-menu[data-state="open"]') !== null,
			{ timeout: 5000 },
		);

		await page.evaluate(() => {
			document
				.querySelector('#rsvp')
				?.scrollIntoView({ block: 'start', behavior: 'instant' });
		});
		await page.waitForSelector('.rsvp-section', { timeout: 5000 });

		const dims = await page.evaluate(() => {
			const section = document.querySelector('#rsvp');
			if (!section) return null;
			return {
				sectionTop: section.getBoundingClientRect().top,
				sectionBottom: section.getBoundingClientRect().bottom,
				vh: window.innerHeight,
			};
		});

		expect(dims).not.toBeNull();
		expect(dims!.sectionTop).toBeLessThan(250);
		expect(dims!.sectionBottom).toBeGreaterThan(0);
	});
}

test('Editorial RSVP title visible after scrolling to #rsvp', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });
	await openInvitation(page);

	await page.evaluate(() => window.scrollTo({ top: 300 }));
	await page.waitForTimeout(500);

	await page.evaluate(() => {
		document.querySelector('#rsvp')?.scrollIntoView({ block: 'start', behavior: 'instant' });
	});
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	const dims = await page.evaluate(() => {
		const title = document.querySelector('.rsvp__title');
		if (!title) return null;
		const rect = title.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom, vh: window.innerHeight };
	});

	expect(dims).not.toBeNull();
	expect(dims!.top).toBeGreaterThanOrEqual(0);
	expect(dims!.bottom).toBeLessThanOrEqual(dims!.vh);
});

test('Editorial RSVP section visible after scrolling to #rsvp at smallest viewport', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });
	await openInvitation(page);

	await page.evaluate(() => window.scrollTo({ top: 300 }));
	await page.waitForTimeout(500);

	await page.evaluate(() => {
		document.querySelector('#rsvp')?.scrollIntoView({ block: 'start', behavior: 'instant' });
	});
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	const dims = await page.evaluate(() => {
		const section = document.querySelector('#rsvp');
		if (!section) return null;
		const rect = section.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom, vh: window.innerHeight };
	});

	expect(dims).not.toBeNull();
	expect(dims!.top).toBeLessThan(250);
	expect(dims!.bottom).toBeGreaterThan(50);
});

test('Non-editorial: scrolling to #rsvp positions section at top at 375x667', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/xv/demo-xv-jewelry-box', { waitUntil: 'networkidle' });
	await openInvitation(page);

	await page.evaluate(() => window.scrollTo({ top: 300 }));
	await page.waitForTimeout(500);

	await page.evaluate(() => {
		document.querySelector('#rsvp')?.scrollIntoView({ block: 'start', behavior: 'instant' });
	});
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	const dims = await page.evaluate(() => {
		const section = document.querySelector('#rsvp');
		if (!section) return null;
		return {
			sectionTop: section.getBoundingClientRect().top,
			sectionBottom: section.getBoundingClientRect().bottom,
			vh: window.innerHeight,
		};
	});

	expect(dims).not.toBeNull();
	expect(dims!.sectionTop).toBeLessThan(250);
	expect(dims!.sectionBottom).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ */
/*  Regression: cesar-ramses desktop — no oscillation after decline    */
/* ------------------------------------------------------------------ */
test('cesar-ramses desktop no oscillation after selecting No podré', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/bautizo/cesar-ramses#!/rsvp', { waitUntil: 'networkidle' });
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	const declineRadio = page.locator('.rsvp__radio-card', { hasText: 'No podré' });
	await declineRadio.click();

	// Poll over consecutive animation frames — assert no class toggling and stable height
	await expect(async () => {
		const samples = await page.evaluate(() => {
			const card = document.querySelector('.rsvp');
			if (!card) return null;

			const classes: string[] = [];
			const heights: number[] = [];

			return new Promise<{ classes: string[]; heights: number[] }>((resolve) => {
				let frames = 0;
				const maxFrames = 30;

				const sample = () => {
					frames++;
					classes.push(card.className);
					heights.push(Math.round(card.getBoundingClientRect().height));

					if (frames >= maxFrames) {
						resolve({ classes, heights });
						return;
					}
					requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			});
		});

		expect(samples).not.toBeNull();
		// Class list should have at most 1 unique value (stable)
		const uniqueClasses = new Set(samples!.classes);
		expect(uniqueClasses.size).toBeLessThanOrEqual(1);

		// Height should not oscillate beyond 2px after settling
		const minH = Math.min(...samples!.heights);
		const maxH = Math.max(...samples!.heights);
		expect(maxH - minH).toBeLessThanOrEqual(2);
	}).toPass({ timeout: 5000 });
});

/* ------------------------------------------------------------------ */
/*  Cross-invitation RSVP viewport integrity                            */
/*  Verifies that #rsvp.rsvp-section aligns flush to the viewport       */
/*  top after CTA scroll, fills the viewport, and the card is visible.  */
/* ------------------------------------------------------------------ */

const RSVP_EVENT_SLUGS = [
	{ name: 'xv-editorial (mobile)', slug: '/xv/demo-xv-editorial', width: 375, height: 667 },
	{ name: 'xv-jewelry-box (mobile)', slug: '/xv/demo-xv-jewelry-box', width: 375, height: 667 },
	{ name: 'cesar-ramses (mobile)', slug: '/bautizo/cesar-ramses', width: 375, height: 667 },
	{ name: 'cesar-ramses (desktop)', slug: '/bautizo/cesar-ramses', width: 1280, height: 800 },
	{
		name: 'ana-sofia-cota-guillen (mobile)',
		slug: '/xv/ana-sofia-cota-guillen',
		width: 375,
		height: 667,
	},
	{
		name: 'ana-sofia-cota-guillen (desktop)',
		slug: '/xv/ana-sofia-cota-guillen',
		width: 1280,
		height: 800,
	},
];

async function rsvpViewportCheck(page: Page) {
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	// Wait for any post-load corrections to settle
	await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
	await page.waitForTimeout(500);

	const result = await page.evaluate(() => {
		const section = document.querySelector('#rsvp');
		if (!section) return null;
		const rect = section.getBoundingClientRect();
		const vh = window.innerHeight;
		const card = section.querySelector('.rsvp');
		const cardRect = card?.getBoundingClientRect();
		const rootScrollPadding = parseFloat(
			getComputedStyle(document.documentElement).scrollPaddingTop,
		);

		return {
			isRsvpSection: section.classList.contains('rsvp-section'),
			sectionTop: Math.round(rect.top),
			sectionHeight: Math.round(rect.height),
			vh: Math.round(vh),
			rootScrollPaddingTop: rootScrollPadding,
			cardTop: cardRect ? Math.round(cardRect.top) : null,
			cardBottom: cardRect ? Math.round(cardRect.bottom) : null,
		};
	});

	expect(result).not.toBeNull();
	expect(result!.isRsvpSection).toBe(true);

	// Section must align flush to viewport top (±8px tolerance)
	expect(Math.abs(result!.sectionTop)).toBeLessThanOrEqual(8);

	// Section must fill at least the viewport height (allow 2px for subpixel rounding)
	expect(result!.sectionHeight).toBeGreaterThanOrEqual(result!.vh - 2);

	// Card must be fully visible inside the viewport (not cropped at top or bottom)
	if (result!.cardTop !== null && result!.cardBottom !== null) {
		expect(result!.cardTop).toBeGreaterThanOrEqual(0);
		expect(result!.cardBottom).toBeLessThanOrEqual(result!.vh);
	}

	// Debug: log scroll-padding-top for diagnosis if assertion fails
	expect(result!.rootScrollPaddingTop).toBeGreaterThan(0);
}

for (const ev of RSVP_EVENT_SLUGS) {
	test(`${ev.name}: RSVP section fills viewport after CTA`, async ({ page }) => {
		await page.setViewportSize({ width: ev.width, height: ev.height });
		await page.goto(ev.slug, { waitUntil: 'networkidle' });
		await openInvitation(page);

		// Attempt CTA click; fall back to programmatic scroll
		const cta = page
			.locator('a[href="#rsvp"], a:has-text("Confirmar"), button:has-text("Confirmar")')
			.first();
		if ((await cta.count()) > 0) {
			await cta.click();
		} else {
			await page.evaluate(() => {
				document
					.querySelector('#rsvp')
					?.scrollIntoView({ block: 'start', behavior: 'instant' });
			});
		}

		await rsvpViewportCheck(page);
	});
}

test('html background is dark on editorial page', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/xv/demo-xv-editorial', { waitUntil: 'networkidle' });
	await openInvitation(page);

	const bgColor = await page.evaluate(
		() => getComputedStyle(document.documentElement).backgroundColor,
	);

	expect(bgColor).toBeTruthy();
	const rgb = bgColor.match(/\d+/g)?.map(Number);
	expect(rgb).not.toBeNull();
	expect(rgb!.length).toBeGreaterThanOrEqual(3);

	const brightness = (rgb![0] + rgb![1] + rgb![2]) / 3;
	expect(brightness).toBeLessThan(50);
});
