import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { ImageDelivery } from '@/lib/assets/image-delivery';
import { shouldOptimizeThroughImageService } from '@/lib/assets/image-delivery-policy';
import { buildR2ResponsiveSrcset } from '@/lib/intake/services/r2-invitation-media';

/** Rendered arch width per breakpoint; `Hero.astro` and the preload share these `sizes`. */
export const NIGHT_ARCH_MOBILE_SIZES = 'min(74vw, 22rem)';
export const NIGHT_ARCH_DESKTOP_SIZES = 'min(30vw, 26rem)';
export const HERO_MOBILE_MEDIA = '(max-width: 991px)';
export const HERO_DESKTOP_MEDIA = '(min-width: 992px)';

export interface HeroImagePreload {
	rel: 'preload';
	as: 'image';
	href: string;
	media: string;
	fetchpriority: 'high';
	imagesrcset?: string;
	imagesizes?: string;
}

interface HeroImageInput {
	variant: string;
	backgroundImageMobile?: ImageAsset;
	backgroundImageDesktop?: { src: string; delivery?: ImageDelivery };
}

function plainSource(
	src: ImageAsset['src'] | undefined,
	delivery: ImageDelivery | undefined,
): string | null {
	if (typeof src !== 'string' || !src) return null;
	// Mirrors `Hero.astro`: a string source without a delivery is used as is.
	if (!delivery) return src;
	return shouldOptimizeThroughImageService(src, delivery) ? null : src;
}

function preload(href: string, media: string, sizes: string): HeroImagePreload {
	const srcset = buildR2ResponsiveSrcset(href);
	return {
		rel: 'preload',
		as: 'image',
		href,
		media,
		fetchpriority: 'high',
		...(srcset ? { imagesrcset: srcset, imagesizes: sizes } : {}),
	};
}

/**
 * The night-arch photograph is the page's largest contentful paint, unlike full-bleed covers
 * (Chrome ignores viewport-sized images). Preloading lets it start before the stylesheets.
 * Sources that go through the image service resolve their URL while rendering, so they keep
 * the plain `<img>` discovery.
 */
export function buildHeroImagePreloads(hero: HeroImageInput): HeroImagePreload[] {
	if (hero.variant !== 'night-arch') return [];
	const links: HeroImagePreload[] = [];
	const mobile = plainSource(
		hero.backgroundImageMobile?.src,
		hero.backgroundImageMobile?.delivery,
	);
	if (mobile) links.push(preload(mobile, HERO_MOBILE_MEDIA, NIGHT_ARCH_MOBILE_SIZES));
	const desktop = plainSource(
		hero.backgroundImageDesktop?.src,
		hero.backgroundImageDesktop?.delivery,
	);
	if (desktop) links.push(preload(desktop, HERO_DESKTOP_MEDIA, NIGHT_ARCH_DESKTOP_SIZES));
	return links;
}
