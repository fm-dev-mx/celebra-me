import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

describe('mapNestedToDraftContent', () => {
	it('preserves hero backgroundImage when present', () => {
		const input = {
			hero: {
				name: 'María',
				backgroundImage: { type: 'uploaded', assetId: VALID_UUID },
				backgroundImageMobile: {
					type: 'external',
					src: 'https://cdn.test/mobile-bg.webp',
				},
				portrait: { type: 'internal', key: 'portrait' },
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.hero?.name).toBe('María');
		expect(result.hero?.backgroundImage).toEqual({ type: 'uploaded', assetId: VALID_UUID });
		expect(result.hero?.backgroundImageMobile).toEqual({
			type: 'external',
			src: 'https://cdn.test/mobile-bg.webp',
		});
		expect(result.hero?.portrait).toEqual({ type: 'internal', key: 'portrait' });
	});

	it('preserves family featuredImage when present', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				featuredImage: { type: 'uploaded', assetId: VALID_UUID },
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.family?.fatherName).toBe('Juan');
		expect(result.family?.featuredImage).toEqual({ type: 'uploaded', assetId: VALID_UUID });
	});

	it('preserves venue image when present in ceremony', () => {
		const input = {
			location: {
				ceremony: {
					venueName: 'Iglesia',
					image: { type: 'uploaded', assetId: VALID_UUID },
				},
				reception: {
					venueName: 'Salón',
					image: { type: 'internal', key: 'reception' },
				},
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.location?.ceremony?.image).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID,
		});
		expect(result.location?.reception?.image).toEqual({ type: 'internal', key: 'reception' });
	});

	it('preserves location intro copy and indications heading when present', () => {
		const input = {
			location: {
				introEyebrow: 'EL CAMINO AL PALACIO',
				introHeading: 'Ubicación',
				introLede: 'Guarda la ruta y llega con calma.',
				indicationsHeading: 'Indicaciones importantes',
				ceremony: { venueName: 'Iglesia' },
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location).toMatchObject({
			introEyebrow: 'EL CAMINO AL PALACIO',
			introHeading: 'Ubicación',
			introLede: 'Guarda la ruta y llega con calma.',
			indicationsHeading: 'Indicaciones importantes',
		});
	});

	it('preserves countdown copy when present', () => {
		const input = {
			countdown: {
				title: 'Ya casi',
				subtitlePrefix: 'Será el',
				footerText: 'Nos vemos pronto',
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.countdown).toEqual({
			title: 'Ya casi',
			subtitlePrefix: 'Será el',
			footerText: 'Nos vemos pronto',
		});
	});

	it('preserves thankYou image when present', () => {
		const input = {
			thankYou: {
				message: 'Gracias',
				image: { type: 'external', src: 'https://cdn.test/photo.jpg' },
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.thankYou?.message).toBe('Gracias');
		expect(result.thankYou?.image).toEqual({
			type: 'external',
			src: 'https://cdn.test/photo.jpg',
		});
	});

	it('preserves gallery items with focal points and uploaded refs', () => {
		const input = {
			gallery: {
				title: 'Galería',
				items: [
					{
						image: { type: 'uploaded', assetId: VALID_UUID },
						caption: 'Foto 1',
						focalPoint: 'center center',
						focalPointMobile: 'top center',
					},
					{
						image: { type: 'internal', key: 'gallery01' },
						caption: 'Foto 2',
						focalPoint: '50% 50%',
					},
				],
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.gallery?.items).toHaveLength(2);
		expect(result.gallery?.items[0]).toMatchObject({
			caption: 'Foto 1',
			focalPoint: 'center center',
			focalPointMobile: 'top center',
		});
		expect(result.gallery?.items[0].image).toEqual({
			type: 'uploaded',
			assetId: VALID_UUID,
		});
		expect(result.gallery?.items[1].image).toEqual({ type: 'internal', key: 'gallery01' });
	});

	it('does not add image fields when absent from input', () => {
		const input = {
			hero: { name: 'María' },
			family: { parents: { father: 'Juan' } },
			thankYou: { message: 'Gracias' },
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.hero?.backgroundImage).toBeUndefined();
		expect(result.hero?.backgroundImageMobile).toBeUndefined();
		expect(result.hero?.portrait).toBeUndefined();
		expect(result.family?.featuredImage).toBeUndefined();
		expect(result.thankYou?.image).toBeUndefined();
	});

	it('does not copy desktop hero background into the mobile field', () => {
		const input = {
			hero: {
				name: 'María',
				backgroundImage: { type: 'uploaded', assetId: VALID_UUID },
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.hero?.backgroundImage).toEqual({ type: 'uploaded', assetId: VALID_UUID });
		expect(result.hero?.backgroundImageMobile).toBeUndefined();
	});
});
