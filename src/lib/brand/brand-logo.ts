/**
 * Single owner of every Celebra-me logo path on the site.
 *
 * Source: creative-ops `brands/assets/celebra-me/logo_2026_v2/` (svg/ and web/), copied unchanged.
 * Never redraw, retype, recolor or filter these files; replace them only with newer exports from
 * that folder. `scripts/check-brand-logo.mjs` fails when a logo file is referenced from anywhere else.
 */

export type LogoVersion = 'compacto' | 'horizontal' | 'firma-invitacion';
/** `claro` has cafe text for light grounds; `oscuro` has ivory text for dark grounds. */
export type LogoTone = 'claro' | 'oscuro';

interface LogoArtwork {
	/** Intrinsic SVG size (viewBox), used for the rendered aspect ratio. */
	viewBoxWidth: number;
	viewBoxHeight: number;
	/** Smallest rendered width allowed by the brand rules. */
	minWidth: number;
}

const LOGO_ARTWORK: Record<LogoVersion, LogoArtwork> = {
	compacto: { viewBoxWidth: 336, viewBoxHeight: 142.77, minWidth: 120 },
	horizontal: { viewBoxWidth: 418.33, viewBoxHeight: 116, minWidth: 320 },
	'firma-invitacion': { viewBoxWidth: 336, viewBoxHeight: 162.73, minWidth: 120 },
};

export const LOGO_ALT = 'Celebra-me';

export function getLogoSrc(version: LogoVersion, tone: LogoTone): string {
	return `/brand/celebra-me_${version}_color-${tone}.svg`;
}

export function getLogoSize(
	version: LogoVersion,
	width: number,
): { width: number; height: number } {
	const artwork = LOGO_ARTWORK[version];
	if (width < artwork.minWidth) {
		throw new Error(
			`Logo "${version}" needs at least ${artwork.minWidth}px of width (got ${width}).`,
		);
	}
	return { width, height: Math.round((width * artwork.viewBoxHeight) / artwork.viewBoxWidth) };
}

/** Site icons and the default shared-link image (web/ in logo_2026_v2). */
export const BRAND_ICONS = {
	faviconSvg: '/favicon.svg',
	faviconIco: '/favicon.ico',
	favicon16: '/favicon-16.png',
	favicon32: '/favicon-32.png',
	appleTouchIcon: '/apple-touch-icon.png',
	icon512: '/icons/icon-512.png',
} as const;

export const BRAND_SOCIAL_IMAGE = {
	src: '/images/og/og-image_1200x630.png',
	width: 1200,
	height: 630,
	type: 'image/png',
} as const;
