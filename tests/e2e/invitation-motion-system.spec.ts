import { expect, test, type Page } from '@playwright/test';
import { waitForSettledAnimations } from './harness/settled-animations';

const ROUTES = [
	{
		name: 'celestial',
		path: '/xv/demo-xv-celestial-blue?skipEnvelope=true',
		editorial: true,
	},
	{
		name: 'abril',
		path: '/xv/abril-michelle-becerra-rea?skipEnvelope=true',
		editorial: false,
	},
] as const;

const VIEWPORTS = [
	{ width: 320, height: 800 },
	{ width: 360, height: 800 },
	{ width: 390, height: 844 },
	{ width: 430, height: 932 },
	{ width: 1440, height: 900 },
] as const;

/** Scrolls from top to bottom in half-viewport steps, so every observer sees its targets. */
async function scrollThroughPage(page: Page) {
	await page.evaluate(async () => {
		const frames = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
		const step = Math.round(window.innerHeight / 2);
		for (let top = 0; top < document.documentElement.scrollHeight; top += step) {
			window.scrollTo({ top, behavior: 'instant' });
			await frames();
		}
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
		await frames();
	});
}

for (const route of ROUTES) {
	test.describe(`${route.name} invitation motion system`, () => {
		for (const viewport of VIEWPORTS) {
			test(`has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
				await page.setViewportSize(viewport);
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await page.goto(route.path, { waitUntil: 'networkidle' });

				const dimensions = await page.evaluate(() => ({
					scrollWidth: document.documentElement.scrollWidth,
					clientWidth: document.documentElement.clientWidth,
				}));

				expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
			});
		}

		test('uses at most three IntersectionObservers for invitation motion', async ({ page }) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('console', (message) => {
				if (message.type() === 'error') errors.push(message.text());
			});

			await page.addInitScript(() => {
				const NativeObserver = window.IntersectionObserver;
				window.__invitationObserverAudit = { instances: 0 };
				// Islands, the song and the opening quote own observers outside the motion limit.
				window.IntersectionObserver = class extends NativeObserver {
					constructor(
						callback: IntersectionObserverCallback,
						options?: IntersectionObserverInit,
					) {
						super(callback, options);
						if (new Error().stack?.includes('motion-coordinator')) {
							window.__invitationObserverAudit.instances += 1;
						}
					}
				};
			});

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(route.path);
			const wrappers = page.locator('.invitation-section-wrapper');
			for (let index = 0; index < (await wrappers.count()); index += 1) {
				await wrappers.nth(index).scrollIntoViewIfNeeded();
			}

			const instances = await page.evaluate(() => window.__invitationObserverAudit.instances);
			expect(instances).toBeGreaterThanOrEqual(1);
			expect(instances).toBeLessThanOrEqual(3);
			expect(errors).toEqual([]);
		});

		test('keeps sections readable under reduced motion', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto(route.path);

			if (route.editorial) {
				// The editorial recipe keeps observing and only fades each entrance in.
				await expect(page.locator('[data-reveal-pending]').first()).toBeAttached();
				await scrollThroughPage(page);
				await expect(page.locator('[data-reveal-pending]')).toHaveCount(0);
				const entrances = await page.locator('.is-visible').evaluateAll((elements) =>
					elements.map((element) => {
						const style = getComputedStyle(element);
						return {
							name: style.animationName,
							duration: Number.parseFloat(style.animationDuration),
							delay: Number.parseFloat(style.animationDelay),
							transform: style.transform,
						};
					}),
				);
				expect(entrances.length).toBeGreaterThan(0);
				for (const entrance of entrances) {
					expect(['none', 'invitation-reveal-fade']).toContain(entrance.name);
					expect(entrance.duration).toBeLessThanOrEqual(0.2);
					expect(entrance.delay).toBe(0);
					expect(entrance.transform).toBe('none');
				}
				await waitForSettledAnimations(page);
			} else {
				await expect(page.locator('.has-motion')).toHaveCount(0);
			}

			const hidden = await page
				.locator('[data-screenshot-section], [data-reveal-item], [data-reveal-role]')
				.evaluateAll((elements) =>
					elements
						.filter((element) => {
							const style = getComputedStyle(element);
							return (
								style.display === 'none' ||
								style.visibility === 'hidden' ||
								style.opacity === '0'
							);
						})
						.map((element) => element.className),
				);
			expect(hidden).toEqual([]);
		});

		test('keeps ordinary timing within the documented budgets', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto(route.path);

			const timing = await page.evaluate(() => {
				const seconds = (value: string) => {
					const parsed = Number.parseFloat(value);
					return value.trim().endsWith('ms') ? parsed / 1000 : parsed;
				};
				const scope = document.querySelector<HTMLElement>('.event-theme-wrapper');
				const reveal = document.querySelector<HTMLElement>(
					'.invitation-section-wrapper[data-reveal]:not([data-reveal="none"])',
				);
				if (!scope || !reveal) throw new Error('Invitation motion scope was not rendered');

				const scopeStyle = getComputedStyle(scope);
				const roleTimings = ['media', 'eyebrow', 'title', 'details', 'affordance'].map(
					(role) => {
						const duration = seconds(
							scopeStyle.getPropertyValue(`--motion-hero-${role}-duration`).trim(),
						);
						const delay = seconds(
							scopeStyle.getPropertyValue(`--motion-hero-${role}-delay`).trim(),
						);
						return { role, duration, delay, end: duration + delay };
					},
				);

				const interactionSelectors = [
					'.event-location__card',
					'.event-location__card-image',
					'.countdown__segment',
					'.gallery-grid__item',
					'.gallery-grid__item img',
					'.music-player__button',
					'.event-header a',
				];
				const interactionDurations = interactionSelectors.flatMap((selector) => {
					const element = document.querySelector<HTMLElement>(selector);
					if (!element) return [];
					return getComputedStyle(element)
						.transitionDuration.split(',')
						.map((value) => ({ selector, duration: seconds(value) }));
				});

				return {
					roleTimings,
					revealDuration: seconds(
						getComputedStyle(reveal).getPropertyValue('--reveal-duration').trim(),
					),
					interactionDurations,
				};
			});

			for (const role of timing.roleTimings) {
				expect(role.duration, role.role).toBeLessThanOrEqual(0.9);
				expect(role.end, role.role).toBeLessThanOrEqual(1.6);
				if (role.role === 'title' || role.role === 'details') {
					expect(role.end, role.role).toBeLessThanOrEqual(1);
				}
			}
			expect(timing.revealDuration).toBeGreaterThanOrEqual(0.4);
			expect(timing.revealDuration).toBeLessThanOrEqual(0.7);
			expect(timing.interactionDurations.length).toBeGreaterThan(0);
			for (const interaction of timing.interactionDurations) {
				expect(interaction.duration, interaction.selector).toBeLessThanOrEqual(0.25);
			}
		});
	});
}

test('gives Celestial its constellation hero, folio turns and stacked access card', async ({
	page,
}) => {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');

		const hero = page.locator('.event--demo-xv-celestial-blue .invitation-hero');
		const wrapper = (kind: string, intersection: string, source: string) =>
			page.locator(
				`.invitation-section-wrapper[data-section-kind="${kind}"][data-intersection="${intersection}"][data-intersection-source="${source}"]`,
			);
		const family = wrapper('family', 'folio', 'countdown');
		const interlude = wrapper('interlude', 'neutral', 'interlude-after-family');
		const gifts = wrapper('gifts', 'folio', 'gallery');
		const access = wrapper('personalized-access', 'stack', 'gifts');

		await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
		for (const section of [family, interlude, gifts, access]) {
			await expect(section).toHaveCount(1);
		}
		await interlude.scrollIntoViewIfNeeded();
		await expect(interlude).toHaveClass(/is-visible/);
		await access.scrollIntoViewIfNeeded();
		await expect(access).toHaveClass(/is-visible/);
		await waitForSettledAnimations(page);

		const constellation = await hero.evaluate((element) => {
			const style = getComputedStyle(element, '::before');
			return { name: style.animationName, opacity: Number.parseFloat(style.opacity) };
		});
		expect(constellation.name).toBe('celestial-constellation-reveal');
		expect(constellation.opacity).toBeGreaterThan(0.5);

		const heroMedia = await hero
			.locator('.invitation-hero__background img')
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					name: style.animationName,
					iterations: style.animationIterationCount,
					duration: Number.parseFloat(style.animationDuration),
				};
			});
		expect(heroMedia.name).toBe('celestial-hero-media-reveal');
		expect(heroMedia.iterations).toBe('1');
		expect(heroMedia.duration).toBeLessThanOrEqual(0.9);

		for (const section of [family, gifts]) {
			const fold = await section.evaluate((element) => {
				const style = getComputedStyle(element, '::after');
				return { name: style.animationName, height: Number.parseFloat(style.height) };
			});
			expect(fold.name).toBe('intersection-folio-turn');
			expect(fold.height).toBeGreaterThanOrEqual(32);
			expect(fold.height).toBeLessThanOrEqual(80);
		}

		// Gifts stays in place and recedes while the access card slides over it.
		await expect(gifts).toHaveCSS('position', 'sticky');
		await expect(gifts.locator(':scope > *').first()).toHaveCSS(
			'animation-name',
			'intersection-stack-recede',
		);
		await expect(access).toHaveCSS('border-top-left-radius', '36px');

		await expect(page.locator('.gallery-section__title')).not.toHaveCSS(
			'color',
			'rgb(255, 255, 255)',
		);
	}
});

test('keeps Celestial section entrances pending during a slow read, then reveals each family on scroll', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.clock.install();
	await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');
	// A slow read: no script timer may reveal a section on its own.
	await page.clock.fastForward(8_500);

	const section = (kind: string) =>
		page.locator(`.invitation-section-wrapper[data-section-kind="${kind}"]`);
	const interlude = section('interlude');
	const itineraryItem = section('itinerary').locator('[data-itinerary-item]').first();
	const galleryItem = section('gallery').locator('[data-gallery-item]').first();
	const access = section('personalized-access');

	// Most sections wait item by item; the access card and the interlude wait as one block.
	await expect(interlude).not.toHaveClass(/is-visible/);
	for (const target of [itineraryItem, galleryItem, access]) {
		await expect(target).toHaveAttribute('data-reveal-pending', /.*/);
		await expect(target).not.toHaveClass(/is-visible/);
	}

	await interlude.scrollIntoViewIfNeeded();
	await expect(interlude).toHaveClass(/is-visible/);
	await expect(interlude.locator('.invitation-interlude__media')).toHaveCSS(
		'animation-name',
		/invitation-reveal-media/,
	);
	await expect(interlude.locator('.invitation-interlude__image')).toHaveCSS(
		'animation-name',
		/interlude-ambient/,
	);

	for (const item of [itineraryItem, galleryItem]) {
		await item.scrollIntoViewIfNeeded();
		await expect(item).toHaveClass(/is-visible/);
		await expect(item).not.toHaveAttribute('data-reveal-pending', /.*/);
		await expect(item).toHaveCSS('animation-name', /editorial-rise/);
	}
	await expect(galleryItem).toHaveAttribute('data-in-view', 'true');

	await access.scrollIntoViewIfNeeded();
	await expect(access).toHaveClass(/is-visible/);
	await expect(access.locator('.access-card__count')).toHaveCSS(
		'animation-name',
		/pa-celestial-count-in/,
	);
});

test('removes the Celestial flagship treatment under reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');

	const reduced = await page.evaluate(() => {
		const wrapper = (kind: string) =>
			document.querySelector<HTMLElement>(
				`.invitation-section-wrapper[data-section-kind="${kind}"]`,
			);
		const hero = document.querySelector<HTMLElement>(
			'.event--demo-xv-celestial-blue .invitation-hero',
		);
		const media = hero?.querySelector<HTMLElement>('.invitation-hero__background img');
		const family = wrapper('family');
		const gifts = wrapper('gifts');
		const recede = gifts?.firstElementChild;
		const ambient = document.querySelector<HTMLElement>('.invitation-interlude__image');
		if (!hero || !media || !family || !gifts || !recede || !ambient) {
			throw new Error('Celestial flagship treatment was not rendered');
		}

		return {
			constellationAnimation: getComputedStyle(hero, '::before').animationName,
			mediaAnimation: getComputedStyle(media).animationName,
			mediaTransform: getComputedStyle(media).transform,
			mediaScale: getComputedStyle(media).scale,
			familyFoldAnimation: getComputedStyle(family, '::after').animationName,
			giftsFoldAnimation: getComputedStyle(gifts, '::after').animationName,
			giftsRecedeAnimation: getComputedStyle(recede).animationName,
			interludeAmbientAnimation: getComputedStyle(ambient).animationName,
		};
	});

	expect(reduced).toEqual({
		constellationAnimation: 'none',
		mediaAnimation: 'none',
		mediaTransform: 'none',
		mediaScale: 'none',
		familyFoldAnimation: 'none',
		giftsFoldAnimation: 'none',
		giftsRecedeAnimation: 'none',
		interludeAmbientAnimation: 'none',
	});
});

test('renders locked Abril RSVP without an island or RSVP client requests', async ({ page }) => {
	const requested: string[] = [];
	page.on('request', (request) => requested.push(request.url()));
	await page.goto('/xv/abril-michelle-becerra-rea?skipEnvelope=true');
	await page.locator('#rsvp').scrollIntoViewIfNeeded();
	await expect(page.locator('#rsvp [data-state="locked"]')).toBeVisible();
	// A request that must not happen gives no event to wait for; an island would load by now.
	await page.waitForTimeout(500);
	await expect(
		page.locator('.invitation-section-wrapper[data-section-kind="rsvp"] astro-island'),
	).toHaveCount(0);
	expect(requested.filter((url) => /RSVP\.|framer-motion|use-reduced-motion/.test(url))).toEqual(
		[],
	);
});

test('keeps Celestial RSVP as a lazy interactive island', async ({ page }) => {
	await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');
	const wrapper = page.locator('.invitation-section-wrapper[data-section-kind="rsvp"]');
	await expect(wrapper.locator('astro-island')).toHaveCount(1);
	await wrapper.scrollIntoViewIfNeeded();
	await expect(wrapper.locator('astro-island')).not.toHaveAttribute('ssr');
	await wrapper.locator('label[for="attendance-yes"]').click();
	// The hydrated answer step folds away; assert React's next step, not the native radio.
	await expect(wrapper.getByRole('button', { name: 'Cambiar' })).toBeVisible();
	await expect(wrapper.getByRole('spinbutton')).toBeVisible();
});

test('keeps both invitations readable without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
	});

	for (const route of ROUTES) {
		const page = await context.newPage();
		const response = await page.goto(route.path);
		expect(response?.status()).toBe(200);
		expect(await page.locator('.has-motion').count()).toBe(0);
		const hidden = await page.locator('[data-screenshot-section]').evaluateAll((sections) =>
			sections.filter((section) => {
				const style = getComputedStyle(section);
				return (
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					style.opacity === '0'
				);
			}),
		);
		expect(hidden).toHaveLength(0);
		await page.close();
	}

	await context.close();
});

declare global {
	interface Window {
		__invitationObserverAudit: {
			instances: number;
		};
	}
}
