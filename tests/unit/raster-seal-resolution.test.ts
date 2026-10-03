import fs from 'node:fs';
import path from 'node:path';
import { assets as leahLexaAssets } from '@/assets/images/events/leah-lexa-baby-shower/index';
import { resolveSealPresentation } from '@/lib/invitation/reveal-card';

describe('Raster Seal Resolution Contract', () => {
	it('resolves the correct raster seal asset for leah-lexa-baby-shower', () => {
		expect(leahLexaAssets.sealImage).toBeDefined();
		const filePath = path.resolve(
			'src/assets/images/events/leah-lexa-baby-shower/rose-wax-seal-ll.png',
		);
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it('maps Leah Lexa raster input to normalized raster seal presentation', () => {
		const asset = { src: leahLexaAssets.sealImage, alt: 'Sello' };
		const presentation = resolveSealPresentation({
			sealStyle: 'wax',
			sealVariant: 'premium-rose',
			sealImage: asset,
		});

		expect(presentation.renderer).toBe('raster');
		expect(presentation.image).toBeDefined();
		expect(presentation.image?.src).toEqual(leahLexaAssets.sealImage);
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
