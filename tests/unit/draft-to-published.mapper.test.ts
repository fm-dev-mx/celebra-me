import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import type { DemoPreset } from '@/lib/intake/types';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { DEFAULT_REMINDER_MESSAGE } from '@/lib/rsvp/services/shared/share-message-defaults';

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
	countdown: { title: 'Falta poco', footerText: 'Prepárate' },
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
		});
		// Variant from demo is not included for non-demo invitations
		expect(result.hero).not.toHaveProperty('variant');
	});

	it('includes backgroundImageMobile when draft provides it', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				hero: {
					...baseInput.draftContent.hero,
					backgroundImageMobile: {
						type: 'external',
						src: 'https://cdn.test/mobile-bg.webp',
					},
				},
			},
		});

		expect(result.hero).toMatchObject({
			backgroundImageMobile: { type: 'external', src: 'https://cdn.test/mobile-bg.webp' },
		});
	});

	it('sets backgroundImageMobile to undefined when draft does not provide it', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.hero).toHaveProperty('backgroundImageMobile', undefined);
	});

	it('does not publish demo mobile fallback for a real invitation when draft omits mobile image', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				hero: {
					...baseDemoContent.hero,
					backgroundImageMobile: {
						type: 'external',
						src: 'https://cdn.test/demo-mobile-bg.webp',
					},
				},
			},
		});

		expect(result.hero).toHaveProperty('backgroundImageMobile', undefined);
	});

	it('preserves authored demo mobile images for demo publishing', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			demoContent: {
				...baseDemoContent,
				hero: {
					...baseDemoContent.hero,
					backgroundImageMobile: {
						type: 'external',
						src: 'https://cdn.test/demo-mobile-bg.webp',
					},
				},
			},
		});

		expect(result.hero).toMatchObject({
			backgroundImageMobile: {
				type: 'external',
				src: 'https://cdn.test/demo-mobile-bg.webp',
			},
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

	it('maps parentsOrder father-first from draft to published at family root level', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Fernando Valenzuela',
					motherName: 'Maria Duarte',
					parentsOrder: 'father-first',
				},
			},
		});

		expect(result.family).toMatchObject({
			parents: { father: 'Fernando Valenzuela', mother: 'Maria Duarte' },
			parentsOrder: 'father-first',
		});
	});

	it('maps parentsOrder mother-first from draft to published at family root level', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Fernando Valenzuela',
					motherName: 'Maria Duarte',
					parentsOrder: 'mother-first',
				},
			},
		});

		expect(result.family).toMatchObject({
			parents: { father: 'Fernando Valenzuela', mother: 'Maria Duarte' },
			parentsOrder: 'mother-first',
		});
	});

	it('omits parentsOrder when not provided in draft (backward compatibility)', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Fernando Valenzuela',
					motherName: 'Maria Duarte',
				},
			},
		});

		const family = result.family as Record<string, unknown>;
		expect(family).not.toHaveProperty('parentsOrder');
	});

	it('passes eventContentSchema validation when parentsOrder is provided', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Fernando Valenzuela',
					motherName: 'Maria Duarte',
					parentsOrder: 'father-first',
				},
				quote: { text: 'Test quote', author: 'Test author' },
				location: {
					ceremony: {
						venueName: 'Church',
						address: '123 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '18:00',
					},
					reception: {
						venueName: 'Reception Hall',
						address: '456 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '20:00',
					},
				},
			},
		});

		const validation = eventContentSchema.safeParse(result);
		expect(validation.success).toBe(true);
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

	it('maps thankYou section with image', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: {
					message: 'Gracias',
					closingName: 'Familia',
					image: { type: 'uploaded', assetId: '00000000-0000-0000-0000-000000000001' },
				},
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias',
			closingName: 'Familia',
			image: { type: 'uploaded', assetId: '00000000-0000-0000-0000-000000000001' },
		});
	});

	it('preserves thankYou focalPoint when provided in draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: {
					message: 'Gracias a todos',
					closingName: 'Ana Sofia',
					focalPoint: '50% 42%',
				},
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'Ana Sofia',
			focalPoint: '50% 42%',
		});
	});

	it('preserves thankYou focalPoint in image-only branch when provided in draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: {
					message: '',
					closingName: '',
					image: { type: 'uploaded', assetId: '00000000-0000-0000-0000-000000000001' },
					focalPoint: '50% 30%',
				},
			},
		});

		expect(result.thankYou).toMatchObject({
			focalPoint: '50% 30%',
			image: { type: 'uploaded', assetId: '00000000-0000-0000-0000-000000000001' },
		});
	});

	it('preserves thankYou overlayAnchor and overlaySafeArea when provided in draft', () => {
		const overlaySafeArea = { x: 0.5, y: 0.31, width: 0.21, height: 0.24 };
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: {
					message: 'Gracias a todos',
					closingName: 'César Ramses',
					overlayAnchor: 'left',
					overlaySafeArea,
				},
			},
		});

		expect(result.thankYou).toMatchObject({
			message: 'Gracias a todos',
			closingName: 'César Ramses',
			overlayAnchor: 'left',
			overlaySafeArea,
		});
	});

	it('passes eventContentSchema validation when thankYou has overlay fields', () => {
		const overlaySafeArea = { x: 0.5, y: 0.31, width: 0.21, height: 0.24 };
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				thankYou: {
					message: 'Gracias a todos',
					closingName: 'César Ramses',
					focalPoint: '50% 42%',
					overlayAnchor: 'left',
					overlaySafeArea,
				},
				quote: { text: 'Test quote', author: 'Test author' },
				location: {
					ceremony: {
						venueName: 'Church',
						address: '123 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '18:00',
					},
					reception: {
						venueName: 'Reception Hall',
						address: '456 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '20:00',
					},
				},
			},
		});

		const validation = eventContentSchema.safeParse(result);
		expect(validation.success).toBe(true);
	});

	it('maps location with ceremony and reception venues', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
					reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
					indications: [{ iconName: 'DressCode', text: 'Formal' }],
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: { venueName: 'Iglesia', address: 'Calle 1', city: 'Queretaro' },
			reception: { venueName: 'Salon', address: 'Calle 2', city: 'Queretaro' },
			indications: [{ iconName: 'DressCode', styleVariant: 'default', text: 'Formal' }],
		});
	});

	it('merges venue image from demo content when isDemo is true', () => {
		const demoWithLocation = {
			...baseDemoContent,
			location: {
				ceremony: { image: 'mapCeremony', venueEvent: 'Misa' },
				reception: { image: 'mapReception', venueEvent: 'Fiesta' },
			},
		};
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
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

	it('omits optional sections and provides empty valid structures for required ones', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.family).toBeUndefined();
		expect(result.rsvp).toBeUndefined();
		expect(result.music).toBeUndefined();
		expect(result.gifts).toBeUndefined();
		expect(result.thankYou).toBeUndefined();
		expect(result.quote).toEqual({ text: '' });
		expect(result.location as Record<string, unknown>).toEqual({ indicationsHeading: '' });
		expect(result.gallery).toEqual({ items: [] });
		expect(result.itinerary).toEqual({ items: [] });
	});

	it('publishes location.venues when present, preferring it over legacy ceremony/reception', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
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
							label: 'Cena',
							venueName: 'Salón B',
							address: 'Calle 2',
							date: '2026-01-01',
							time: '20:00',
							isVisible: true,
						},
					],
				},
			},
		});
		const loc = result.location as Record<string, unknown>;

		expect(loc).toBeDefined();
		expect(loc.venues).toBeDefined();
		expect(loc.venues).toHaveLength(2);
		expect((loc.venues as Array<Record<string, unknown>>)[0].venueName).toBe('Iglesia A');
		expect((loc.venues as Array<Record<string, unknown>>)[1].venueName).toBe('Salón B');
		expect(loc.ceremony).toBeUndefined();
		expect(loc.reception).toBeUndefined();
	});

	it('filters out hidden venues (isVisible === false) from published output', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
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
							isVisible: false,
						},
						{
							id: 'v2',
							type: 'reception',
							label: 'Recepción',
							venueName: 'Salón B',
							address: 'Calle 2',
							date: '2026-01-01',
							time: '20:00',
							isVisible: true,
						},
					],
				},
			},
		});
		const loc = result.location as Record<string, unknown>;

		expect(loc.venues).toHaveLength(1);
		expect((loc.venues as Array<Record<string, unknown>>)[0].venueName).toBe('Salón B');
	});

	it('falls back to legacy ceremony/reception when venues is absent', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					introHeading: 'Ubicaciones',
					ceremony: {
						venueName: 'Iglesia Legacy',
						address: 'Calle L1',
						date: '2026-01-01',
						time: '10:00',
					},
					reception: {
						venueName: 'Salón Legacy',
						address: 'Calle L2',
						date: '2026-01-01',
						time: '20:00',
					},
				},
			},
		});
		const loc = result.location as Record<string, unknown>;

		expect(loc.ceremony).toBeDefined();
		expect(loc.reception).toBeDefined();
		expect((loc.ceremony as Record<string, unknown>).venueName).toBe('Iglesia Legacy');
		expect((loc.reception as Record<string, unknown>).venueName).toBe('Salón Legacy');
		expect(loc.venues).toBeUndefined();
	});

	it('preserves custom venue labels in published venues', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					introHeading: 'Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'custom',
							label: 'Mi Jardín Secreto',
							venueName: 'Jardín X',
							address: 'Calle X',
							date: '2026-01-01',
							time: '15:00',
							isVisible: true,
						},
					],
				},
			},
		});
		const loc = result.location as Record<string, unknown>;

		expect(loc.venues).toHaveLength(1);
		expect((loc.venues as Array<Record<string, unknown>>)[0].label).toBe('Mi Jardín Secreto');
		expect((loc.venues as Array<Record<string, unknown>>)[0].type).toBe('custom');
	});

	it('preserves coordinates in legacy ceremony/reception venues', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: {
						venueName: 'Iglesia',
						address: 'Calle 1',
						coordinates: { lat: 19.4326, lng: -99.1332 },
					},
					reception: {
						venueName: 'Salon',
						address: 'Calle 2',
						coordinates: { lat: 20.5, lng: -100.3 },
					},
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: {
				venueName: 'Iglesia',
				coordinates: { lat: 19.4326, lng: -99.1332 },
			},
			reception: {
				venueName: 'Salon',
				coordinates: { lat: 20.5, lng: -100.3 },
			},
		});
	});

	it('preserves coordinates in venues array format', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
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
							coordinates: { lat: 19.4326, lng: -99.1332 },
							isVisible: true,
						},
					],
				},
			},
		});

		const loc = result.location as Record<string, unknown>;
		const venues = loc.venues as Array<Record<string, unknown>>;
		expect(venues).toHaveLength(1);
		expect(venues[0].coordinates).toEqual({ lat: 19.4326, lng: -99.1332 });
	});

	it('preserves both mapUrl and coordinates in published venue', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: {
						venueName: 'Iglesia',
						address: 'Calle 1',
						mapUrl: 'https://maps.google.com/?q=19.4326,-99.1332',
						coordinates: { lat: 19.4326, lng: -99.1332 },
					},
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: {
				mapUrl: 'https://maps.google.com/?q=19.4326,-99.1332',
				coordinates: { lat: 19.4326, lng: -99.1332 },
			},
		});
	});

	it('does not include coordinates in published venue when draft has none', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: {
						venueName: 'Iglesia',
						address: 'Calle 1',
					},
				},
			},
		});

		const ceremony = (result.location as Record<string, unknown>).ceremony as Record<
			string,
			unknown
		>;
		expect(ceremony.coordinates).toBeUndefined();
	});

	it('does not reintroduce deleted ceremony from demo fallback when venues is present', () => {
		const demoWithLocation = {
			...baseDemoContent,
			location: {
				ceremony: {
					venueName: 'Demo Church',
					address: 'Demo St',
					date: '2026-01-01',
					time: '10:00',
				},
			},
		};
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			demoContent: demoWithLocation,
			draftContent: {
				...baseInput.draftContent,
				location: {
					introHeading: 'Nuestras Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'reception',
							label: 'Recepción',
							venueName: 'Nuestra Casa',
							address: 'Calle Principal',
							date: '2026-01-01',
							time: '20:00',
							isVisible: true,
						},
					],
				},
			},
		});
		const loc = result.location as Record<string, unknown>;

		expect(loc.venues).toHaveLength(1);
		expect((loc.venues as Array<Record<string, unknown>>)[0].venueName).toBe('Nuestra Casa');
		expect(loc.ceremony).toBeUndefined();
	});

	it('defaults envelope to disabled:true when no envelope provided and no prior published content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.envelope).toMatchObject({ disabled: true });
		expect(result.gallery).toEqual({ items: [] });
		expect(result.itinerary).toEqual({ items: [] });
	});

	it('uses neutral countdown text for non-demo invitations', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.countdown).toMatchObject({
			title: '¡Falta muy poco!',
			footerText: 'Prepárate para una noche inolvidable',
		});
	});

	it('uses editable countdown copy for real invitations when draft provides it', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				countdown: {
					title: 'Ya casi celebramos',
					footerText: 'Trae tus mejores pasos de baile',
				},
			},
		});

		expect(result.countdown).toMatchObject({
			title: 'Ya casi celebramos',
			footerText: 'Trae tus mejores pasos de baile',
		});
	});

	it('derives startsAtUtc from localDateTime and timeZone in mapper', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
					timeZone: 'America/Mazatlan',
				},
			},
		});

		expect(result.eventTiming).toEqual({
			localDateTime: '2026-08-01T20:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-08-02T03:00:00.000Z',
		});
	});

	it('uses themed countdown text for demo invitations', () => {
		const result = mapDraftToPublished({ ...baseInput, isDemo: true });

		expect(result.countdown).toMatchObject({ title: 'Falta poco' });
	});

	it('does not inherit stale demo date/location text in countdown footerText for real invitations', () => {
		const demoWithStaleFooter = {
			...baseDemoContent,
			countdown: {
				title: 'La gala comienza en',
				footerText: '20 de noviembre de 2027, Querétaro',
			},
		};
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: demoWithStaleFooter,
		});

		expect(result.countdown).toMatchObject({
			footerText: 'Prepárate para una noche inolvidable',
		});
		expect((result.countdown as Record<string, unknown>).footerText).not.toBe(
			'20 de noviembre de 2027, Querétaro',
		);
	});

	it('maps editable location section copy and indications to public content', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					introEyebrow: 'EL CAMINO AL PALACIO',
					introHeading: 'Ubicación',
					introLede:
						'Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas.',
					indicationsHeading: 'Indicaciones importantes',
					ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
					indications: [
						{ iconName: 'DressCode', text: 'Formal de gala' },
						{ iconName: 'Calendar', text: 'Confirma antes del 6 de noviembre.' },
					],
				},
			},
		});

		expect(result.location).toMatchObject({
			introEyebrow: 'EL CAMINO AL PALACIO',
			introHeading: 'Ubicación',
			introLede:
				'Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas.',
			indicationsHeading: 'Indicaciones importantes',
			indications: [
				{ iconName: 'DressCode', styleVariant: 'default', text: 'Formal de gala' },
				{
					iconName: 'Calendar',
					styleVariant: 'default',
					text: 'Confirma antes del 6 de noviembre.',
				},
			],
		});
	});

	it('filters out indications with empty text', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
					indications: [{ iconName: 'DressCode', text: '' }],
				},
			},
		});

		expect(result.location as Record<string, unknown>).not.toHaveProperty('indications');
	});

	it('maps location from demo content when draft location is sparse', () => {
		const demoWithLocation = {
			...baseDemoContent,
			location: {
				introEyebrow: 'EL CAMINO AL PALACIO',
				introHeading: 'Ubicación',
				introLede: 'Guarda la ruta.',
				indicationsHeading: 'Indicaciones',
				ceremony: {
					venueName: 'Iglesia Demo',
					address: 'Calle Demo',
					image: 'mapCeremony',
				},
				reception: {
					venueName: 'Salon Demo',
					address: 'Calle 2 Demo',
					image: 'mapReception',
				},
			},
		};
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			demoContent: demoWithLocation,
			draftContent: {
				...baseInput.draftContent,
				location: {
					ceremony: { venueName: 'Iglesia', address: 'Calle 1' },
				},
			},
		});

		expect(result.location).toMatchObject({
			ceremony: { venueName: 'Iglesia', address: 'Calle 1', image: 'mapCeremony' },
			reception: { venueName: 'Salon Demo', address: 'Calle 2 Demo', image: 'mapReception' },
			introEyebrow: 'EL CAMINO AL PALACIO',
			introHeading: 'Ubicación',
			introLede: 'Guarda la ruta.',
			indicationsHeading: 'Indicaciones',
		});
	});

	it('uses gallery from draft content when the admin edits captions or order', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gallery: {
					eyebrow: 'Galería',
					title: 'Nuestros recuerdos',
					items: [
						{ image: 'gallery02', caption: 'Segundo recuerdo' },
						{ image: 'gallery01', caption: 'Primer recuerdo' },
					],
				},
			},
		});

		expect(result.gallery).toEqual({
			eyebrow: 'Galería',
			title: 'Nuestros recuerdos',
			items: [
				{ image: 'gallery02', caption: 'Segundo recuerdo' },
				{ image: 'gallery01', caption: 'Primer recuerdo' },
			],
		});
	});

	it('preserves gallery eyebrow from draft content', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gallery: {
					eyebrow: 'Recuerdos',
					title: 'Momentos especiales',
					items: [{ image: 'gallery01', caption: 'Primer recuerdo' }],
				},
			},
		});

		expect(result.gallery).toEqual({
			eyebrow: 'Recuerdos',
			title: 'Momentos especiales',
			items: [{ image: 'gallery01', caption: 'Primer recuerdo' }],
		});
	});

	it('does not reuse gallery title as eyebrow fallback', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				gallery: {
					title: 'Instantes de Ayrin',
					items: [{ image: 'gallery01', caption: 'Primer recuerdo' }],
				},
			},
		});

		const gallery = result.gallery as Record<string, unknown> | undefined;
		expect((gallery as Record<string, unknown> | undefined)?.eyebrow).toBeUndefined();
		expect((gallery as Record<string, unknown> | undefined)?.title).toBe('Instantes de Ayrin');
	});

	it('uses itinerary from draft content when the admin edits the program', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				itinerary: {
					title: 'Programa',
					items: [{ iconName: 'Party', label: 'Fiesta', time: '21:00' }],
				},
			},
		});

		expect(result.itinerary).toEqual({
			title: 'Programa',
			items: [{ iconName: 'Party', label: 'Fiesta', time: '21:00' }],
		});
	});

	it('does not normalize legacy itinerary icon fields from old draft content', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				itinerary: {
					title: 'Programa',
					items: [{ icon: 'church', label: 'Misa', time: '18:00' }],
				} as never,
			},
		});

		expect(result.itinerary).toEqual({
			title: 'Programa',
			items: [{ icon: 'church', label: 'Misa', time: '18:00' }],
		});

		expect(eventContentSchema.safeParse(result).success).toBe(false);
	});

	it('keeps unknown legacy itinerary icons invalid at publication validation', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				itinerary: {
					title: 'Programa',
					items: [{ icon: 'unknown-icon', label: 'Misterio', time: '18:00' }],
				} as never,
			},
		});

		expect(result.itinerary).toEqual({
			title: 'Programa',
			items: [{ icon: 'unknown-icon', label: 'Misterio', time: '18:00' }],
		});

		const validation = eventContentSchema.safeParse(result);
		expect(validation.success).toBe(false);
		if (!validation.success) {
			expect(validation.error.issues.map((issue) => issue.path.join('.'))).toContain(
				'itinerary.items.0.iconName',
			);
		}
	});

	it('includes interludes and sectionStyles from demo content when isDemo is true', () => {
		const result = mapDraftToPublished({ ...baseInput, isDemo: true });

		expect(Array.isArray(result.interludes)).toBe(true);
		expect(result.sectionStyles).toBeDefined();
		// With isDemo: true, demo sharing data (whatsappTemplate) is included
		expect(result.sharing).toBeDefined();
	});

	it('includes theme and sectionOrder from demo content when isDemo is true', () => {
		const result = mapDraftToPublished({ ...baseInput, isDemo: true });

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

	it('defaults isDemo to false', () => {
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

	it('maps family section label fields into published labels object', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					sectionSubtitle: 'Mi Familia',
					sectionTitle: 'Los que hacen mi vida completa',
					parentsTitle: 'Con la bendición de',
					godparentsTitle: 'Padrinos',
					sectionMessage: 'Un mensaje especial',
				},
			},
		});

		expect(result.family).toMatchObject({
			labels: {
				sectionSubtitle: 'Mi Familia',
				sectionTitle: 'Los que hacen mi vida completa',
				parentsTitle: 'Con la bendición de',
				godparentsTitle: 'Padrinos',
				sectionMessage: 'Un mensaje especial',
			},
		});
	});

	it('places sectionMessage in both labels and root for backward compatibility', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					sectionMessage: 'Mensaje familiar',
				},
			},
		});

		const family = result.family as Record<string, unknown>;
		expect(family.sectionMessage).toBe('Mensaje familiar');
		expect((family.labels as Record<string, unknown>).sectionMessage).toBe('Mensaje familiar');
	});

	it('maps family groups from draft format to published structured format', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					groups: [
						{ title: 'Padres de la Novia', names: 'Roberto García\nAna García' },
						{ title: 'Padrinos', names: 'Carlos — Padrino\nMaría — Madrina' },
					],
				},
			},
		});

		expect(result.family).toMatchObject({
			groups: [
				{
					title: 'Padres de la Novia',
					items: [{ name: 'Roberto García' }, { name: 'Ana García' }],
				},
				{
					title: 'Padrinos',
					items: [{ name: 'Carlos — Padrino' }, { name: 'María — Madrina' }],
				},
			],
		});
	});

	it('maps family visible flag to published content', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					visible: false,
				},
			},
		});

		expect((result.family as Record<string, unknown>).visible).toBe(false);
	});

	it('omits labels when no label fields are provided', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					motherName: 'Maria',
				},
			},
		});

		expect(result.family).not.toHaveProperty('labels');
	});

	it('omits groups when draft groups array is empty', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {
					fatherName: 'Juan',
					groups: [],
				},
			},
		});

		expect(result.family).not.toHaveProperty('groups');
	});

	it('preserves RSVP responseMessages from draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				rsvp: {
					title: 'RSVP',
					confirmationMessage: 'Gracias',
					responseMessages: {
						confirmed: {
							title: '¡Gracias {guestName}!',
							subtitle: 'Registrado.',
						},
						declined: {
							title: 'Qué pena {guestName}.',
							subtitle: 'Avisarnos.',
						},
					},
				},
			},
		});

		expect(result.rsvp).toMatchObject({
			responseMessages: {
				confirmed: { title: '¡Gracias {guestName}!', subtitle: 'Registrado.' },
				declined: { title: 'Qué pena {guestName}.', subtitle: 'Avisarnos.' },
			},
		});
	});

	it('omits RSVP responseMessages when not provided in draft or demo', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				rsvp: { title: 'RSVP', confirmationMessage: 'Gracias' },
			},
		});

		expect(result.rsvp).not.toHaveProperty('responseMessages');
	});

	it('preserves music autoPlay from draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				music: { url: 'https://example.com/song.mp3', title: 'Canción', autoPlay: true },
			},
		});

		expect(result.music).toMatchObject({
			url: 'https://example.com/song.mp3',
			autoPlay: true,
		});
	});

	it('defaults music autoPlay to false when not specified in draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				music: { url: 'https://example.com/song.mp3', title: 'Canción' },
			},
		});

		expect(result.music).toMatchObject({ autoPlay: false });
	});

	it('allows draft envelope disabled to override demo envelope', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				envelope: { disabled: true },
			},
		});

		expect(result.envelope).toMatchObject({ disabled: true });
		expect(result.envelope).toMatchObject({ sealStyle: 'wax' });
	});

	it('preserves demo envelope when no draft override exists', () => {
		const result = mapDraftToPublished({ ...baseInput, isDemo: true });

		expect(result.envelope).toMatchObject({ disabled: false, sealStyle: 'wax' });
	});

	it('defaults envelope to disabled when no demo envelope and no draft override', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: { ...baseDemoContent, envelope: undefined },
		});

		expect(result.envelope).toMatchObject({ disabled: true });
	});

	it('allows draft sealInitials to override demo sealInitials', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				envelope: { sealInitials: 'A·L' },
			},
		});

		expect(result.envelope).toMatchObject({ sealInitials: 'A·L' });
		// Non-overridden demo fields must survive
		expect(result.envelope).toMatchObject({ sealStyle: 'wax' });
	});

	it('treats empty draft sealInitials as no override, falling back to demo value', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				envelope: { sealInitials: '' },
			},
		});

		expect(result.envelope).toMatchObject({ sealInitials: 'L·G' });
	});
});

