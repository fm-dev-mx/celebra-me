import { test, expect } from '@playwright/test';

/**
 * The magazine cover (reveal) and the hero must read as different sections: they may both name
 * the celebrant, but in a different typographic treatment, and they must not share any other
 * copy (date, venue, brand, taglines).
 */

const ROUTE = '/xv/destenid-sofia?forceEnvelope=true';
const viewports = [
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
];

const normalize = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const bigrams = (block: string, ignore: Set<string>) => {
	const words = normalize(block)
		.split(' ')
		.filter((word) => word && !ignore.has(word));
	const pairs: string[] = [];
	for (let i = 0; i < words.length - 1; i += 1) pairs.push(`${words[i]} ${words[i + 1]}`);
	return pairs;
};

for (const vp of viewports) {
	test(`cover and hero do not repeat copy at ${vp.width}x${vp.height}`, async ({ page }) => {
		await page.setViewportSize(vp);
		await page.goto(ROUTE, { waitUntil: 'networkidle' });
		await expect(
			page.locator('ds-editorial-cover[data-cover-experience="collector"]'),
		).toBeVisible();

		const texts = await page.evaluate(() => {
			const blocks = (root: Element | null) =>
				(root instanceof HTMLElement ? root.innerText : '')
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean);
			return {
				cover: [
					...blocks(document.querySelector('.ec-book__front')),
					...blocks(document.querySelector('.ec-hint')),
				],
				hero: blocks(document.querySelector('#inicio')),
				name: document.querySelector('.ec-face__star')?.textContent?.trim() ?? '',
			};
		});

		expect(texts.cover.length).toBeGreaterThan(4);
		expect(texts.hero.length).toBeGreaterThan(3);

		const nameWords = new Set(normalize(texts.name).split(' '));
		const coverBlocks = new Set(texts.cover.map(normalize));
		const sharedBlocks = texts.hero
			.map(normalize)
			.filter(
				(block) =>
					coverBlocks.has(block) && !block.split(' ').every((w) => nameWords.has(w)),
			);
		expect(sharedBlocks).toEqual([]);

		const coverPairs = new Set(texts.cover.flatMap((block) => bigrams(block, nameWords)));
		const sharedPairs = texts.hero
			.flatMap((block) => bigrams(block, nameWords))
			.filter((pair) => coverPairs.has(pair));
		expect(sharedPairs).toEqual([]);
	});

	test(`the celebrant's name uses a different treatment on cover and hero at ${vp.width}x${vp.height}`, async ({
		page,
	}) => {
		await page.setViewportSize(vp);
		await page.goto(ROUTE, { waitUntil: 'networkidle' });

		const styles = await page.evaluate(() => {
			const pick = (selector: string) => {
				const el = document.querySelector(selector);
				if (!el) return null;
				const cs = getComputedStyle(el);
				return {
					fontStyle: cs.fontStyle,
					textTransform: cs.textTransform,
					textAlign: cs.textAlign,
					color: cs.color,
				};
			};
			return {
				cover: pick('.ec-face__star'),
				hero: pick('.invitation-hero__first-name'),
			};
		});

		expect(styles.cover).not.toBeNull();
		expect(styles.hero).not.toBeNull();
		const cover = styles.cover!;
		const hero = styles.hero!;
		expect(
			cover.fontStyle !== hero.fontStyle || cover.textTransform !== hero.textTransform,
		).toBe(true);
		expect(cover.textAlign).not.toBe(hero.textAlign);
		expect(cover.color).not.toBe(hero.color);
	});
}
