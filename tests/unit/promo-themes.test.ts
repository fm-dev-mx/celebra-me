import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import sharp from 'sharp';
import {
	getActiveCampaign,
	getCampaignTheme,
	getPromoShareImage,
	parsePromoThemePreview,
	PROMO_SCHEDULE,
	PROMO_THEMES,
	type PromoTheme,
} from '@/data/promo-campaign.data';
import {
	buildPromoThemePattern,
	buildPromoThemeSprite,
	buildPromoThemeSymbols,
	PROMO_THEME_ART,
	PROMO_THEME_ART_MAX_BYTES,
} from '@/data/promo-theme-art.data';
import { buildPromoThemeBootScript } from '@/lib/landing/promo-theme-boot';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** Runs the head script against a bare `<html>` and returns the theme it set, if any. */
function runBoot(input: { now: string; search?: string; allowPreview: boolean }): string | null {
	const attributes: Record<string, string> = {};
	const script = buildPromoThemeBootScript({
		schedule: PROMO_SCHEDULE,
		allowPreview: input.allowPreview,
	});
	const fixedNow = Date.parse(input.now);
	class FixedDate extends Date {
		static now() {
			return fixedNow;
		}
	}
	runInNewContext(script, {
		Date: FixedDate,
		URLSearchParams,
		window: { location: { search: input.search ?? '' } },
		document: {
			documentElement: {
				setAttribute: (name: string, value: string) => {
					attributes[name] = value;
				},
			},
		},
	});
	return attributes['data-promo-theme'] ?? null;
}

describe('promo theme artwork', () => {
	it.each(PROMO_THEMES)('keeps %s small, single-stroke and in currentColor', (theme) => {
		const markup = buildPromoThemeSymbols(theme) + buildPromoThemePattern(theme);
		expect(Buffer.byteLength(markup, 'utf8')).toBeLessThan(PROMO_THEME_ART_MAX_BYTES);
		expect(markup.match(/<path /g)).toHaveLength(3);
		expect(markup).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|<text|<image|<style|<script/i);
		for (const path of markup.match(/<path [^>]*>/g) ?? []) {
			expect(path).toContain('fill="none" stroke="currentColor"');
		}
	});

	it('draws every theme of the type and nothing else', () => {
		expect(Object.keys(PROMO_THEME_ART).sort()).toEqual([...PROMO_THEMES].sort());
		expect(buildPromoThemeSprite().match(/<symbol /g)).toHaveLength(PROMO_THEMES.length * 2);
	});

	it('hides every artwork from assistive technology', () => {
		for (const file of [
			'src/components/home/PromoEmblem.astro',
			'src/components/home/PromoOrnament.astro',
			'src/components/home/PromoThemeSprite.astro',
			'src/components/home/PromoBand.astro',
		]) {
			expect(read(file)).toMatch(/aria-hidden="true"/);
		}
	});
});

describe('promo theme preview', () => {
	it('reads ?tema= only for known themes', () => {
		expect(parsePromoThemePreview('?fecha=2026-11-05&tema=buenfin')).toBe('buenfin');
		for (const search of ['', '?tema=', '?tema=halloween', '?tema=BUENFIN', '?theme=amor']) {
			expect(parsePromoThemePreview(search)).toBeNull();
		}
	});

	it('restyles an active row only', () => {
		const temporada = PROMO_SCHEDULE.find((campaign) => campaign.id === 'temporada-2026')!;
		expect(getCampaignTheme(temporada)).toBe('temporada');
		expect(getCampaignTheme(temporada, 'patrias')).toBe('patrias');
		expect(getCampaignTheme(null, 'patrias')).toBeNull();
	});
});

