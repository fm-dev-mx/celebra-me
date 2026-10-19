import sharp from 'sharp';
import {
	buildR2ResponsiveSrcset,
	buildR2SocialObjectKey,
	buildR2VariantObjectKey,
} from '@/lib/intake/services/r2-invitation-media';
import {
	RESPONSIVE_IMAGE_WIDTHS,
	encodeResponsiveVariants,
	variantMaxDimension,
} from '@/lib/images/responsive-variants';
import { sharpImageTransformer } from '@/lib/images/sharp-image-transformer';

const sha = 'c'.repeat(64);
const original = `invitations/xv/america/hero-${sha}.webp`;
const enabled = [{ origin: 'https://media.celebra-me.com', responsiveVariants: true }];

describe('R2 width variants', () => {
	it('keys each variant beside its original under the same digest', () => {
		expect(buildR2VariantObjectKey(original, 800)).toBe(
			`invitations/xv/america/hero-${sha}.w800.webp`,
		);
		expect(buildR2VariantObjectKey(original.replace('.webp', '.jpg'), 480)).toBe(
			`invitations/xv/america/hero-${sha}.w480.webp`,
		);
		expect(() => buildR2VariantObjectKey('invitations/xv/america/hero.webp', 800)).toThrow(
			'content-addressed',
		);
		expect(buildR2SocialObjectKey(original)).toBe(`invitations/xv/america/hero-${sha}.og.jpg`);
	});

	it('lists every width only for a bucket that completed its variants', () => {
		const url = `https://media.celebra-me.com/${original}`;
		expect(buildR2ResponsiveSrcset(url, enabled)).toBe(
			RESPONSIVE_IMAGE_WIDTHS.map(
				(width) =>
					`https://media.celebra-me.com/invitations/xv/america/hero-${sha}.w${width}.webp ${width}w`,
			).join(', '),
		);
		expect(buildR2ResponsiveSrcset(url, [{ ...enabled[0], responsiveVariants: false }])).toBe(
			undefined,
		);
	});

	it('lists nothing for derived, foreign or decorated URLs', () => {
		for (const url of [
			`https://media.celebra-me.com/invitations/xv/america/hero-${sha}.og.jpg`,
			`https://media.celebra-me.com/invitations/xv/america/hero-${sha}.w800.webp`,
			`https://media.celebra-me.com/${original}?v=2`,
			`https://example.com/${original}`,
			'/_astro/hero.webp',
			'not a url',
		])
			expect(buildR2ResponsiveSrcset(url, enabled)).toBeUndefined();
	});

	it('fits the long side to the target width without enlarging', () => {
		expect(variantMaxDimension({ width: 1280, height: 1547 }, 800)).toBe(967);
		expect(variantMaxDimension({ width: 1920, height: 1400 }, 480)).toBe(480);
		expect(variantMaxDimension({ width: 600, height: 900 }, 800)).toBe(900);
	});

	it('encodes one WebP per width, never wider than the source', async () => {
		const source = new Uint8Array(
			await sharp({
				create: { width: 1000, height: 1500, channels: 3, background: '#c8a2c8' },
			})
				.webp()
				.toBuffer(),
		);
		const variants = await encodeResponsiveVariants(sharpImageTransformer, source);
		expect(variants.map((variant) => variant.width)).toEqual([...RESPONSIVE_IMAGE_WIDTHS]);
		const widths = await Promise.all(
			variants.map(async (variant) => (await sharp(variant.data).metadata()).width),
		);
		expect(widths).toEqual([480, 800, 1000, 1000]);
		// At or above the source width the original WebP is stored as-is: no re-encoding loss.
		expect(variants[2].data).toBe(source);
		expect(variants[3].data).toBe(source);
		for (const variant of variants)
			expect((await sharp(variant.data).metadata()).format).toBe('webp');
	});
});
