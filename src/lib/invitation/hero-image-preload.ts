import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { ImageDelivery } from '@/lib/assets/image-delivery';
import type { ImageMetadata } from 'astro';
import { plainImgSrc, shouldOptimizeThroughImageService } from '@/lib/assets/image-delivery-policy';
import { buildR2ResponsiveSrcset } from '@/lib/intake/services/r2-invitation-media';

/** Rendered arch width per breakpoint; `Hero.astro` and the preload share these `sizes`. */
export const NIGHT_ARCH_MOBILE_SIZES = 'min(74vw, 22rem)';
export const NIGHT_ARCH_DESKTOP_SIZES = 'min(30vw, 26rem)';
export const HERO_MOBILE_MEDIA = '(max-width: 991px)';
export const HERO_DESKTOP_MEDIA = '(min-width: 992px)';
/** The framed and bleed portraits take the full phone width; `FramedPortraitHero` shares this. */
export const PORTRAIT_HERO_SIZES = '100vw';

export interface HeroImagePreload {
	rel: 'preload';
	as: 'image';
	href: string;
	media?: string;
	fetchpriority: 'high';
	imagesrcset?: string;
	imagesizes?: string;
}

interface HeroImageInput {
	variant: string;
	backgroundImage?: ImageMetadata | ImageAsset;
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

function preload(href: string, media: string | undefined, sizes: string): HeroImagePreload {
	const srcset = buildR2ResponsiveSrcset(href);
	return {
		rel: 'preload',
		as: 'image',
		href,
		...(media ? { media } : {}),
		fetchpriority: 'high',
		...(srcset ? { imagesrcset: srcset, imagesizes: sizes } : {}),
	};
}

/** Mirrors `CacheSafeImage`: only a source it renders as a plain `<img>` has a known URL. */
function portraitSource(image: ImageMetadata | ImageAsset): string | null {
	const src = 'delivery' in image || 'alt' in image ? image.src : image;
	const delivery = 'delivery' in image ? image.delivery : undefined;
	return shouldOptimizeThroughImageService(src, delivery) ? null : plainImgSrc(src);
}

/**
 * The night-arch and portrait photographs are the page's largest contentful paint, unlike
 * full-bleed covers (Chrome ignores viewport-sized images). Preloading lets them start before the
 * stylesheets and the envelope markup. Sources that go through the image service resolve their URL
 * while rendering, so they keep the plain `<img>` discovery.
 */
export function buildHeroImagePreloads(hero: HeroImageInput): HeroImagePreload[] {
	if (hero.variant === 'framed-portrait' || hero.variant === 'bleed-portrait') {
		const portrait = hero.backgroundImage && portraitSource(hero.backgroundImage);
		return portrait ? [preload(portrait, undefined, PORTRAIT_HERO_SIZES)] : [];
	}
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
