import { resolveSealPresentation } from '@/lib/invitation/reveal-card';

describe('Raster Seal Resolution Contract', () => {
	it('maps raster input to normalized raster seal presentation', () => {
		const sealImage = '/images/rose-wax-seal.png';
		const asset = { src: sealImage, alt: 'Sello' };
		const presentation = resolveSealPresentation({
			sealStyle: 'wax',
			sealVariant: 'premium-rose',
			sealImage: asset,
		});

		expect(presentation.renderer).toBe('raster');
		expect(presentation.image).toBeDefined();
		expect(presentation.image?.src).toEqual(sealImage);
		expect(presentation.skin).toBe('premium-rose');
	});

	it('falls back predictably to wax-organic when raster image input is missing or empty', () => {
		const presentation = resolveSealPresentation({
			sealStyle: 'wax',
			sealVariant: 'premium-rose',
			sealImage: undefined,
		});

		expect(presentation.renderer).toBe('wax-organic');
		expect(presentation.image).toBeUndefined();
	});
});