describe('promo theme head script', () => {
	it('matches the active row of the promo module', () => {
		for (const campaign of PROMO_SCHEDULE) {
			const expected = getActiveCampaign(new Date(campaign.startsAt))?.theme ?? null;
			expect(runBoot({ now: campaign.startsAt, allowPreview: false })).toBe(expected);
		}
	});

	it('sets nothing outside every row or on a row without theme', () => {
		expect(runBoot({ now: '2026-10-15T18:00:00.000Z', allowPreview: false })).toBeNull();
		expect(runBoot({ now: '2027-03-15T18:00:00.000Z', allowPreview: false })).toBeNull();
	});

	it('follows ?fecha= and ?tema= only when previews are allowed', () => {
		const today = '2026-10-25T18:00:00.000Z';
		expect(runBoot({ now: today, search: '?fecha=2027-02-14', allowPreview: true })).toBe(
			'amor',
		);
		expect(
			runBoot({ now: today, search: '?fecha=2027-02-14', allowPreview: false }),
		).toBeNull();
		expect(
			runBoot({ now: today, search: '?fecha=2026-11-05&tema=buenfin', allowPreview: true }),
		).toBe('buenfin');
		expect(runBoot({ now: today, search: '?tema=patrias', allowPreview: true })).toBe(
			'patrias',
		);
		expect(
			runBoot({ now: today, search: '?fecha=2027-03-10&tema=amor', allowPreview: true }),
		).toBeNull();
		expect(runBoot({ now: today, search: '?fecha=2027-02-30', allowPreview: true })).toBeNull();
	});
});

describe('promo share images', () => {
	it.each(PROMO_THEMES)('ships a 1200x630 JPEG for %s', async (theme: PromoTheme) => {
		const src = getPromoShareImage(theme)!;
		const file = join(ROOT, 'public', src);
		expect(existsSync(file)).toBe(true);
		const meta = await sharp(file).metadata();
		expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630]);
	});

	it.each(PROMO_THEMES)(
		'keeps the original lettering of the %s image untouched',
		async (theme) => {
			// Logo, headline, event list and demos line of og-vitrina.jpg; overlays stay outside it.
			const textArea = { left: 60, top: 100, width: 540, height: 410 };
			const pixels = (file: string) => sharp(file).extract(textArea).raw().toBuffer();
			const original = await pixels(join(ROOT, 'public/images/og/og-vitrina.jpg'));
			const themed = await pixels(join(ROOT, 'public', getPromoShareImage(theme)!));
			const changed = themed.filter((value, index) => Math.abs(value - original[index]) > 40);
			expect(changed.length).toBe(0);
		},
	);

	it('keeps the default image outside a themed row', () => {
		expect(getPromoShareImage(null)).toBeNull();
		expect(read('src/pages/index.astro')).toContain(
			'getPromoShareImage(getActiveCampaign()?.theme ?? null)',
		);
	});
});

describe('promo theme placement', () => {
	it('puts the band between Testimonials and Pricing and two ornaments at most', () => {
		const page = read('src/pages/index.astro');
		const order = [
			'<ProductProof',
			'<PromoOrnament />',
			'<Testimonials',
			'<PromoBand />',
			'<Pricing',
			'<HowItWorks',
			'<PromoOrnament />',
			'<FAQ',
		];
		let cursor = 0;
		for (const tag of order) {
			const index = page.indexOf(tag, cursor);
			expect(index).toBeGreaterThanOrEqual(cursor);
			cursor = index + tag.length;
		}
		expect(page.match(/<PromoOrnament \/>/g)).toHaveLength(2);
		expect(page).toContain('<PromoThemeBoot slot="head" />');
	});

	it('hides every themed surface until html[data-promo-theme] is set', () => {
		const styles = read('src/styles/home/_promo-themes.scss');
		expect(styles).toMatch(
			/\.promo-band,\s*\.promo-ornament,\s*\.promo-emblem,\s*\.hero-promo-pill,\s*\.sticky-cta__promo,\s*\[data-promo-art\] \{\s*display: none;/,
		);
		expect(styles).not.toMatch(/@keyframes|animation:/);
	});
});
