import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import type { DemoPreset } from '@/lib/intake/types';

const snapshot: DemoPreset = {
	id: 'demo-xv-jewelry-box',
	eventType: 'xv',
	displayName: 'XV Años — Jewelry Box',
	themeId: 'jewelry-box',
	defaultSections: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'gifts',
		'thankYou',
	],
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	],
	recommendedBlocks: [],
	requiredAssets: ['hero', 'portrait'],
	previewSlug: 'demo-xv-jewelry-box',
};

const baseDemoContent = {
	eventType: 'xv',
	title: 'Demo Jewelry Box',
	description: 'Demo description',
	theme: { fontFamily: 'serif', preset: 'jewelry-box' },
	sectionOrder: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'gifts',
		'thankYou',
	],
	hero: {
		name: 'Lucía García',
		label: 'Mis XV Años',
		date: '2026-06-15',
		backgroundImage: { type: 'internal', key: 'hero' },
		variant: 'jewelry-box',
	},
	envelope: {
		disabled: false,
		sealStyle: 'wax',
		sealIcon: 'heart',
		sealInitials: 'L·G',
		microcopy: 'Toca para abrir',
	},
	gallery: { title: 'Galería', items: [] },
	itinerary: { title: 'Itinerario', items: [] },
	countdown: { title: 'Falta poco', subtitlePrefix: 'El', footerText: 'Prepárate' },
	interludes: [],
	sectionStyles: {},
	navigation: [{ label: 'Inicio', href: '#inicio' }],
	sharing: { whatsappTemplate: '¡Hola!' },
};

const baseInput = {
	invitation: {
		title: 'Test Project',
		eventType: 'xv',
		snapshot,
	},
	draftContent: {
		title: 'Test Title',
		description: 'Test Description',
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
	},
	demoContent: baseDemoContent,
};

