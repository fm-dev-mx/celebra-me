import { InvitationEditorSectionSchemas } from '@/lib/intake/schemas/invitation-editor.schema';
import { dateLocationsBlockSchema } from '@/lib/intake/schemas/intake-block.schema';

const DESKTOP_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOBILE_ASSET_ID = '550e8400-e29b-41d4-a716-446655440002';
const THANK_YOU_ASSET_ID = '550e8400-e29b-41d4-a716-446655440003';

describe('InvitationEditorSectionSchemas.main', () => {
	it('preserves independent desktop and mobile hero image refs', () => {
		const result = InvitationEditorSectionSchemas.main.parse({
			title: 'XV Ana',
			description: 'Celebremos juntos',
			hero: {
				name: 'Ana',
				backgroundImage: { type: 'uploaded', assetId: DESKTOP_ASSET_ID },
				backgroundImageMobile: { type: 'uploaded', assetId: MOBILE_ASSET_ID },
			},
		});

		expect(result.hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: DESKTOP_ASSET_ID,
		});
		expect(result.hero.backgroundImageMobile).toEqual({
			type: 'uploaded',
			assetId: MOBILE_ASSET_ID,
		});
	});

	it('does not create a mobile hero image ref when it is absent', () => {
		const result = InvitationEditorSectionSchemas.main.parse({
			title: 'XV Ana',
			description: 'Celebremos juntos',
			hero: {
				name: 'Ana',
				backgroundImage: { type: 'uploaded', assetId: DESKTOP_ASSET_ID },
			},
		});

		expect(result.hero.backgroundImage).toEqual({
			type: 'uploaded',
			assetId: DESKTOP_ASSET_ID,
		});
		expect(result.hero).not.toHaveProperty('backgroundImageMobile');
	});
});

describe('InvitationEditorSectionSchemas.messages', () => {
	it('preserves thankYou.image when present (uploaded ref)', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			quote: { text: 'Una frase', author: 'Autor' },
			thankYou: {
				message: 'Gracias a todos',
				closingName: 'Ana Sofia',
				image: { type: 'uploaded', assetId: THANK_YOU_ASSET_ID },
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'Ana Sofia',
			image: { type: 'uploaded', assetId: THANK_YOU_ASSET_ID },
		});
	});

	it('preserves thankYou.image as an internal asset ref', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				image: { type: 'internal', key: 'thankYouPortrait' },
			},
		});

		expect(result.thankYou?.image).toEqual({
			type: 'internal',
			key: 'thankYouPortrait',
		});
	});

	it('allows thankYou without image', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias',
			closingName: 'Familia',
		});
		expect(result.thankYou).not.toHaveProperty('image');
	});

	it('allows empty messages object', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({});

		expect(result.quote).toBeUndefined();
		expect(result.thankYou).toBeUndefined();
	});

	it('preserves thankYou overlay fields (focalPoint, overlayAnchor, overlaySafeArea)', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			quote: { text: 'Frase', author: 'Autor' },
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
				focalPoint: '50% 40%',
				overlayAnchor: 'bottom',
				overlaySafeArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
			},
		});

		expect(result.thankYou?.focalPoint).toBe('50% 40%');
		expect(result.thankYou?.overlayAnchor).toBe('bottom');
		expect(result.thankYou?.overlaySafeArea).toEqual({
			x: 0.1,
			y: 0.1,
			width: 0.8,
			height: 0.8,
		});
	});

	it('allows thankYou overlay fields to be absent', () => {
		const result = InvitationEditorSectionSchemas.messages.parse({
			thankYou: {
				message: 'Gracias',
				closingName: 'Familia',
			},
		});

		expect(result.thankYou?.message).toBe('Gracias');
		expect(result.thankYou?.focalPoint).toBeUndefined();
		expect(result.thankYou?.overlayAnchor).toBeUndefined();
		expect(result.thankYou?.overlaySafeArea).toBeUndefined();
	});
});

describe('InvitationEditorSectionSchemas.family', () => {
	it('preserves grouped godparents when saving the family section', () => {
		const result = InvitationEditorSectionSchemas.family.parse({
			fatherName: 'Juan',
			godparentGroups: [
				{
					honoreeName: 'Luna Yamileth',
					label: 'De Luna',
					names: 'Emiliano Pérez Rodríguez — Padrino',
				},
			],
		});

		expect(result.godparentGroups).toEqual([
			{
				honoreeName: 'Luna Yamileth',
				label: 'De Luna',
				names: 'Emiliano Pérez Rodríguez — Padrino',
			},
		]);
	});

	it('accepts supported family presentation values', () => {
		const result = InvitationEditorSectionSchemas.family.safeParse({
			fatherName: 'Juan',
			presentation: 'text-only',
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.presentation).toBe('text-only');
		}
	});

	it('rejects unknown family presentation values', () => {
		const result = InvitationEditorSectionSchemas.family.safeParse({
			fatherName: 'Juan',
			presentation: 'with-video',
		});

		expect(result.success).toBe(false);
	});
});

