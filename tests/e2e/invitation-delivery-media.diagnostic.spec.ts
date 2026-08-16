import { expect, test, type Page } from '@playwright/test';

/**
 * Opt-in diagnostic: observes markup src vs browser-selected currentSrc.
 * Paths must stay aligned with DELIVERY_BENCHMARK_SCENARIOS.
 * Not part of `pnpm test:e2e:ci`. Does not mutate data.
 *
 *   DELIVERY_DIAGNOSTICS_ORIGIN=https://www.celebra-me.com pnpm exec playwright test tests/e2e/invitation-delivery-media.diagnostic.spec.ts
 */
const origin = process.env.DELIVERY_DIAGNOSTICS_ORIGIN?.replace(/\/$/, '');

const scenarios = [
	{
		id: 'versionedAnonymous',
		path: '/xv/renata',
		architecture: 'hashed-cloudinary',
	},
	{
		id: 'legacyStorageAnonymous',
		path: '/xv/romina-rios-chaparro',
		architecture: 'mutable-storage',
	},
] as const;

async function paintedHero(page: Page) {
	return page.evaluate(() => {
		const img =
			(document.querySelector('img[fetchpriority="high"]') as HTMLImageElement | null) ??
			(document.querySelector('picture img') as HTMLImageElement | null) ??
			(document.querySelector('img') as HTMLImageElement | null);
		if (!img) {
			return {
				markupSrc: null,
				currentSrc: null,
				pictureSources: [] as string[],
				requested: null,
				transferSize: null,
				encodedBodySize: null,
				decodedBodySize: null,
			};
		}
		const picture = img.closest('picture');
		const pictureSources = picture
			? [...picture.querySelectorAll('source')].map((source) => source.srcset || source.src)
			: [];
		const currentSrc = img.currentSrc || null;
		const timing = performance
			.getEntriesByType('resource')
			.filter((entry): entry is PerformanceResourceTiming => 'transferSize' in entry)
			.find((entry) => currentSrc && entry.name === currentSrc);
		return {
			markupSrc: img.getAttribute('src'),
			currentSrc,
			pictureSources,
			requested: timing?.name ?? null,
			transferSize: timing?.transferSize ?? null,
			encodedBodySize: timing?.encodedBodySize ?? null,
			decodedBodySize: timing?.decodedBodySize ?? null,
		};
	});
}

test.describe('invitation delivery media diagnostic @extended', () => {
	test.skip(!origin, 'Set DELIVERY_DIAGNOSTICS_ORIGIN to a read-only public origin');

	test.use({
		baseURL: origin || 'https://www.celebra-me.com',
		viewport: { width: 390, height: 844 },
	});

	for (const scenario of scenarios) {
		test(`records markup vs currentSrc for ${scenario.id}`, async ({ page }) => {
			const response = await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });
			expect(response?.ok()).toBeTruthy();
			const hero = await paintedHero(page);
			expect(hero.markupSrc || hero.currentSrc).toBeTruthy();
			console.info(
				JSON.stringify({
					id: scenario.id,
					architecture: scenario.architecture,
					markupSrc: hero.markupSrc,
					currentSrc: hero.currentSrc,
					requested: hero.requested,
					transferSize: hero.transferSize,
					encodedBodySize: hero.encodedBodySize,
					decodedBodySize: hero.decodedBodySize,
					pictureSourceCount: hero.pictureSources.length,
				}),
			);
		});
	}
});
