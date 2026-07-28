import { expect, test } from '@playwright/test';

const ROUTES = [
	{
		name: 'celestial',
		path: '/xv/demo-xv-celestial-blue?skipEnvelope=true',
	},
	{
		name: 'abril',
		path: '/xv/abril-michelle-becerra-rea?skipEnvelope=true',
	},
] as const;

const VIEWPORTS = [
	{ width: 320, height: 800 },
	{ width: 360, height: 800 },
	{ width: 390, height: 844 },
	{ width: 430, height: 932 },
	{ width: 1440, height: 900 },
] as const;

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
				window.IntersectionObserver = class extends NativeObserver {
					constructor(
						callback: IntersectionObserverCallback,
						options?: IntersectionObserverInit,
					) {
						super(callback, options);
						window.__invitationObserverAudit.instances += 1;
					}
				};
			});

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(route.path);
			const wrappers = page.locator('.invitation-section-wrapper');
			for (let index = 0; index < (await wrappers.count()); index += 1) {
				await wrappers.nth(index).scrollIntoViewIfNeeded();
			}

			const instances = await page.evaluate(
				() => window.__invitationObserverAudit.instances,
			);
			expect(instances).toBeLessThanOrEqual(3);
			expect(errors).toEqual([]);
		});

		test('keeps sections readable under reduced motion', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto(route.path);

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
			expect(await page.locator('.has-motion').count()).toBe(0);
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

test('gives Celestial its cinematic hero, editorial bridges, and narrative climaxes', async ({ page }) => {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');
		await page.waitForTimeout(1000);

		const hero = page.locator('.event--demo-xv-celestial-blue .invitation-hero');
		const arch = page.locator(
			'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="arch"][data-intersection-source="location"]',
		);
		const familyOverlap = page.locator(
			'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="family"]',
		);
		const galleryBlend = page.locator(
			'.invitation-section-wrapper[data-section-kind="gallery"][data-intersection="atmospheric-blend"][data-intersection-source="interlude-after-family"]',
		);
		const itineraryOverlap = page.locator(
			'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="itinerary"]',
		);
		const blend = page.locator(
			'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="atmospheric-blend"][data-intersection-source="rsvp"]',
		);

		await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
		expect(await arch.count()).toBe(1);
		expect(await familyOverlap.count()).toBe(1);
		expect(await galleryBlend.count()).toBe(1);
		expect(await itineraryOverlap.count()).toBe(1);
		expect(await blend.count()).toBe(1);
		await familyOverlap.scrollIntoViewIfNeeded();
		await expect(familyOverlap).toHaveClass(/is-visible/);
		await galleryBlend.scrollIntoViewIfNeeded();
		await expect(galleryBlend).toHaveClass(/is-visible/);
		await arch.scrollIntoViewIfNeeded();
		await expect(arch).toHaveClass(/is-visible/);
		await page.waitForTimeout(750);
		await blend.scrollIntoViewIfNeeded();
		await expect(blend).toHaveClass(/is-visible/);
		await page.waitForTimeout(750);

		const treatment = await page.evaluate(() => {
			const heroElement = document.querySelector<HTMLElement>(
				'.event--demo-xv-celestial-blue .invitation-hero',
			);
			const archElement = document.querySelector<HTMLElement>(
				'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="arch"][data-intersection-source="location"]',
			);
			const familyOverlapElement = document.querySelector<HTMLElement>(
				'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="family"]',
			);
			const galleryBlendElement = document.querySelector<HTMLElement>(
				'.invitation-section-wrapper[data-section-kind="gallery"][data-intersection="atmospheric-blend"][data-intersection-source="interlude-after-family"]',
			);
			const itineraryOverlapElement = document.querySelector<HTMLElement>(
				'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="itinerary"]',
			);
			const blendElement = document.querySelector<HTMLElement>(
				'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="atmospheric-blend"][data-intersection-source="rsvp"]',
			);
			if (
				!heroElement ||
				!archElement ||
				!familyOverlapElement ||
				!galleryBlendElement ||
				!itineraryOverlapElement ||
				!blendElement
			) {
				throw new Error('Celestial cinematic treatment was not rendered');
			}

			return {
				heroConstellationOpacity: Number.parseFloat(
					getComputedStyle(heroElement, '::before').opacity,
				),
				heroMediaAnimation: getComputedStyle(
					heroElement.querySelector('.invitation-hero__background img')!,
				).animationName,
				heroMediaIterations: getComputedStyle(
					heroElement.querySelector('.invitation-hero__background img')!,
				).animationIterationCount,
				heroMediaDuration: Number.parseFloat(
					getComputedStyle(heroElement.querySelector('.invitation-hero__background img')!)
						.animationDuration,
				),
				portalThreadHeight: Number.parseFloat(
					getComputedStyle(archElement, '::after').height,
				),
				portalThreadAnimation: getComputedStyle(archElement, '::after').animationName,
				familyOverlapDepth: Number.parseFloat(getComputedStyle(familyOverlapElement).marginTop),
				familyPhotoClip: getComputedStyle(
					familyOverlapElement.querySelector('.invitation-interlude__media')!,
				).clipPath,
				familyPhotoFilter: getComputedStyle(
					familyOverlapElement.querySelector('.invitation-interlude__image')!,
				).filter,
				familyReservedPadding: Number.parseFloat(
					getComputedStyle(
						familyOverlapElement.previousElementSibling!.querySelector('.family')!,
					).paddingBottom,
				),
				galleryTitleColor: getComputedStyle(
					galleryBlendElement.querySelector('.gallery-section__title')!,
				).color,
				itineraryOverlapDepth: Number.parseFloat(
					getComputedStyle(itineraryOverlapElement).marginTop,
				),
				itineraryPhotoClip: getComputedStyle(
					itineraryOverlapElement.querySelector('.invitation-interlude__media')!,
				).clipPath,
				itineraryPhotoFilter: getComputedStyle(
					itineraryOverlapElement.querySelector('.invitation-interlude__image')!,
				).filter,
				itineraryReservedPadding: Number.parseFloat(
					getComputedStyle(
						itineraryOverlapElement.previousElementSibling!.querySelector('.itinerary')!,
					).paddingBottom,
				),
				blendDepth: Number.parseFloat(getComputedStyle(blendElement, '::before').height),
				blendBackground: getComputedStyle(blendElement, '::before').backgroundImage,
				blendLayer: getComputedStyle(blendElement, '::before').zIndex,
				blendAnimation: getComputedStyle(blendElement, '::before').animationName,
			};
		});

		expect(treatment.heroConstellationOpacity).toBeGreaterThan(0.5);
		expect(treatment.heroMediaAnimation).toContain('celestial-hero-media-reveal');
		expect(treatment.heroMediaAnimation).not.toContain('celestial-hero-media-breathe');
		expect(treatment.heroMediaIterations).toBe('1');
		expect(treatment.heroMediaDuration).toBeLessThanOrEqual(0.9);
		expect(treatment.portalThreadHeight).toBeGreaterThan(0);
		expect(treatment.portalThreadAnimation).toContain('celestial-portal-thread-arrival');
		expect(treatment.familyOverlapDepth).toBeLessThanOrEqual(-32);
		expect(treatment.familyOverlapDepth).toBeGreaterThanOrEqual(-64);
		expect(treatment.familyPhotoClip).toBe('none');
		expect(treatment.familyPhotoFilter).not.toContain('blur');
		expect(treatment.familyReservedPadding).toBeGreaterThanOrEqual(80);
		expect(treatment.galleryTitleColor).not.toBe('rgb(255, 255, 255)');
		expect(treatment.itineraryOverlapDepth).toBeLessThanOrEqual(-32);
		expect(treatment.itineraryOverlapDepth).toBeGreaterThanOrEqual(-64);
		expect(treatment.itineraryPhotoClip).toBe('none');
		expect(treatment.itineraryPhotoFilter).not.toContain('blur');
		expect(treatment.itineraryReservedPadding).toBeGreaterThanOrEqual(64);
		expect(treatment.blendDepth).toBeGreaterThanOrEqual(56);
		expect(treatment.blendDepth).toBeLessThanOrEqual(80);
		expect(treatment.blendBackground).toContain('radial-gradient');
		expect(treatment.blendLayer).toBe('0');
		expect(treatment.blendAnimation).toContain('celestial-blend-arrival');
	}
});