describe('envelope — premium field preservation (regression)', () => {
	const PREMIUM_ENVELOPE = {
		disabled: false,
		cardLabel: 'Baby Shower',
		cardTagline: 'Una celebración celestial',
		sealInitials: 'LL',
		sealStyle: 'wax' as const,
		sealIcon: 'monogram' as const,
		sealVariant: 'premium-rose' as const,
		microcopy: 'Toca para abrir mi invitación',
		documentLabel: 'Baby Shower',
		stampText: 'Leah Lexa',
		stampYear: '2026',
		closedPalette: {
			primary: 'surfacePrimary' as const,
			accent: 'actionAccent' as const,
			background: 'surfacePrimary' as const,
		},
	};

	it('preserves sealVariant and all premium fields from effective envelope', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				envelope: PREMIUM_ENVELOPE,
			},
		});

		expect(result.envelope).toMatchObject({
			sealVariant: 'premium-rose',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			microcopy: 'Toca para abrir mi invitación',
			stampText: 'Leah Lexa',
			stampYear: '2026',
			closedPalette: {
				primary: 'surfacePrimary',
			},
		});
	});

	it('preserves premium fields when draft edits only cardLabel', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				envelope: {
					...PREMIUM_ENVELOPE,
					cardLabel: 'Etiqueta editada',
				},
			},
		});

		expect(result.envelope).toMatchObject({
			cardLabel: 'Etiqueta editada',
			sealVariant: 'premium-rose',
			sealStyle: 'wax',
		});
	});

	it('preserves premium fields when draft edits only cardTagline', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				envelope: {
					...PREMIUM_ENVELOPE,
					cardTagline: 'Lema editado',
				},
			},
		});

		expect(result.envelope).toMatchObject({
			cardTagline: 'Lema editado',
			sealVariant: 'premium-rose',
		});
	});

	it('preserves premium fields when draft edits only sealInitials', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				envelope: {
					...PREMIUM_ENVELOPE,
					sealInitials: 'HL',
				},
			},
		});

		expect(result.envelope).toMatchObject({
			sealInitials: 'HL',
			sealVariant: 'premium-rose',
		});
	});

	it('honors draft disabled:true while preserving premium fields', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				envelope: {
					...PREMIUM_ENVELOPE,
					disabled: true,
				},
			},
		});

		expect(result.envelope).toMatchObject({
			disabled: true,
			sealVariant: 'premium-rose',
		});
	});
});

