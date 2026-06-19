import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { mergePublishedWithDraft } from '@/lib/intake/services/merge-content.service';

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

	it('preserves coordinates from published ceremony/reception in draft', () => {
		const input = {
			location: {
				ceremony: {
					venueName: 'Iglesia',
					coordinates: { lat: 19.4326, lng: -99.1332 },
				},
				reception: {
					venueName: 'Salon',
					coordinates: { lat: 20.5, lng: -100.3 },
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.ceremony?.coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
		expect(result.location?.reception?.coordinates).toEqual({ lat: 20.5, lng: -100.3 });
	});

	it('preserves coordinates from published venues array in draft', () => {
		const input = {
			location: {
				venues: [
					{
						id: 'v1',
						type: 'ceremony',
						label: 'Ceremonia',
						venueName: 'Iglesia',
						address: 'Calle 1',
						date: '2026-01-01',
						time: '10:00',
						coordinates: { lat: 19.4326, lng: -99.1332 },
						isVisible: true,
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		const venue = result.location?.venues?.[0] as Record<string, unknown> | undefined;
		expect(venue?.coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
	});

	it('maps published mapUrl and coordinates together in draft', () => {
		const input = {
			location: {
				ceremony: {
					venueName: 'Iglesia',
					mapUrl: 'https://maps.google.com/?q=19.4326,-99.1332',
					coordinates: { lat: 19.4326, lng: -99.1332 },
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.ceremony?.mapUrl).toBe(
			'https://maps.google.com/?q=19.4326,-99.1332',
		);
		expect(result.location?.ceremony?.coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
	});

	it.each([
		{
			kind: 'ceremony venue',
			input: {
				location: {
					ceremony: {
						venueName: 'Iglesia',
						address: 'Calle 1',
						mapUrl: 'https://maps.example.com/map',
						googleMapsUrl: 'https://maps.google.com/?q=test',
						appleMapsUrl: 'https://maps.apple.com/?q=test',
						wazeUrl: 'https://waze.com/ul?q=test',
					},
				},
			},
			assertions: (result: ReturnType<typeof mapNestedToDraftContent>) => {
				expect(result.location?.ceremony?.mapUrl).toBe('https://maps.example.com/map');
				expect(result.location?.ceremony?.googleMapsUrl).toBe(
					'https://maps.google.com/?q=test',
				);
				expect(result.location?.ceremony?.appleMapsUrl).toBe(
					'https://maps.apple.com/?q=test',
				);
				expect(result.location?.ceremony?.wazeUrl).toBe('https://waze.com/ul?q=test');
			},
		},
		{
			kind: 'venues array',
			input: {
				location: {
					introHeading: 'Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'ceremony',
							label: 'Ceremonia',
							venueName: 'Iglesia',
							address: 'Calle 1',
							date: '2026-01-01',
							time: '10:00',
							mapUrl: 'https://maps.example.com/map',
							googleMapsUrl: 'https://maps.google.com/?q=test',
							appleMapsUrl: 'https://maps.apple.com/?q=test',
							wazeUrl: 'https://waze.com/ul?q=test',
							isVisible: true,
						},
					],
				},
			},
			assertions: (result: ReturnType<typeof mapNestedToDraftContent>) => {
				expect(result.location?.venues).toHaveLength(1);
				expect(result.location?.venues?.[0]?.mapUrl).toBe('https://maps.example.com/map');
				expect(result.location?.venues?.[0]?.googleMapsUrl).toBe(
					'https://maps.google.com/?q=test',
				);
				expect(result.location?.venues?.[0]?.appleMapsUrl).toBe(
					'https://maps.apple.com/?q=test',
				);
				expect(result.location?.venues?.[0]?.wazeUrl).toBe('https://waze.com/ul?q=test');
			},
		},
	])('maps published per-platform map URLs to draft $kind', ({ input, assertions }) => {
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		assertions(result);
	});

	it('maps published venues array to draft format', () => {
		const input = {
			location: {
				introHeading: 'Ubicaciones',
				venues: [
					{
						id: 'v1',
						type: 'ceremony',
						label: 'Ceremonia',
						venueName: 'Iglesia A',
						address: 'Calle 1',
						date: '2026-01-01',
						time: '10:00',
						isVisible: true,
					},
					{
						id: 'v2',
						type: 'custom',
						label: 'Cena al aire libre',
						venueName: 'Jardín',
						address: 'Calle 2',
						date: '2026-01-01',
						time: '20:00',
						isVisible: false,
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.venues).toHaveLength(2);
		expect(result.location?.venues?.[0]?.id).toBe('v1');
		expect(result.location?.venues?.[0]?.venueName).toBe('Iglesia A');
		expect(result.location?.venues?.[0]?.type).toBe('ceremony');
		expect(result.location?.venues?.[1]?.type).toBe('custom');
		expect(result.location?.venues?.[1]?.label).toBe('Cena al aire libre');
		expect(result.location?.venues?.[1]?.isVisible).toBe(false);
	});

	it('maps legacy ceremony/reception when venues is absent', () => {
		const input = {
			location: {
				introHeading: 'Ubicaciones',
				ceremony: {
					venueName: 'Iglesia Legacy',
					address: 'Calle L',
					date: '2026-01-01',
					time: '10:00',
				},
				reception: {
					venueName: 'Salón Legacy',
					address: 'Calle R',
					date: '2026-01-01',
					time: '20:00',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.ceremony?.venueName).toBe('Iglesia Legacy');
		expect(result.location?.reception?.venueName).toBe('Salón Legacy');
		expect(result.location?.venues).toBeUndefined();
	});

	it('preserves existing venue IDs when present (does not regenerate)', () => {
		const input = {
			location: {
				introHeading: 'Ubicaciones',
				venues: [
					{
						id: 'stable-id-1',
						type: 'ceremony',
						venueName: 'Iglesia',
						address: 'Calle 1',
						date: '2026-01-01',
						time: '10:00',
					},
					{
						id: 'stable-id-2',
						type: 'reception',
						venueName: 'Salón',
						address: 'Calle 2',
						date: '2026-01-01',
						time: '20:00',
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.venues?.[0]?.id).toBe('stable-id-1');
		expect(result.location?.venues?.[1]?.id).toBe('stable-id-2');
	});

	it('generates deterministic fallback IDs for venues without ID', () => {
		const input = {
			location: {
				introHeading: 'Ubicaciones',
				venues: [
					{
						type: 'ceremony',
						venueName: 'Iglesia',
						address: 'Calle 1',
						date: '2026-01-01',
						time: '10:00',
					},
					{
						type: 'reception',
						venueName: 'Salón',
						address: 'Calle 2',
						date: '2026-01-01',
						time: '20:00',
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.venues?.[0]?.id).toBeDefined();
		expect(result.location?.venues?.[1]?.id).toBeDefined();
		expect(result.location?.venues?.[0]?.id).not.toBe(result.location?.venues?.[1]?.id);
	});

	it('preserves countdown copy when present', () => {
		const input = {
			countdown: {
				title: 'Ya casi',
				footerText: 'Nos vemos pronto',
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.countdown).toEqual({
			title: 'Ya casi',
			footerText: 'Nos vemos pronto',
		});
	});

	it('preserves eventTiming from published content', () => {
		const input = {
			eventTiming: {
				localDateTime: '2026-08-01T20:00',
				timeZone: 'America/Mazatlan',
				startsAtUtc: '2026-08-02T03:00:00.000Z',
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.eventTiming).toEqual({
			localDateTime: '2026-08-01T20:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-08-02T03:00:00.000Z',
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

	it('preserves thankYou overlay fields (focalPoint, overlayAnchor, overlaySafeArea)', () => {
		const input = {
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'Ana Sofia',
				image: { type: 'internal', key: 'thankYouPortrait' },
				focalPoint: '50% 40%',
				overlayAnchor: 'bottom',
				overlaySafeArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.thankYou?.focalPoint).toBe('50% 40%');
		expect(result.thankYou?.overlayAnchor).toBe('bottom');
		expect(result.thankYou?.overlaySafeArea).toEqual({
			x: 0.1,
			y: 0.1,
			width: 0.8,
			height: 0.8,
		});
		expect(result.thankYou?.message).toBe('Gracias a todos');
	});

	it('omits thankYou overlay fields when absent from published content', () => {
		const input = {
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
			},
		};
		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);
		expect(result.thankYou?.focalPoint).toBeUndefined();
		expect(result.thankYou?.overlayAnchor).toBeUndefined();
		expect(result.thankYou?.overlaySafeArea).toBeUndefined();
	});
});

describe('mergePublishedWithDraft', () => {
	it('preserves thankYou overlay fields when draft is empty and published has them', () => {
		const published = {
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				image: { type: 'internal', key: 'thankYouPortrait' },
				focalPoint: '50% 40%',
				overlayAnchor: 'bottom',
				overlaySafeArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
			},
		};
		const draft = {};

		const result = mergePublishedWithDraft(
			published as unknown as Record<string, unknown>,
			draft,
		);

		expect(result.content.thankYou).toMatchObject({
			message: 'Gracias',
			focalPoint: '50% 40%',
			overlayAnchor: 'bottom',
			overlaySafeArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
		});
	});

	it('preserves thankYou overlay fields from published when draft has text but no overlay fields', () => {
		const published = {
			thankYou: {
				message: 'Mensaje publicado',
				closingName: 'Familia Publicada',
				focalPoint: 'center top',
				overlayAnchor: 'right',
				overlaySafeArea: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
			},
		};
		const draft = {
			thankYou: {
				message: 'Mensaje editado',
			},
		};

		const result = mergePublishedWithDraft(
			published as unknown as Record<string, unknown>,
			draft,
		);

		// Draft message wins
		expect(result.content.thankYou?.message).toBe('Mensaje editado');
		// Published overlay fields fill in since draft lacks them
		expect(result.content.thankYou?.focalPoint).toBe('center top');
		expect(result.content.thankYou?.overlayAnchor).toBe('right');
		expect(result.content.thankYou?.overlaySafeArea).toEqual({
			x: 0.2,
			y: 0.2,
			width: 0.6,
			height: 0.6,
		});
	});

	it('draft overlay values override published overlay values', () => {
		const published = {
			thankYou: {
				message: 'Publicado',
				focalPoint: 'center center',
			},
		};
		const draft = {
			thankYou: {
				message: 'Editado',
				focalPoint: '50% 30%',
			},
		};

		const result = mergePublishedWithDraft(
			published as unknown as Record<string, unknown>,
			draft,
		);

		expect(result.content.thankYou?.message).toBe('Editado');
		expect(result.content.thankYou?.focalPoint).toBe('50% 30%');
	});

	it.each([
		{
			name: 'strips godparents when merge produces non-empty godparentGroups',
			published: {
				family: {
					parents: { father: 'Juan', mother: 'Maria' },
					godparentGroups: [
						{
							honoreeName: 'Luna Yamileth',
							label: 'Luna',
							godparents: [{ name: 'Emiliano Pérez Rodríguez' }],
						},
					],
				},
			},
			draft: {
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
					godparents: 'Pedro — Padrino',
				},
			},
			assertions: (family: Record<string, unknown> | undefined) => {
				expect(family).toHaveProperty('godparentGroups');
				expect(family).not.toHaveProperty('godparents');
			},
		},
		{
			name: 'strips empty godparentGroups when merge produces godparentGroups as empty array',
			published: {
				family: {
					parents: { father: 'Juan', mother: 'Maria' },
					godparentGroups: [],
					godparents: [],
				},
			},
			draft: {
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
					godparents: 'Pedro — Padrino',
				},
			},
			assertions: (family: Record<string, unknown> | undefined) => {
				expect(family).not.toHaveProperty('godparentGroups');
			},
		},
		{
			name: 'preserves godparents when merge has no godparentGroups',
			published: {
				family: {
					parents: { father: 'Juan', mother: 'Maria' },
				},
			},
			draft: {
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
					godparents: 'Pedro — Padrino\nLuisa — Madrina',
				},
			},
			assertions: (family: Record<string, unknown> | undefined) => {
				expect(family?.godparents).toBe('Pedro — Padrino\nLuisa — Madrina');
				expect(family).not.toHaveProperty('godparentGroups');
			},
		},
	])('$name', ({ published, draft, assertions }) => {
		const result = mergePublishedWithDraft(
			published as unknown as Record<string, unknown>,
			draft,
		);

		expect(result.content.family).toBeDefined();
		assertions(result.content.family);
	});
});

describe('mapNestedToDraftContent', () => {
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

	it('reads family labels from published labels object into flat draft fields', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				labels: {
					sectionSubtitle: 'Mi Familia',
					sectionTitle: 'Los que hacen mi vida completa',
					parentsTitle: 'Con la bendición de',
					godparentsTitle: 'Padrinos',
					sectionMessage: 'Mensaje desde labels',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family).toMatchObject({
			sectionSubtitle: 'Mi Familia',
			sectionTitle: 'Los que hacen mi vida completa',
			parentsTitle: 'Con la bendición de',
			godparentsTitle: 'Padrinos',
			sectionMessage: 'Mensaje desde labels',
		});
	});

	it('falls back to root-level sectionMessage when labels.sectionMessage is absent', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				sectionMessage: 'Mensaje en raíz',
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.sectionMessage).toBe('Mensaje en raíz');
	});

	it('reads family groups from published format into flat draft format', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				groups: [
					{
						title: 'Padres de la Novia',
						items: [{ name: 'Roberto' }, { name: 'Ana' }],
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.groups).toEqual([
			{ title: 'Padres de la Novia', names: 'Roberto\nAna' },
		]);
	});

	it('reads grouped godparents from published format into draft format', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				godparentGroups: [
					{
						honoreeName: 'Luna Yamileth',
						label: 'De Luna',
						godparents: [{ name: 'Emiliano Pérez Rodríguez', role: 'Padrino' }],
					},
					{
						honoreeName: 'Estrella Abigail',
						label: 'De Estrella',
						godparents: [{ name: 'María Guadalupe Villa Ponce', role: 'Madrina' }],
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.godparentGroups).toEqual([
			{
				honoreeName: 'Luna Yamileth',
				label: 'De Luna',
				names: 'Emiliano Pérez Rodríguez — Padrino',
			},
			{
				honoreeName: 'Estrella Abigail',
				label: 'De Estrella',
				names: 'María Guadalupe Villa Ponce — Madrina',
			},
		]);
	});

	it('reads family visible flag from published content', () => {
		const input = {
			family: {
				parents: { father: 'Juan' },
				visible: false,
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.visible).toBe(false);
	});

	it('reads parentsOrder father-first from published parents object', () => {
		const input = {
			family: {
				parents: {
					father: 'Fernando Valenzuela',
					mother: 'Maria Duarte',
					parentsOrder: 'father-first',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.parentsOrder).toBe('father-first');
		expect(result.family?.fatherName).toBe('Fernando Valenzuela');
		expect(result.family?.motherName).toBe('Maria Duarte');
	});

	it('reads parentsOrder mother-first from published parents object', () => {
		const input = {
			family: {
				parents: {
					father: 'Fernando Valenzuela',
					mother: 'Maria Duarte',
					parentsOrder: 'mother-first',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.parentsOrder).toBe('mother-first');
	});

	it('omits parentsOrder when not present in published content (backward compatibility)', () => {
		const input = {
			family: {
				parents: {
					father: 'Fernando Valenzuela',
					mother: 'Maria Duarte',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.family?.parentsOrder).toBeUndefined();
	});

	it('does not normalize legacy itinerary icon fields from published content', () => {
		const input = {
			itinerary: {
				title: 'Programa',
				items: [
					{ icon: 'church', label: 'Misa', time: '18:00' },
					{ icon: 'map-location', label: 'Recepción', time: '20:00' },
					{ iconName: 'Dinner', icon: 'dinner', label: 'Cena', time: '22:00' },
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.itinerary?.items).toEqual([
			{ icon: 'church', label: 'Misa', time: '18:00' },
			{ icon: 'map-location', label: 'Recepción', time: '20:00' },
			{ iconName: 'Dinner', icon: 'dinner', label: 'Cena', time: '22:00' },
		]);
	});

	it('normalizes 12-hour itinerary times to 24-hour format', () => {
		const input = {
			itinerary: {
				title: 'Programa',
				items: [
					{ iconName: 'Church', label: 'Misa', time: '6:00 PM' },
					{ iconName: 'Reception', label: 'Recepción', time: '8:00 PM' },
					{ iconName: 'Dinner', label: 'Cena', time: '10:00 PM' },
					{ iconName: 'Party', label: 'Cierre', time: '1:00 AM' },
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.itinerary?.items).toEqual([
			{ iconName: 'Church', label: 'Misa', time: '18:00' },
			{ iconName: 'Reception', label: 'Recepción', time: '20:00' },
			{ iconName: 'Dinner', label: 'Cena', time: '22:00' },
			{ iconName: 'Party', label: 'Cierre', time: '01:00' },
		]);
	});

	it('normalizes 12-hour venue times to 24-hour format', () => {
		const input = {
			location: {
				ceremony: {
					venueName: 'Iglesia',
					address: 'Calle Principal',
					city: 'Ciudad',
					date: '2026-06-15',
					time: '10:00 AM',
				},
				reception: {
					venueName: 'Salón',
					address: 'Av. Principal',
					city: 'Ciudad',
					date: '2026-06-15',
					time: '12:00 PM',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.location?.ceremony?.time).toBe('10:00');
		expect(result.location?.reception?.time).toBe('12:00');
	});

	it('preserves already-normalized 24-hour times unchanged', () => {
		const input = {
			itinerary: {
				title: 'Programa',
				items: [
					{ iconName: 'Church', label: 'Misa', time: '18:00' },
					{ iconName: 'Reception', label: 'Recepción', time: '20:00' },
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.itinerary?.items).toEqual([
			{ iconName: 'Church', label: 'Misa', time: '18:00' },
			{ iconName: 'Reception', label: 'Recepción', time: '20:00' },
		]);
	});

	it('preserves invalid/unparseable times as-is when normalization fails', () => {
		const input = {
			itinerary: {
				title: 'Programa',
				items: [
					{ iconName: 'Church', label: 'Misa', time: '99:00' },
					{ iconName: 'Reception', label: 'Recepción', time: 'invalid' },
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.itinerary?.items).toEqual([
			{ iconName: 'Church', label: 'Misa', time: '99:00' },
			{ iconName: 'Reception', label: 'Recepción', time: 'invalid' },
		]);
	});

	it('preserves RSVP responseMessages from published content', () => {
		const input = {
			rsvp: {
				title: 'RSVP',
				confirmationMessage: 'Gracias',
				responseMessages: {
					confirmed: { title: '¡Gracias {guestName}!', subtitle: 'Registrado.' },
					declined: { title: 'Qué pena.', subtitle: 'Avisarnos.' },
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.rsvp?.responseMessages).toEqual({
			confirmed: { title: '¡Gracias {guestName}!', subtitle: 'Registrado.' },
			declined: { title: 'Qué pena.', subtitle: 'Avisarnos.' },
		});
	});

	it('preserves music autoPlay from published content', () => {
		const input = {
			music: { url: 'https://example.com/song.mp3', title: 'Canción', autoPlay: true },
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.music?.autoPlay).toBe(true);
	});

	it('preserves envelope sealInitials from published content into draft shape', () => {
		const input = {
			envelope: { disabled: false, sealInitials: 'A·L', sealStyle: 'wax' },
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.envelope?.sealInitials).toBe('A·L');
		expect(result.envelope?.disabled).toBe(false);
	});

	it('omits envelope sealInitials when absent from published content', () => {
		const input = {
			envelope: { disabled: true, sealStyle: 'wax' },
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.envelope?.sealInitials).toBeUndefined();
		expect(result.envelope?.disabled).toBe(true);
	});

	it('handles empty envelope without crashing (regression: for-loop inside if)', () => {
		const input = { envelope: {} };

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.envelope).toBeUndefined();
	});

	it('handles missing envelope without crashing', () => {
		const input = {};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		expect(result.envelope).toBeUndefined();
	});

	it('does not set venue URL keys when published venue ceremony URLs are absent', () => {
		const input = {
			location: {
				ceremony: {
					venueName: 'Iglesia',
				},
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		const ceremony = result.location?.ceremony as Record<string, unknown> | undefined;
		for (const field of ['mapUrl', 'googleMapsUrl', 'appleMapsUrl', 'wazeUrl'] as const) {
			expect(ceremony).not.toHaveProperty(field);
		}
	});

	it('does not set venue URL keys when published venues array URLs are absent', () => {
		const input = {
			location: {
				venues: [
					{
						id: 'v1',
						type: 'ceremony',
						label: 'Ceremonia',
						venueName: 'Iglesia',
						isVisible: true,
					},
				],
			},
		};

		const result = mapNestedToDraftContent(input as unknown as Record<string, unknown>);

		const venue = result.location?.venues?.[0] as Record<string, unknown> | undefined;
		for (const field of ['mapUrl', 'googleMapsUrl', 'appleMapsUrl', 'wazeUrl'] as const) {
			expect(venue).not.toHaveProperty(field);
		}
	});
});

describe('mergePublishedWithDraft — interlude preservation', () => {
	it('preserves interludes from published content when no draft exists (client invitation path)', () => {
		const published = {
			interludes: [
				{
					image: { type: 'internal', key: 'gallery01' },
					afterSection: 'quote',
					height: 'medium',
					alt: 'Test interlude',
				},
			],
		};
		const draft = {};

		const result = mergePublishedWithDraft(published, draft);

		expect(result.content.interludes).toEqual(published.interludes);
	});

	it('preserves interludes from published when draft has other sections but no interlude key', () => {
		const published = {
			interludes: [
				{
					image: { type: 'internal', key: 'gallery01' },
					afterSection: 'quote',
					height: 'medium',
				},
			],
		};
		const draft = {
			title: 'Test',
			hero: { name: 'Test' },
		};

		const result = mergePublishedWithDraft(published, draft);

		expect(result.content.interludes).toBeDefined();
		expect(result.content.interludes).toHaveLength(1);
	});

	it('uses draft interludes over published interludes', () => {
		const published = {
			interludes: [
				{
					image: { type: 'internal', key: 'published-interlude' },
					afterSection: 'quote',
					height: 'screen',
				},
			],
		};
		const draft = {
			interludes: [
				{
					image: { type: 'internal', key: 'draft-interlude' },
					afterSection: 'family',
					height: 'medium',
				},
			],
		};

		const result = mergePublishedWithDraft(published, draft);

		expect(result.content.interludes).toEqual(draft.interludes);
	});

	it('does not inject demo interludes for a client invitation without allowDemoFallback', () => {
		const published = {};
		const draft = {};
		const demo = {
			interludes: [
				{
					image: { type: 'internal', key: 'demo-interlude' },
					afterSection: 'quote',
					height: 'screen',
				},
			],
		};

		const result = mergePublishedWithDraft(published, draft, {
			demoContent: demo,
			allowDemoFallback: false,
		});

		expect(result.content.interludes).toBeUndefined();
	});

	it('injects demo interludes only when allowDemoFallback is true', () => {
		const published = {};
		const draft = {};
		const demo = {
			interludes: [
				{
					image: { type: 'internal', key: 'demo-interlude' },
					afterSection: 'quote',
					height: 'screen',
				},
			],
		};

		const result = mergePublishedWithDraft(published, draft, {
			demoContent: demo,
			allowDemoFallback: true,
		});

		expect(result.content.interludes).toEqual(demo.interludes);
	});

	it('does not inject interludes when absent from both published and draft', () => {
		const published = {};
		const draft = {};

		const result = mergePublishedWithDraft(published, draft);

		expect(result.content.interludes).toBeUndefined();
	});

	it('injects an empty interlude array when explicitly set in published content', () => {
		const published = {
			interludes: [],
		};
		const draft = {};

		const result = mergePublishedWithDraft(published, draft);

		expect(result.content.interludes).toEqual([]);
	});
});
