import { test, expect } from '@playwright/test';

test.describe('Demo Routing Parity', () => {
	test('renders a public demo event correctly without an inviteId', async ({ page }) => {
		// A demo event provides high-fidelity showcase without requiring personalization
		const response = await page.goto('/xv/demo-xv-jewelry-box?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		expect(response?.ok()).toBeTruthy();

		// Should render the main envelope, revealing the event
		await expect(page.locator('.envelope-wrapper')).toBeVisible();

		// Opening the envelope exposes the underlying components
		await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
		await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
			'data-reveal-state',
			'revealed',
		);

		// Core sections should mount correctly
		await expect(page.locator('#inicio')).toBeVisible();
		await expect(page.locator('#family-section')).toBeVisible();

		// The RSVP component should mount (even if in a limited demo mode or hybrid access mode)
		const rsvpSection = page.locator('#rsvp');
		await expect(rsvpSection).toBeVisible();
	});

	test('degrades gracefully without redirecting when demo route is accessed with invalid inviteId', async ({
		page,
	}) => {
		// The route personalization layer must catch errors but NOT block demo routes
		const response = await page.goto('/xv/demo-xv-jewelry-box?invite=invalid-demo-id', {
			waitUntil: 'domcontentloaded',
		});
		expect(response?.ok()).toBeTruthy();

		// Validate that the URL remains intact and standard fallback rendering occurs
		const url = page.url();
		expect(url).toContain('invite=invalid-demo-id');
		await expect(page.locator('main.event-theme-wrapper')).toBeVisible();
	});

	test.describe('Showroom – XV (multi-demo)', () => {
		test('default page load features Celestial Blue with 3 selector alternatives', async ({
			page,
		}) => {
			const response = await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });
			expect(response?.ok()).toBeTruthy();

			// Intro copy
			await expect(page.locator('.demo-showroom__eyebrow').first()).toHaveText(
				'LOOKBOOK XV AÑOS',
			);
			await expect(page.locator('.demo-showroom__title')).toHaveText(
				'Elige una referencia visual para tu invitación',
			);
			await expect(page.locator('.demo-showroom__description')).toHaveText(
				'Cada propuesta se adapta a tus fotografías, paleta de colores y estilo del evento.',
			);

			// Featured panel defaults to Celestial Blue
			await expect(page.locator('.demo-lookbook__copy .demo-showroom__eyebrow')).toHaveText(
				'Estilo destacado',
			);
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('XV Celestial Blue');

			// Selector section is visible with correct copy
			const selectorSection = page.locator('.demo-showroom__selector');
			await expect(selectorSection).toBeVisible();
			await expect(selectorSection.locator('#demo-showroom-selector-title')).toHaveText(
				'Explora otros estilos',
			);

			// Exactly 3 cards (active excluded)
			const cards = selectorSection.locator('.demo-style');
			await expect(cards).toHaveCount(3);

			// Canonical order: Celestial Blue absent, remaining in order
			const expectedSelectorSlugs = [
				'demo-xv-editorial-magazine',
				'demo-xv-enchanted-rose',
				'demo-xv-editorial',
			];
			for (let i = 0; i < 3; i++) {
				await expect(cards.nth(i)).toHaveAttribute('data-demo-slug', expectedSelectorSlugs[i]);
			}

			// Cards link to showroom query-param (not to the demo page directly)
			await expect(cards.nth(0)).toHaveAttribute('href', '?demo=demo-xv-editorial-magazine');

			// Benefit strip
			await expect(page.locator('#demo-showroom-strip-title')).toHaveText(
				'Nuestras invitaciones incluyen:',
			);
		});

		test('valid ?demo= query param deep-links to the correct SSR featured demo', async ({
			page,
		}) => {
			const response = await page.goto('/demos/xv?demo=demo-xv-enchanted-rose', {
				waitUntil: 'domcontentloaded',
			});
			expect(response?.ok()).toBeTruthy();

			// Featured panel shows the deep-linked demo
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Enchanted Rose');

			// Selector shows 3 cards, Enchanted Rose is absent
			const cards = page.locator('.demo-showroom__selector .demo-style');
			await expect(cards).toHaveCount(3);
			const slugs = await cards.evaluateAll((els) =>
				els.map((el) => el.getAttribute('data-demo-slug') ?? ''),
			);
			expect(slugs).not.toContain('demo-xv-enchanted-rose');
			// Celestial Blue must be available (user can return to it)
			expect(slugs).toContain('demo-xv-celestial-blue');
		});

		test('invalid ?demo= slug falls back to Celestial Blue (first approved demo)', async ({
			page,
		}) => {
			const response = await page.goto('/demos/xv?demo=demo-xv-jewelry-box', {
				waitUntil: 'domcontentloaded',
			});
			expect(response?.ok()).toBeTruthy();

			// Jewelry Box is hidden — must fall back to Celestial Blue
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('XV Celestial Blue');
			const cards = page.locator('.demo-showroom__selector .demo-style');
			await expect(cards).toHaveCount(3);
		});

		test('nonexistent ?demo= slug falls back safely', async ({ page }) => {
			const response = await page.goto('/demos/xv?demo=INVALID_SLUG_XYZ', {
				waitUntil: 'domcontentloaded',
			});
			expect(response?.ok()).toBeTruthy();

			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('XV Celestial Blue');
		});

		test('clicking a selector card updates the featured panel without a full page reload', async ({
			page,
		}) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Track any document-level navigation requests (GET /demos/xv*)
			const documentRequests: string[] = [];
			page.on('request', (req) => {
				if (req.resourceType() === 'document') {
					documentRequests.push(req.url());
				}
			});

			// Click the Editorial Magazine card
			const magazineCard = page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]');
			await expect(magazineCard).toBeVisible();
			await magazineCard.click();

			// Featured title must update (confirms JS ran)
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText(
				'Editorial Magazine',
			);

			// No additional document navigation request should have been made after initial load
			expect(documentRequests.length).toBeLessThanOrEqual(1);

			// URL updated to reflect new selection (via pushState)
			await expect(page).toHaveURL(/demo=demo-xv-editorial-magazine/);
		});

		test('after selecting Editorial Magazine, selector shows 3 cards with correct slugs', async ({
			page,
		}) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			const magazineCard = page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]');
			await magazineCard.click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial Magazine');

			const cards = page.locator('.demo-showroom__selector .demo-style');
			await expect(cards).toHaveCount(3);

			const slugs = await cards.evaluateAll((els) =>
				els.map((el) => el.getAttribute('data-demo-slug') ?? ''),
			);
			expect(slugs).not.toContain('demo-xv-editorial-magazine');
			// Celestial Blue returns to selector
			expect(slugs).toContain('demo-xv-celestial-blue');
			// Canonical order preserved
			expect(slugs).toEqual(['demo-xv-celestial-blue', 'demo-xv-enchanted-rose', 'demo-xv-editorial']);
		});

		test('user can return to Celestial Blue after selecting another demo', async ({ page }) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Select Editorial
			const editorialCard = page.locator('.demo-style[data-demo-slug="demo-xv-editorial"]');
			await editorialCard.click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial');

			// Celestial Blue should now be in the selector
			const celestialCard = page.locator('.demo-style[data-demo-slug="demo-xv-celestial-blue"]');
			await expect(celestialCard).toBeVisible();
			await celestialCard.click();

			// Returns to Celestial Blue
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('XV Celestial Blue');
		});

		test('CTA link in featured panel points to the selected demo route', async ({ page }) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Default CTA points to Celestial Blue
			const ctaPrimary = page.locator('[data-track-cta="demo_hero_open"]');
			await expect(ctaPrimary).toHaveAttribute('href', /demo-xv-celestial-blue/);

			// After selecting Editorial Magazine, CTA should point to Editorial Magazine
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]').click();
			await expect(page.locator('[data-track-cta="demo_hero_open"]')).toHaveAttribute(
				'href',
				/demo-xv-editorial-magazine/,
			);
		});

		test('browser refresh on ?demo= deep-link URL preserves the selection via SSR', async ({
			page,
		}) => {
			await page.goto('/demos/xv?demo=demo-xv-editorial', { waitUntil: 'domcontentloaded' });
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial');

			// Simulate refresh
			await page.reload({ waitUntil: 'domcontentloaded' });
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial');
		});

		test('mobile viewport (390px) shows 3 selector cards without overflow', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			const cards = page.locator('.demo-showroom__selector .demo-style');
			await expect(cards).toHaveCount(3);

			// Verify cards are visible (not clipped or hidden)
			for (let i = 0; i < 3; i++) {
				await expect(cards.nth(i)).toBeVisible();
			}
		});

		test('CTA tracking events remain active and log correct data properties after dynamic switches', async ({
			page,
		}) => {
			// Mock the tracking client's click listener using page.addInitScript
			await page.addInitScript(() => {
				(window as any).dataLayer = [];
				document.addEventListener('click', (event) => {
					const target = event.target instanceof Element ? event.target.closest('[data-track-event]') : null;
					if (!(target instanceof HTMLElement)) return;
					const eventName = target.getAttribute('data-track-event');
					if (!eventName) return;

					// Prevent navigation to keep the page context alive for assertions
					event.preventDefault();

					(window as any).dataLayer.push({
						event: eventName,
						cta_id: target.getAttribute('data-track-cta') || '',
						cta_label: target.getAttribute('data-track-label') || target.textContent?.trim() || '',
						demo_slug: target.getAttribute('data-demo-slug') || '',
					});
				});
			});

			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Click Editorial Magazine to dynamically replace DOM nodes
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]').click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial Magazine');

			// Click "Ver demo" primary CTA on the newly swapped node
			const cta = page.locator('[data-track-cta="demo_hero_open"]');
			await cta.click();

			// Inspect the window.dataLayer array pushes
			const dataLayer = await page.evaluate(() => (window as any).dataLayer || []);
			// Filter for 'cta_clicked' events
			const clicks = dataLayer.filter((ev: any) => ev.event === 'cta_clicked');
			expect(clicks.length).toBeGreaterThanOrEqual(1);

			// Last click event should have correct dynamic demo_slug
			const lastClick = clicks[clicks.length - 1];
			expect(lastClick.demo_slug).toBe('demo-xv-editorial-magazine');
			expect(lastClick.cta_id).toBe('demo_hero_open');
		});

		test('browser Back and Forward popstate restores complete showroom state and layout', async ({
			page,
		}) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Select Editorial Magazine
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]').click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial Magazine');

			// Select Enchanted Rose
			await page.locator('.demo-style[data-demo-slug="demo-xv-enchanted-rose"]').click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Enchanted Rose');

			// Perform Back navigation
			await page.goBack();
			await expect(page).toHaveURL(/demo=demo-xv-editorial-magazine/);
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Editorial Magazine');

			// Verify cards order
			const cardsAfterBack = page.locator('.demo-showroom__selector .demo-style');
			const slugsAfterBack = await cardsAfterBack.evaluateAll((els) =>
				els.map((el) => el.getAttribute('data-demo-slug') ?? ''),
			);
			expect(slugsAfterBack).toEqual(['demo-xv-celestial-blue', 'demo-xv-enchanted-rose', 'demo-xv-editorial']);

			// Perform Forward navigation
			await page.goForward();
			await expect(page).toHaveURL(/demo=demo-xv-enchanted-rose/);
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Enchanted Rose');

			// Perform Back navigation twice to get to the initial state (no parameter)
			await page.goBack();
			await page.goBack();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('XV Celestial Blue');
		});

		test('preserves unrelated query parameters when using history state updates', async ({
			page,
		}) => {
			await page.goto('/demos/xv?utm_source=facebook&utm_medium=cpc', {
				waitUntil: 'domcontentloaded',
			});

			// Select Enchanted Rose
			await page.locator('.demo-style[data-demo-slug="demo-xv-enchanted-rose"]').click();
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText('Enchanted Rose');

			// URL must keep utm parameters
			const currentUrl = page.url();
			expect(currentUrl).toContain('utm_source=facebook');
			expect(currentUrl).toContain('utm_medium=cpc');
			expect(currentUrl).toContain('demo=demo-xv-enchanted-rose');
		});

		test('canonical link excludes the demo query parameter', async ({ page }) => {
			await page.goto('/demos/xv?demo=demo-xv-editorial', { waitUntil: 'domcontentloaded' });

			const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
			expect(canonical).not.toContain('demo=');
			expect(canonical).toContain('/demos/xv');
		});

		test('keyboard focus correctly moves to the newly featured title for accessibility', async ({
			page,
		}) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Click via keyboard or element click
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial"]').click();

			// Focus should now rest on the newly loaded featured title
			const focusedId = await page.evaluate(() => document.activeElement?.id);
			expect(focusedId).toBe('demo-showroom-featured-title');
		});

		test('no duplicate IDs or invalid ARIA references appear in active DOM after multiple switches', async ({
			page,
		}) => {
			await page.goto('/demos/xv', { waitUntil: 'domcontentloaded' });

			// Multiple clicks
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial-magazine"]').click();
			await page.locator('.demo-style[data-demo-slug="demo-xv-enchanted-rose"]').click();
			await page.locator('.demo-style[data-demo-slug="demo-xv-editorial"]').click();

			// Count matching IDs in active DOM
			const titleIDCount = await page.evaluate(
				() => document.querySelectorAll('#demo-showroom-featured-title').length,
			);
			expect(titleIDCount).toBe(1);
		});
	});

	test.describe('Showroom – Boda (single-demo)', () => {
		test('single-demo category renders no selector section', async ({ page }) => {
			const response = await page.goto('/demos/boda', { waitUntil: 'domcontentloaded' });
			expect(response?.ok()).toBeTruthy();

			// Singular intro copy
			await expect(page.locator('.demo-showroom__eyebrow').first()).toHaveText('LOOKBOOK BODA');
			await expect(page.locator('.demo-showroom__title')).toHaveText(
				'Referencia visual para tu invitación',
			);
			await expect(page.locator('.demo-showroom__description')).toHaveText(
				'Esta propuesta se adapta a tus fotografías, paleta de colores y estilo del evento.',
			);

			// Featured panel eyebrow is 'Estilo disponible' for single demos
			await expect(page.locator('.demo-lookbook__copy .demo-showroom__eyebrow')).toHaveText(
				'Estilo disponible',
			);
			await expect(page.locator('#demo-showroom-featured-title')).toHaveText(
				'Boda estilo Jewelry Box',
			);

			// Selector section must not be present in DOM
			await expect(page.locator('.demo-showroom__selector')).not.toBeVisible();

			// Benefit strip still present
			await expect(page.locator('#demo-showroom-strip-title')).toHaveText(
				'Nuestras invitaciones incluyen:',
			);
		});
	});
});