test('keeps Celestial section entrances pending during a slow read, then reveals each family on scroll', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');
	await page.waitForTimeout(8500);

	const access = page.locator(
		'.invitation-section-wrapper[data-section-kind="personalized-access"]',
	);
	const gallery = page.locator('.invitation-section-wrapper[data-section-kind="gallery"]');
	const itinerary = page.locator('.invitation-section-wrapper[data-section-kind="itinerary"]');
	const locationInterlude = page.locator(
		'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection-source="location"]',
	);
	const familyInterlude = page.locator(
		'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="family"]',
	);
	const itineraryInterlude = page.locator(
		'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="itinerary"]',
	);

	for (const section of [access, gallery, itinerary, locationInterlude, familyInterlude, itineraryInterlude]) {
		await expect(section).not.toHaveClass(/is-visible/);
	}

	await access.scrollIntoViewIfNeeded();
	await expect(access).toHaveClass(/is-visible/);
	await expect(access.locator('.access-card__count')).toHaveCSS(
		'animation-name',
		/pa-celestial-count-in/,
	);

	await gallery.scrollIntoViewIfNeeded();
	await expect(gallery).toHaveClass(/is-visible/);
	await expect(gallery.locator('[data-gallery-item]').first()).toHaveCSS(
		'animation-name',
		/celestial-gallery-anchor-reveal/,
	);
	await expect(gallery.locator('[data-gallery-item]').first()).toHaveAttribute('data-in-view', 'true');

	await itinerary.scrollIntoViewIfNeeded();
	await expect(itinerary).toHaveClass(/is-visible/);
	await expect(itinerary.locator('[data-itinerary-item]').first()).toHaveCSS(
		'animation-name',
		/celestial-itinerary-row-reveal/,
	);
	await expect(itinerary.locator('.itinerary__program-flourish')).toHaveCSS(
		'animation-name',
		/celestial-itinerary-flourish-reveal/,
	);

	await familyInterlude.scrollIntoViewIfNeeded();
	await expect(familyInterlude).toHaveClass(/is-visible/);
	await expect(familyInterlude.locator('.invitation-interlude__image')).toHaveCSS(
		'animation-name',
		'none',
	);

	await locationInterlude.scrollIntoViewIfNeeded();
	await expect(locationInterlude).toHaveClass(/is-visible/);
	await expect(locationInterlude.locator('.invitation-interlude__media')).toHaveCSS(
		'animation-name',
		/invitation-reveal-media/,
	);
	await expect(locationInterlude.locator('.invitation-interlude__image')).toHaveCSS(
		'animation-name',
		/interlude-ambient/,
	);

	await itineraryInterlude.scrollIntoViewIfNeeded();
	await expect(itineraryInterlude).toHaveClass(/is-visible/);
	await expect(itineraryInterlude.locator('.invitation-interlude__image')).toHaveCSS(
		'animation-name',
		'none',
	);
});