describe('edge cases — blank/empty/null sections', () => {
	it('returns undefined rsvp when draft rsvp is undefined', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: { ...baseInput.draftContent, rsvp: undefined },
		});
		expect(result.rsvp).toBeUndefined();
	});

	it('returns undefined rsvp when draft rsvp is an empty object', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: { ...baseInput.draftContent, rsvp: {} },
		});
		expect(result.rsvp).toBeUndefined();
	});

	it('preserves demo envelope fields when draft envelope is empty and isDemo is true', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: { ...baseInput.draftContent, envelope: {} },
		});
		expect(result.envelope).toMatchObject({
			disabled: false,
			sealStyle: 'wax',
			sealInitials: 'L·G',
		});
	});

	it('preserves demo envelope fields when draft envelope has only some overrides', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				envelope: { disabled: true },
			},
		});
		expect(result.envelope).toMatchObject({
			disabled: true,
			sealStyle: 'wax',
			sealInitials: 'L·G',
		});
	});

	it('falls back to demo hero when draft hero is undefined and isDemo is true', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				hero: undefined,
			},
		});
		expect(result.hero).toMatchObject({
			name: 'Lucía García',
			label: 'Mis XV Años',
			date: '2026-06-15',
			backgroundImage: { type: 'internal', key: 'hero' },
		});
	});

	it('falls back to demo hero when draft hero is an empty object and isDemo is true', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			draftContent: {
				...baseInput.draftContent,
				hero: {},
			},
		});
		expect(result.hero).toMatchObject({
			name: 'Lucía García',
			label: 'Mis XV Años',
			date: '2026-06-15',
			backgroundImage: { type: 'internal', key: 'hero' },
		});
	});

	it('uses safe hero fallback when both draft and demo hero are undefined', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				hero: undefined,
			},
			demoContent: {
				...baseDemoContent,
				hero: undefined,
			},
		});
		expect(result.hero).toMatchObject({
			name: 'Test Project',
			label: 'Invitación Especial',
			date: '',
			backgroundImage: { type: 'internal', key: 'hero' },
		});
	});

	it('omits family labels object when no label fields are provided (not empty object)', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: { fatherName: 'Juan' },
			},
		});
		const family = result.family as Record<string, unknown>;
		expect(family).not.toHaveProperty('labels');
	});

	it('returns undefined family when family is an empty object', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				family: {},
			},
		});
		expect(result.family).toBeUndefined();
	});
});

