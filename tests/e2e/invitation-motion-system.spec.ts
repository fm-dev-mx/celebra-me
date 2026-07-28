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
	{ width: 390, height: 844 },
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
