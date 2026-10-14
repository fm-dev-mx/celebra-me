import type { ImageMetadata } from 'astro';

/** Hero image sources resolved once by `Hero.astro` and handed to its variant renderers. */
export interface HeroImageSources {
	bgSrc: ImageMetadata | string;
	mobileBgSrc: string | null;
	desktopBgSrc: string | null;
	portraitSrc: ImageMetadata | string | null;
}
