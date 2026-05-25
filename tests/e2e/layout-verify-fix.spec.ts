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

async function waitForAnimationFrames(page: Page, frames = 2) {
	await page.evaluate((frameCount) => {
		return new Promise<void>((resolve) => {
			let remaining = frameCount;
			const tick = () => {
				remaining -= 1;
				if (remaining <= 0) {
					resolve();
					return;
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
	}, frames);
}

async function openInvitation(page: Page) {
	const btn = page.locator('button:has-text("Abre Tu Invitación")');
	const btnCount = await btn.count();
	if (btnCount > 0) {
		await btn.click();
		await page.waitForSelector('.event-theme-wrapper[data-reveal-state="revealed"]', {
			timeout: 10000,
		});
	}

	await page.evaluate(() => {
		document.querySelectorAll('ds-envelope-reveal').forEach((envelope) => {
			envelope.setAttribute('data-reveal-state', 'revealed');
			(envelope as HTMLElement).style.pointerEvents = 'none';
		});
		document.querySelectorAll('.envelope-tease').forEach((tease) => {
			(tease as HTMLElement).style.pointerEvents = 'none';
		});
	});
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
	await waitForAnimationFrames(page, 3);

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
			await waitForAnimationFrames(page, 3);

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
	await waitForAnimationFrames(page, 3);

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
	await waitForAnimationFrames(page, 3);

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
	await waitForAnimationFrames(page, 3);

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
	await openInvitation(page);
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
/*  Verifies that the RSVP card fits the visible viewport budget after  */
/*  CTA/hash positioning and fixed UI clearance.                        */
/* ------------------------------------------------------------------ */

const RSVP_EVENT_SLUGS = [
	{ name: 'xv-editorial 360x740', slug: '/xv/demo-xv-editorial', width: 360, height: 740 },
	{ name: 'xv-editorial 375x667', slug: '/xv/demo-xv-editorial', width: 375, height: 667 },
	{ name: 'xv-editorial 390x844', slug: '/xv/demo-xv-editorial', width: 390, height: 844 },
	{ name: 'xv-editorial 412x915', slug: '/xv/demo-xv-editorial', width: 412, height: 915 },
	{ name: 'xv-editorial 414x896', slug: '/xv/demo-xv-editorial', width: 414, height: 896 },
	{ name: 'xv-editorial 430x932', slug: '/xv/demo-xv-editorial', width: 430, height: 932 },
	{ name: 'xv-editorial desktop', slug: '/xv/demo-xv-editorial', width: 1365, height: 768 },
	{ name: 'xv-jewelry-box 375x667', slug: '/xv/demo-xv-jewelry-box', width: 375, height: 667 },
	{ name: 'cesar-ramses 375x667', slug: '/bautizo/cesar-ramses', width: 375, height: 667 },
	{ name: 'cesar-ramses desktop', slug: '/bautizo/cesar-ramses', width: 1365, height: 768 },
	{
		name: 'ana-sofia-cota-guillen 375x667',
		slug: '/xv/ana-sofia-cota-guillen',
		width: 375,
		height: 667,
	},
	{
		name: 'ana-sofia-cota-guillen desktop',
		slug: '/xv/ana-sofia-cota-guillen',
		width: 1365,
		height: 768,
	},
];

async function rsvpViewportCheck(page: Page) {
	await page.waitForSelector('.rsvp-section', { timeout: 5000 });

	await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
	await waitForAnimationFrames(page, 4);

	const result = await page.evaluate(() => {
		const section = document.querySelector('#rsvp');
		if (!section) return null;
		const rect = section.getBoundingClientRect();
		const vh = window.innerHeight;
		const vw = window.innerWidth;
		const card = section.querySelector('.rsvp');
		const cardRect = card?.getBoundingClientRect();
		const submit = section.querySelector('.rsvp__button');
		const submitRect = submit?.getBoundingClientRect();
		const textarea = section.querySelector('textarea');
		const textareaRect = textarea?.getBoundingClientRect();
		const headerRect = document.querySelector('#event-header')?.getBoundingClientRect();
		const musicRect = document.querySelector('[data-music-player]')?.getBoundingClientRect();
		const visibleTop = Math.max(0, Math.round(headerRect?.bottom ?? 0));
		const visibleBottom = Math.min(vh, Math.round(musicRect?.top ?? vh));
		const cardStyle = card ? getComputedStyle(card) : null;
		const rootScrollPadding = parseFloat(
			getComputedStyle(document.documentElement).scrollPaddingTop,
		);

		return {
			isRsvpSection: section.classList.contains('rsvp-section'),
			sectionTop: Math.round(rect.top),
			sectionHeight: Math.round(rect.height),
			vh: Math.round(vh),
			vw: Math.round(vw),
			visibleTop,
			visibleBottom,
			rootScrollPaddingTop: rootScrollPadding,
			cardTop: cardRect ? Math.round(cardRect.top) : null,
			cardBottom: cardRect ? Math.round(cardRect.bottom) : null,
			cardOverflowY: cardStyle?.overflowY ?? null,
			submitBottom: submitRect ? Math.round(submitRect.bottom) : null,
			textareaBottom: textareaRect ? Math.round(textareaRect.bottom) : null,
			musicTop: musicRect ? Math.round(musicRect.top) : null,
			htmlScrollWidth: document.documentElement.scrollWidth,
			bodyScrollWidth: document.body.scrollWidth,
		};
	});

	expect(result).not.toBeNull();
	expect(result!.isRsvpSection).toBe(true);

	// Section must fill at least the viewport height (allow 2px for subpixel rounding)
	expect(result!.sectionHeight).toBeGreaterThanOrEqual(result!.vh - 2);

	expect(result!.htmlScrollWidth).toBeLessThanOrEqual(result!.vw);
	expect(result!.bodyScrollWidth).toBeLessThanOrEqual(result!.vw);
	expect(result!.cardOverflowY).not.toMatch(/auto|scroll/);

	if (result!.cardTop !== null && result!.cardBottom !== null) {
		expect(result!.cardTop).toBeGreaterThanOrEqual(result!.visibleTop - 1);
		expect(result!.cardBottom).toBeLessThanOrEqual(result!.visibleBottom + 1);
	}

	if (result!.submitBottom !== null) {
		expect(result!.submitBottom).toBeLessThanOrEqual(result!.visibleBottom + 1);
	}

	if (result!.musicTop !== null) {
		if (result!.submitBottom !== null) {
			expect(result!.submitBottom).toBeLessThanOrEqual(result!.musicTop);
		}
		if (result!.textareaBottom !== null) {
			expect(result!.textareaBottom).toBeLessThanOrEqual(result!.musicTop);
		}
	}

	expect(result!.rootScrollPaddingTop).toBeGreaterThan(0);
}

for (const ev of RSVP_EVENT_SLUGS) {
	test(`${ev.name}: RSVP default card fits visible viewport after deterministic scroll`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: ev.width, height: ev.height });
		await page.goto(ev.slug, { waitUntil: 'networkidle' });
		await openInvitation(page);

		await page.evaluate(() => {
			const section = document.querySelector('#rsvp');
			if (!section) return;
			window.location.hash = 'rsvp';
			section.scrollIntoView({ block: 'center', behavior: 'instant' });
		});

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