describe('InvitationEditorSectionSchemas.gallery', () => {
	const BASE_GALLERY = {
		eyebrow: 'Recuerdos',
		title: 'Galería',
		items: [{ image: 'gallery01', caption: 'Primera' }],
	};

	it('accepts gallery with variant and presentation (premium layout)', () => {
		const value = {
			...BASE_GALLERY,
			variant: 'single',
			presentation: 'pet-keepsake',
		};

		const result = InvitationEditorSectionSchemas.gallery.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.variant).toBe('single');
			expect(result.data.presentation).toBe('pet-keepsake');
			expect(result.data.eyebrow).toBe('Recuerdos');
		}
	});

	it('accepts gallery without variant or presentation (non-premium)', () => {
		const result = InvitationEditorSectionSchemas.gallery.safeParse(BASE_GALLERY);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.variant).toBeUndefined();
			expect(result.data.presentation).toBeUndefined();
		}
	});

	it('rejects gallery with invalid variant value', () => {
		const value = { ...BASE_GALLERY, variant: 'bogus-variant' };
		const result = InvitationEditorSectionSchemas.gallery.safeParse(value);
		expect(result.success).toBe(false);
		if (!result.success) {
			const variantIssue = result.error.issues.find((i) => i.path.includes('variant'));
			expect(variantIssue).toBeDefined();
		}
	});

	it('rejects gallery with invalid presentation value', () => {
		const value = { ...BASE_GALLERY, presentation: 'invalid-presentation' };
		const result = InvitationEditorSectionSchemas.gallery.safeParse(value);
		expect(result.success).toBe(false);
		if (!result.success) {
			const presentationIssue = result.error.issues.find((i) =>
				i.path.includes('presentation'),
			);
			expect(presentationIssue).toBeDefined();
		}
	});

	it('rejects gallery with extra unknown keys', () => {
		const value = { ...BASE_GALLERY, unknownField: 'should-not-pass' };
		const result = InvitationEditorSectionSchemas.gallery.safeParse(value);
		expect(result.success).toBe(false);
		if (!result.success) {
			const unknownIssue = result.error.issues.find((i) => i.code === 'unrecognized_keys');
			expect(unknownIssue).toBeDefined();
		}
	});
});

describe('InvitationEditorSectionSchemas.envelope', () => {
	it('accepts premium envelope fields from published content', () => {
		const value = {
			disabled: false,
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'LL',
			sealVariant: 'premium-rose',
			microcopy: 'Toca para abrir',
			documentLabel: 'Baby Shower',
			cardLabel: 'Baby Shower',
			envelopeName: 'Leah Lexa',
			cardName: 'Leah',
			cardSecondaryName: 'Lexa',
			cardTagline: 'Una celebracin celestial',
			guestLabel: 'Con cariño para:',
			guestNameFallback: 'Familia invitada',
			stampText: 'Leah Lexa',
			stampYear: '2026',
			tooltipText: 'Abrir invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfacePrimary',
			},
			sealColor: 'roseGold',
		};
		const result = InvitationEditorSectionSchemas.envelope.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.sealStyle).toBe('wax');
			expect(result.data.sealVariant).toBe('premium-rose');
			expect(result.data.cardSecondaryName).toBe('Lexa');
			expect(result.data.guestLabel).toBe('Con cariño para:');
			expect(result.data.closedPalette?.primary).toBe('surfacePrimary');
			expect(result.data.sealColor).toBe('roseGold');
		}
	});

	it('accepts minimal envelope without premium fields (non-premium)', () => {
		const value = { disabled: true, cardLabel: 'Invitacin' };
		const result = InvitationEditorSectionSchemas.envelope.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.disabled).toBe(true);
			expect(result.data.cardLabel).toBe('Invitacin');
		}
	});

	it('rejects envelope with extra unknown keys', () => {
		const value = { unknownField: 'should-not-pass' };
		const result = InvitationEditorSectionSchemas.envelope.safeParse(value);
		expect(result.success).toBe(false);
		if (!result.success) {
			const unknownIssue = result.error.issues.find((i) => i.code === 'unrecognized_keys');
			expect(unknownIssue).toBeDefined();
		}
	});

	it('rejects raw CSS seal colors', () => {
		const result = InvitationEditorSectionSchemas.envelope.safeParse({
			sealColor: '#c9a36a',
		});

		expect(result.success).toBe(false);
	});
});

