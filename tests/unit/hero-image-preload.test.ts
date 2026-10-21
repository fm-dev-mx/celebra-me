import { PORTRAIT_HERO_SIZES, buildHeroImagePreloads } from '@/lib/invitation/hero-image-preload';
import { buildR2ResponsiveSrcset } from '@/lib/intake/services/r2-invitation-media';

const sha = 'd'.repeat(64);
const hosted = `https://media.celebra-me.com/invitations/xv/america/hero-${sha}.webp`;

describe('hero image preload', () => {
	it('preloads a hosted portrait with the srcset and sizes of its <img>', () => {
		for (const variant of ['framed-portrait', 'bleed-portrait']) {
			expect(
				buildHeroImagePreloads({
					variant,
					backgroundImage: { src: hosted, alt: 'América' },
				}),
			).toEqual([
				{
					rel: 'preload',
					as: 'image',
					href: hosted,
					fetchpriority: 'high',
					imagesrcset: buildR2ResponsiveSrcset(hosted),
					imagesizes: PORTRAIT_HERO_SIZES,
				},
			]);
		}
	});

	it('preloads a Storage portrait without a srcset it does not have', () => {
		const storage =
			'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/managed/america/hero.webp';
		expect(
			buildHeroImagePreloads({
				variant: 'bleed-portrait',
				backgroundImage: { src: storage, alt: 'América' },
			}),
		).toEqual([{ rel: 'preload', as: 'image', href: storage, fetchpriority: 'high' }]);
	});

	it('leaves image-service portraits and full-bleed covers to the <img>', () => {
		const bundled = { src: '/_astro/hero.abc.webp', width: 1024, height: 1536, format: 'webp' };
		expect(
			buildHeroImagePreloads({
				variant: 'framed-portrait',
				backgroundImage: bundled as never,
			}),
		).toEqual([]);
		expect(
			buildHeroImagePreloads({
				variant: 'framed-portrait',
				backgroundImage: { src: hosted, alt: '', delivery: { mode: 'optimized' } },
			}),
		).toEqual([]);
		expect(
			buildHeroImagePreloads({
				variant: 'standard',
				backgroundImage: { src: hosted, alt: '' },
			}),
		).toEqual([]);
	});
});