describe('mapDraftToPublished', () => {
	it('maps hero section correctly', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.hero).toMatchObject({
			name: 'Ana Sofia',
			label: 'Mis XV Anos',
			date: '2027-11-20T00:00:00.000Z',
			backgroundImage: { type: 'internal', key: 'hero' },
			variant: 'jewelry-box',
		});
	});

	it('sets theme from invitation snapshot', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.theme).toMatchObject({ preset: 'jewelry-box' });
	});

	it('sets eventType and isDemo from input', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.eventType).toBe('xv');
		expect(result.isDemo).toBe(false);
	});

	it('marks demo content when publishing a demo invitation', () => {
		const result = mapDraftToPublished({ ...baseInput, isDemo: true });

		expect(result.isDemo).toBe(true);
	});

	it('maps family godparents string to structured array', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
					godparents: 'Pedro — Padrino\nLuisa — Madrina',
				},
			},
		});

		expect(result.family).toMatchObject({
			parents: { father: 'Juan', mother: 'Maria' },
			godparents: [
				{ name: 'Pedro', role: 'Padrino' },
				{ name: 'Luisa', role: 'Madrina' },
			],
		});
	});

	it('maps children string to structured array', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					children: 'Ana\nLuis',
				},
			},
		});

		expect(result.family).toMatchObject({
			children: [{ name: 'Ana' }, { name: 'Luis' }],
		});
	});

	it('maps RSVP fields', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				rsvp: {
					title: 'Confirma',
					guestCap: 4,
					confirmationMode: 'api',
					confirmationMessage: 'Gracias',
				},
			},
		});

		expect(result.rsvp).toMatchObject({
			title: 'Confirma',
			guestCap: 4,
			confirmationMode: 'api',
			confirmationMessage: 'Gracias',
		});
	});

	it('maps music section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				music: { url: 'https://example.com/song.mp3', title: 'My Song' },
			},
		});

		expect(result.music).toMatchObject({
			url: 'https://example.com/song.mp3',
			title: 'My Song',
		});
	});

	it('maps gifts section preserving items', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gifts: {
					title: 'Mesa de regalos',
					subtitle: 'Gracias',
					items: [{ type: 'cash', title: 'Sobres' }],
				},
			},
		});

		expect(result.gifts).toMatchObject({
			title: 'Mesa de regalos',
			subtitle: 'Gracias',
			items: [{ type: 'cash', title: 'Sobres' }],
		});
	});

	it('maps quote section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				quote: { text: 'Una frase', author: 'Autor' },
			},
		});

		expect(result.quote).toMatchObject({ text: 'Una frase', author: 'Autor' });
	});

	it('maps thankYou section', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: { message: 'Gracias a todos', closingName: 'Ana Sofia' },
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'Ana Sofia',
		});
	});

	it('maps location with ceremony and reception venues', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
					reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
					dressCode: 'Formal',
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
			reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
			dressCode: 'Formal',
		});
	});

	it('merges venue image from demo content when draft has location data', () => {
		const demoWithLocation = {
			...baseDemoContent,
			location: {
				ceremony: { image: 'mapCeremony', venueEvent: 'Misa' },
				reception: { image: 'mapReception', venueEvent: 'Fiesta' },
			},
		};
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: demoWithLocation,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
					reception: { venueName: 'Salon', address: 'Calle 2' },
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: { venueName: 'Iglesia', address: 'Calle 1', image: 'mapCeremony' },
			reception: { venueName: 'Salon', address: 'Calle 2', image: 'mapReception' },
		});
	});

	it('omits sections with empty content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.family).toBeUndefined();
		expect(result.rsvp).toBeUndefined();
		expect(result.music).toBeUndefined();
		expect(result.gifts).toBeUndefined();
		expect(result.quote).toBeUndefined();
		expect(result.thankYou).toBeUndefined();
		expect(result.location).toBeUndefined();
	});

	it('includes envelope, gallery, itinerary, countdown from demo content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.envelope).toMatchObject({ disabled: false, sealStyle: 'wax' });
		expect(result.gallery).toMatchObject({ title: 'Galería' });
		expect(result.itinerary).toMatchObject({ title: 'Itinerario' });
		expect(result.countdown).toMatchObject({ title: 'Falta poco' });
	});

	it('uses gallery from draft content when the admin edits captions or order', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gallery: {
					title: 'Nuestros recuerdos',
					items: [
						{ image: 'gallery02', caption: 'Segundo recuerdo' },
						{ image: 'gallery01', caption: 'Primer recuerdo' },
					],
				},
			},
		});

		expect(result.gallery).toEqual({
			title: 'Nuestros recuerdos',
			items: [
				{ image: 'gallery02', caption: 'Segundo recuerdo' },
				{ image: 'gallery01', caption: 'Primer recuerdo' },
			],
		});
	});

	it('uses itinerary from draft content when the admin edits the program', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				itinerary: {
					title: 'Programa',
					items: [{ icon: 'party', label: 'Fiesta', time: '21:00' }],
				},
			},
		});

		expect(result.itinerary).toEqual({
			title: 'Programa',
			items: [{ icon: 'party', label: 'Fiesta', time: '21:00' }],
		});
	});

	it('includes interludes, sectionStyles, navigation, sharing from demo content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(Array.isArray(result.interludes)).toBe(true);
		expect(result.sectionStyles).toBeDefined();
		expect(result.navigation).toMatchObject([{ label: 'Inicio' }]);
		expect(result.sharing).toMatchObject({ whatsappTemplate: '¡Hola!' });
	});

	it('includes theme and sectionOrder from demo content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.theme).toMatchObject({ fontFamily: 'serif', preset: 'jewelry-box' });
		expect(Array.isArray(result.sectionOrder)).toBe(true);
	});

	it('uses draft sectionOrder when the admin configures visible sections', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				sectionOrder: ['quote', 'rsvp', 'thankYou'],
			},
		});

		expect(result.sectionOrder).toEqual(['quote', 'rsvp', 'thankYou']);
	});

	it('draft hero fields override demo defaults', () => {
		const result = mapDraftToPublished(baseInput);

		expect((result.hero as Record<string, unknown>).name).toBe('Ana Sofia');
		expect((result.hero as Record<string, unknown>).label).toBe('Mis XV Anos');
		expect((result.hero as Record<string, unknown>).date).toBe('2027-11-20T00:00:00.000Z');
	});

	it('draft title overrides demo title', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.title).toBe('Test Project');
	});

	it('draft description overrides demo description', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.description).toBe('Test Description');
	});

	it('isDemo is always false', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.isDemo).toBe(false);
	});

	it('all enriched sections renderer-compatible', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result).toMatchObject({
			eventType: expect.any(String),
			title: expect.any(String),
			isDemo: false,
			theme: expect.objectContaining({
				preset: expect.any(String),
			}),
			hero: expect.objectContaining({
				name: expect.any(String),
				backgroundImage: expect.any(Object),
			}),
		});
	});

	it('uses demo previewSlug as _assetSlug when invitation has no explicit assetSlug', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result._assetSlug).toBe('demo-xv-jewelry-box');
	});

	it('uses explicit assetSlug over snapshot.previewSlug when provided', () => {
		const result = mapDraftToPublished({
			...baseInput,
			assetSlug: 'ana-sofia-cota-guillen',
		});

		expect(result._assetSlug).toBe('ana-sofia-cota-guillen');
		expect(result._assetSlug).not.toBe('demo-xv-jewelry-box');
	});
});