test('removes the Celestial flagship treatment under reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true');

	const reduced = await page.evaluate(() => {
		const hero = document.querySelector<HTMLElement>(
			'.event--demo-xv-celestial-blue .invitation-hero',
		);
		const media = hero?.querySelector<HTMLElement>('.invitation-hero__background img');
		if (!hero || !media) throw new Error('Celestial hero was not rendered');

		return {
			constellationAnimation: getComputedStyle(hero, '::before').animationName,
			mediaAnimation: getComputedStyle(media).animationName,
			mediaTransform: getComputedStyle(media).transform,
			mediaScale: getComputedStyle(media).scale,
			familyOverlapAnimation: getComputedStyle(
				document.querySelector<HTMLElement>(
					'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="family"] .invitation-interlude__image',
				)!,
			).animationName,
			itineraryOverlapAnimation: getComputedStyle(
				document.querySelector<HTMLElement>(
					'.invitation-section-wrapper[data-section-kind="interlude"][data-intersection="overlap"][data-intersection-source="itinerary"] .invitation-interlude__image',
				)!,
			).animationName,
		};
	});

	expect(reduced).toEqual({
		constellationAnimation: 'none',
		mediaAnimation: 'none',
		mediaTransform: 'none',
		mediaScale: 'none',
		familyOverlapAnimation: 'none',
		itineraryOverlapAnimation: 'none',
	});
});

test('renders locked Abril RSVP without an island or RSVP client requests', async ({ page }) => {
	const requested: string[] = [];
	page.on('request', (request) => requested.push(request.url()));
	await page.goto('/xv/abril-michelle-becerra-rea?skipEnvelope=true');
	await page.locator('#rsvp').scrollIntoViewIfNeeded();
	await page.waitForTimeout(500);

	await expect(page.locator('#rsvp [data-state="locked"]')).toBeVisible();
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
	await expect(page.locator('#attendance-yes')).toBeVisible();
	await page.locator('#attendance-yes').check({ force: true });
	await expect(page.locator('#attendance-yes')).toBeChecked();
	await expect(page.locator('#rsvp-form')).toBeVisible();
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