describe('InvitationEditorSectionSchemas.location (venue + indication parity)', () => {
	const BASE_LOCATION = {
		introEyebrow: 'Bienvenidos',
		indicationsHeading: 'Detalles',
	};

	it('accepts venues with venueEvent field', () => {
		const value = {
			...BASE_LOCATION,
			venues: [
				{
					id: 'ven-1',
					type: 'custom' as const,
					venueEvent: 'Baby Shower',
					venueName: 'Casa',
					address: 'Calle 123',
					city: 'CDMX',
					date: '2026-06-21',
					time: '14:00',
				},
			],
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(true);
	});

	it('accepts indications with styleVariant field', () => {
		const value = {
			...BASE_LOCATION,
			indications: [
				{
					iconName: 'MapLocation' as const,
					styleVariant: 'reserved' as const,
					text: 'Sigue las indicaciones',
				},
			],
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(true);
	});

	it('accepts ceremony with valid coordinates', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				address: 'Calle 1',
				coordinates: { lat: 19.4326, lng: -99.1332 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ceremony?.coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
		}
	});

	it('accepts location without coordinates', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ceremony?.coordinates).toBeUndefined();
		}
	});

	it('accepts supported location presentation values', () => {
		const result = InvitationEditorSectionSchemas.location.safeParse({
			...BASE_LOCATION,
			presentation: 'with-map',
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.presentation).toBe('with-map');
		}
	});

	it('rejects unknown location presentation values', () => {
		const result = InvitationEditorSectionSchemas.location.safeParse({
			...BASE_LOCATION,
			presentation: 'gallery',
		});

		expect(result.success).toBe(false);
	});

	it('rejects ceremony with latitude below -90', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				coordinates: { lat: -91, lng: 0 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('rejects ceremony with latitude above 90', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				coordinates: { lat: 91, lng: 0 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('rejects ceremony with longitude below -180', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				coordinates: { lat: 0, lng: -181 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('rejects ceremony with longitude above 180', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				coordinates: { lat: 0, lng: 181 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('accepts venue with mapUrl and coordinates together', () => {
		const value = {
			...BASE_LOCATION,
			ceremony: {
				venueName: 'Iglesia',
				address: 'Calle 1',
				mapUrl: 'https://maps.google.com/?q=19.4326,-99.1332',
				coordinates: { lat: 19.4326, lng: -99.1332 },
			},
		};
		const result = InvitationEditorSectionSchemas.location.safeParse(value);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ceremony?.mapUrl).toBe(
				'https://maps.google.com/?q=19.4326,-99.1332',
			);
			expect(result.data.ceremony?.coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
		}
	});
});

describe('dateLocationsBlockSchema (intake block) coordinate validation', () => {
	const BASE_INTAKE = {
		ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
	};

	it('accepts valid coordinates object', () => {
		const value = {
			...BASE_INTAKE,
			ceremony: {
				...BASE_INTAKE.ceremony,
				coordinates: { lat: '19.4326', lng: '-99.1332' },
			},
		};
		const result = dateLocationsBlockSchema.safeParse(value);
		expect(result.success).toBe(true);
	});

	it('accepts empty coordinate strings', () => {
		const value = {
			...BASE_INTAKE,
			ceremony: {
				...BASE_INTAKE.ceremony,
				coordinates: { lat: '', lng: '' },
			},
		};
		const result = dateLocationsBlockSchema.safeParse(value);
		expect(result.success).toBe(true);
	});

	it('accepts missing coordinates', () => {
		const result = dateLocationsBlockSchema.safeParse(BASE_INTAKE);
		expect(result.success).toBe(true);
	});

	it('rejects latitude out of range', () => {
		const value = {
			...BASE_INTAKE,
			ceremony: {
				...BASE_INTAKE.ceremony,
				coordinates: { lat: '100', lng: '0' },
			},
		};
		const result = dateLocationsBlockSchema.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('rejects longitude out of range', () => {
		const value = {
			...BASE_INTAKE,
			ceremony: {
				...BASE_INTAKE.ceremony,
				coordinates: { lat: '0', lng: '200' },
			},
		};
		const result = dateLocationsBlockSchema.safeParse(value);
		expect(result.success).toBe(false);
	});

	it('rejects non-numeric latitude string', () => {
		const value = {
			...BASE_INTAKE,
			ceremony: {
				...BASE_INTAKE.ceremony,
				coordinates: { lat: 'abc', lng: '0' },
			},
		};
		const result = dateLocationsBlockSchema.safeParse(value);
		expect(result.success).toBe(false);
	});
});

describe('InvitationEditorSectionSchemas.rsvp (guestCap parity)', () => {
	it('accepts large guestCap values from published content', () => {
		const value = {
			title: 'Confirma tu asistencia',
			guestCap: 100,
			confirmationMode: 'api' as const,
		};
		const result = InvitationEditorSectionSchemas.rsvp.safeParse(value);
		expect(result.success).toBe(true);
	});
});

describe('InvitationEditorSectionSchemas.itinerary (optional items)', () => {
	it('accepts itinerary without items array', () => {
		const value = { title: 'Programa' };
		const result = InvitationEditorSectionSchemas.itinerary.safeParse(value);
		expect(result.success).toBe(true);
	});
});
