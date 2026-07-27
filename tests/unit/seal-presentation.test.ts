import {
	resolveSealPresentation,
	SEAL_ICON_MAP,
} from '@/lib/invitation/reveal-card';

describe('resolveSealPresentation', () => {
	it('prefers raster image renderer when sealImage is provided', () => {
		const mockImage = {
			src: '/assets/rose-wax-seal.webp',
			width: 200,
			height: 200,
			alt: 'Sello',
		};
		const result = resolveSealPresentation({
			sealIcon: 'wax-monogram',
			sealImage: mockImage,
			sealVariant: 'premium-rose',
			sealInitials: 'L·G',
		});

		expect(result).toEqual({
			renderer: 'raster',
			image: mockImage,
			skin: 'premium-rose',
			initials: 'L·G',
		});
	});

	it('resolves clean raster seal configuration without monogram fields', () => {
		const mockImage = {
			src: '/assets/rose-wax-seal.webp',
			width: 200,
			height: 200,
			alt: 'Sello',
		};
		const result = resolveSealPresentation({
			sealImage: mockImage,
			sealVariant: 'premium-rose',
		});

		expect(result).toEqual({
			renderer: 'raster',
			image: mockImage,
			skin: 'premium-rose',
			initials: undefined,
		});
	});

	it('handles ImageMetadata object sources correctly in sealImage', () => {
		const mockMetaImage = {
			src: {
				src: '/_astro/rose-wax-seal.webp',
				width: 200,
				height: 200,
				format: 'webp' as const,
			},
			alt: 'Sello',
		};
		const result = resolveSealPresentation({
			sealIcon: 'monogram',
			sealImage: mockMetaImage,
		});

		expect(result.renderer).toBe('raster');
		expect(result.image).toEqual(mockMetaImage);
	});

	it('resolves explicit structural selection wax-medallion', () => {
		const result = resolveSealPresentation({
			sealIcon: 'wax-medallion',
			sealInitials: 'M·S',
			sealColor: 'roseGold',
		});

		expect(result).toEqual({
			renderer: 'wax-medallion',
			skin: 'roseGold',
			initials: 'M·S',
			icon: 'wax-medallion',
		});
	});

	it('uses sealIcon as the canonical structural selector and sealVariant as skin', () => {
		const result = resolveSealPresentation({
			sealIcon: 'wax-medallion',
			sealVariant: 'premium-rose',
			sealInitials: 'A·B',
		});

		expect(result).toEqual({
			renderer: 'wax-medallion',
			skin: 'premium-rose',
			initials: 'A·B',
			icon: 'wax-medallion',
		});
	});

	it('resolves explicit structural selection wax-organic', () => {
		const result = resolveSealPresentation({
			sealIcon: 'wax-organic',
			sealInitials: 'X·Y',
		});

		expect(result).toEqual({
			renderer: 'wax-organic',
			skin: undefined,
			initials: 'X·Y',
			icon: 'wax-organic',
		});
	});

	it('maps legacy wax-monogram icon contract to wax-organic renderer', () => {
		const result = resolveSealPresentation({
			sealIcon: 'wax-monogram',
			sealInitials: 'R·C',
			sealColor: 'champagne',
		});

		expect(result).toEqual({
			renderer: 'wax-organic',
			skin: 'champagne',
			initials: 'R·C',
			icon: 'wax-monogram',
		});
	});

	it('maps legacy monogram icon contract to monogram renderer', () => {
		const result = resolveSealPresentation({
			sealIcon: 'monogram',
			sealInitials: 'L·L',
		});

		expect(result).toEqual({
			renderer: 'monogram',
			skin: undefined,
			initials: 'L·L',
			icon: 'monogram',
		});
	});

	it('maps vector icons (boot, heart, flower, special-edition) to vector-icon renderer', () => {
		expect(resolveSealPresentation({ sealIcon: 'flower' })).toEqual({
			renderer: 'vector-icon',
			icon: 'flower',
			skin: undefined,
			initials: undefined,
		});

		expect(resolveSealPresentation({ sealIcon: 'boot' })).toEqual({
			renderer: 'vector-icon',
			icon: 'boot',
			skin: undefined,
			initials: undefined,
		});

		expect(resolveSealPresentation({ sealStyle: 'ribbon' })).toEqual({
			renderer: 'vector-icon',
			icon: 'special-edition',
			skin: undefined,
			initials: undefined,
		});
	});

	it('falls back to default wax-organic renderer when no configuration is specified', () => {
		const result = resolveSealPresentation({});
		expect(result).toEqual({
			renderer: 'wax-organic',
			skin: undefined,
			initials: undefined,
			icon: 'wax-organic',
		});
	});
});

describe('parametric seal icon checks', () => {
	it('identifies parametric seal icons via resolveSealPresentation renderer', () => {
		// Parametric icons resolve to a renderer that supports initials
		const parametric = ['monogram', 'wax-organic', 'wax-medallion'];
		const nonParametric = ['vector-icon', 'raster'];

		expect(parametric).toContain(
			resolveSealPresentation({ sealIcon: 'wax-organic' }).renderer,
		);
		expect(parametric).toContain(
			resolveSealPresentation({ sealIcon: 'wax-medallion' }).renderer,
		);
		expect(parametric).toContain(
			resolveSealPresentation({ sealIcon: 'wax-monogram' }).renderer,
		);
		expect(parametric).toContain(
			resolveSealPresentation({ sealIcon: 'monogram' }).renderer,
		);
		expect(nonParametric).toContain(
			resolveSealPresentation({ sealIcon: 'flower' }).renderer,
		);
	});

	it('maps seal icons to components in SEAL_ICON_MAP', () => {
		expect(SEAL_ICON_MAP['wax-organic']).toBe('WaxMonogramSeal');
		expect(SEAL_ICON_MAP['wax-medallion']).toBe('WaxMonogramSeal');
		expect(SEAL_ICON_MAP['wax-monogram']).toBe('WaxMonogramSeal');
		expect(SEAL_ICON_MAP.monogram).toBe('MonogramSeal');
	});
});
