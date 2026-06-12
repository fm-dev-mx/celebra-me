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
});
