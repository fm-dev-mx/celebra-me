/**
 * Line artwork of the promo themes (`PromoTheme` in `src/data/promo-campaign.data.ts`).
 *
 * Every piece is a single stroked path drawn with `currentColor`, so the landing page colours it
 * with the design system tokens of `src/styles/home/_promo-themes.scss`. Each theme has:
 * - an emblem (24x24) shown next to the promo label, in the promo band and in the Hero pill;
 * - an ornament (120x12) drawn as a divider between two landing sections;
 * - a pattern tile (32x32) repeated faintly behind the promo band.
 *
 * Keep each theme under PROMO_THEME_ART_MAX_BYTES of markup; the unit test measures it.
 */

import { PROMO_THEMES, type PromoTheme } from '@/data/promo-campaign.data';

export interface PromoThemeArt {
	/** Path data in a 24x24 box. */
	readonly emblem: string;
	/** Path data in a 120x12 box. */
	readonly ornament: string;
	/** Path data in a 32x32 tile. */
	readonly pattern: string;
}

export const PROMO_THEME_ART_MAX_BYTES = 2048;
export const PROMO_EMBLEM_VIEWBOX = '0 0 24 24';
export const PROMO_ORNAMENT_VIEWBOX = '0 0 120 12';
export const PROMO_PATTERN_TILE = 32;

export const PROMO_THEME_ART: Readonly<Record<PromoTheme, PromoThemeArt>> = {
	amor: {
		emblem: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
		ornament:
			'M2 6h46M72 6h46M60 10.5s-5-3-5-6.2a2.6 2.6 0 0 1 5-1.3 2.6 2.6 0 0 1 5 1.3c0 3.2-5 6.2-5 6.2z',
		pattern: 'M16 21s-4-2.6-4-5.6a2 2 0 0 1 4-1 2 2 0 0 1 4 1c0 3-4 5.6-4 5.6z',
	},
	primavera: {
		emblem: 'M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4zM12 10a3.5 3.5 0 1 1 0-7 3.5 3.5 0 1 1 0 7zM12 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM10 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0zM14 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0z',
		ornament:
			'M2 6h44M74 6h44M46 6c4-5 10-5 14 0 4-5 10-5 14 0M46 6c4 5 10 5 14 0 4 5 10 5 14 0',
		pattern: 'M11 21c0-6 4-9 10-9 0 6-4 9-10 9zM11 21l6-5',
	},
	verano: {
		emblem: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
		ornament: 'M0 6q7.5-5 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0',
		pattern: 'M8 16q4-3 8 0t8 0',
	},
	patrias: {
		emblem: 'M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.1 6.1-.7z',
		ornament:
			'M0 2h120M10 2l5 7 5-7M30 2l5 7 5-7M50 2l5 7 5-7M70 2l5 7 5-7M90 2l5 7 5-7M110 2l5 7 5-7',
		pattern: 'M16 11l1.5 3.2 3.5.4-2.6 2.4.7 3.5-3.1-1.7-3.1 1.7.7-3.5-2.6-2.4 3.5-.4z',
	},
	buenfin: {
		emblem: 'M3 12V4h8l10 10-8 8zM7.5 6.5a1 1 0 1 0 0 2 1 1 0 1 0 0-2z',
		ornament: 'M2 6h48M70 6h48M54 2h12v8H54l-4-4z',
		pattern:
			'M12 11a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM20 18a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM11 21l10-10',
	},
	temporada: {
		emblem: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5',
		ornament: 'M2 6h46M72 6h46M60 1v10M55.7 3.5l8.6 5M55.7 8.5l8.6-5',
		pattern: 'M16 12v8M12.5 14l7 4M12.5 18l7-4',
	},
};

const STROKE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

export const promoEmblemSymbolId = (theme: PromoTheme) => `promo-emblem-${theme}`;
export const promoOrnamentSymbolId = (theme: PromoTheme) => `promo-ornament-${theme}`;
export const promoPatternId = (theme: PromoTheme) => `promo-pattern-${theme}`;

/** Sprite symbols (emblem and ornament) of one theme, for `<use href="#…">`. */
export function buildPromoThemeSymbols(theme: PromoTheme): string {
	const art = PROMO_THEME_ART[theme];
	return (
		`<symbol id="${promoEmblemSymbolId(theme)}" viewBox="${PROMO_EMBLEM_VIEWBOX}">` +
		`<path d="${art.emblem}" ${STROKE} stroke-width="1.5"/></symbol>` +
		`<symbol id="${promoOrnamentSymbolId(theme)}" viewBox="${PROMO_ORNAMENT_VIEWBOX}">` +
		`<path d="${art.ornament}" ${STROKE} stroke-width="1"/></symbol>`
	);
}

/**
 * Pattern definition of one theme. It stays inside the SVG that fills with it, so its
 * `currentColor` follows that SVG's colour.
 */
export function buildPromoThemePattern(theme: PromoTheme): string {
	const size = PROMO_PATTERN_TILE;
	return (
		`<pattern id="${promoPatternId(theme)}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">` +
		`<path d="${PROMO_THEME_ART[theme].pattern}" ${STROKE} stroke-width="1"/></pattern>`
	);
}

/** Every theme's sprite symbols, in the order of PROMO_THEMES. */
export function buildPromoThemeSprite(): string {
	return PROMO_THEMES.map(buildPromoThemeSymbols).join('');
}