describe('sharing section mapping', () => {
	it('maps shareMessages from draft when present', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					invitation: 'Draft invitation: {guestName}',
					reminder: 'Draft reminder: {eventTitle}',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.invitation).toBe('Draft invitation: {guestName}');
		expect(shareMessages.reminder).toBe('Draft reminder: {eventTitle}');
	});

	it('falls back to demo shareMessages when draft has none and isDemo is true', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			demoContent: {
				...baseDemoContent,
				sharing: {
					whatsappTemplate: 'Demo template',
					shareMessages: {
						invitation: 'Demo invitation',
						reminder: 'Demo reminder',
					},
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.invitation).toBe('Demo invitation');
		expect(shareMessages.reminder).toBe('Demo reminder');
	});

	it('does not preserve legacy demo whatsappTemplate for client publications', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				sharing: {
					whatsappTemplate:
						'Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}',
				},
			},
		});

		expect(result.sharing).toBeUndefined();
	});

	it('returns undefined sharing when no draft or demo sharing exists', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: { ...baseDemoContent, sharing: undefined },
		});

		expect(result.sharing).toBeUndefined();
	});

	it('keeps legacy whatsappTemplate for actual demo publications', () => {
		const result = mapDraftToPublished({
			...baseInput,
			isDemo: true,
			demoContent: {
				...baseDemoContent,
				sharing: { whatsappTemplate: 'Only legacy template' },
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		expect(sharing.whatsappTemplate).toBe('Only legacy template');
		expect(sharing.shareMessages).toBeUndefined();
	});

	it('preserves ogDescription from draft sharing', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					ogDescription: 'Acompáñanos a celebrar los XV años de Ayrin Samantha.',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		expect(sharing.ogDescription).toBe('Acompáñanos a celebrar los XV años de Ayrin Samantha.');
	});

	it('preserves ogDescription alongside shareMessages', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					invitation: 'Invitation: {guestName}',
					reminder: 'Reminder: {eventTitle}',
					ogDescription: 'Custom social preview description.',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		expect(sharing.ogDescription).toBe('Custom social preview description.');
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.invitation).toBe('Invitation: {guestName}');
	});

	it('does not copy any sharing from demo for non-demo publications', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				sharing: {
					ogDescription: 'Demo social preview copy.',
					shareMessages: {
						invitation: 'Demo invitation',
						reminder: 'Demo reminder',
					},
				},
			},
		});

		expect(result.sharing).toBeUndefined();
	});

	it('defaults to DEFAULT_REMINDER_MESSAGE when reminder is missing from draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					invitation: 'My invitation message',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('defaults to DEFAULT_REMINDER_MESSAGE when reminder is empty string in draft', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					invitation: 'My invitation message',
					reminder: '',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
	});

	it('preserves explicitly set reminder when it is non-empty', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					invitation: 'My invitation message',
					reminder: 'My custom reminder template',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.reminder).toBe('My custom reminder template');
	});

	it('passes eventContentSchema when sharing.reminder was empty and defaults to default reminder', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				...baseInput.draftContent,
				sharing: {
					invitation: 'Valid invitation message',
					reminder: '',
				},
				quote: { text: 'Test quote', author: 'Test author' },
				location: {
					ceremony: {
						venueName: 'Church',
						address: '123 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '18:00',
					},
					reception: {
						venueName: 'Reception Hall',
						address: '456 Main St',
						city: 'City',
						date: '2026-06-15',
						time: '20:00',
					},
				},
			},
		});

		const validation = eventContentSchema.safeParse(result);
		expect(validation.success).toBe(true);

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
	});
});
