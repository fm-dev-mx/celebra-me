import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import type { DemoPreset } from '@/lib/intake/types';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

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
			variant: 'jewelry-box',
		});
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
		if (!validation.success) {
			console.log('Validation errors:', JSON.stringify(validation.error.issues, null, 2));
		}
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

	it('includes envelope, gallery, itinerary from demo content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.envelope).toMatchObject({ disabled: false, sealStyle: 'wax' });
		expect(result.gallery).toMatchObject({ title: 'Galería' });
		expect(result.itinerary).toMatchObject({ title: 'Itinerario' });
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

		expect(result.location).not.toHaveProperty('indications');
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

	it('includes interludes, sectionStyles, sharing from demo content', () => {
		const result = mapDraftToPublished(baseInput);

		expect(Array.isArray(result.interludes)).toBe(true);
		expect(result.sectionStyles).toBeDefined();
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
			draftContent: {
				...baseInput.draftContent,
				envelope: { disabled: true },
			},
		});

		expect(result.envelope).toMatchObject({ disabled: true });
		expect(result.envelope).toMatchObject({ sealStyle: 'wax' });
	});

	it('preserves demo envelope when no draft override exists', () => {
		const result = mapDraftToPublished(baseInput);

		expect(result.envelope).toMatchObject({ disabled: false, sealStyle: 'wax' });
	});

	it('defaults envelope to disabled when no demo envelope and no draft override', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: { ...baseDemoContent, envelope: undefined },
		});

		expect(result.envelope).toMatchObject({ disabled: true });
	});
});

describe('sharing section mapping', () => {
	it('maps shareMessages from draft when present', () => {
		const result = mapDraftToPublished({
			...baseInput,
			draftContent: {
				sharing: {
					whatsappWithPhone: 'Draft with phone: {guestName}',
					whatsappWithoutPhone: 'Draft without phone: {eventTitle}',
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.whatsappWithPhone).toBe('Draft with phone: {guestName}');
		expect(shareMessages.whatsappWithoutPhone).toBe('Draft without phone: {eventTitle}');
	});

	it('falls back to demo shareMessages when draft has none', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				sharing: {
					whatsappTemplate: 'Demo template',
					shareMessages: {
						whatsappWithPhone: 'Demo with phone',
						whatsappWithoutPhone: 'Demo without phone',
					},
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		const shareMessages = sharing.shareMessages as Record<string, string>;
		expect(shareMessages.whatsappWithPhone).toBe('Demo with phone');
		expect(shareMessages.whatsappWithoutPhone).toBe('Demo without phone');
	});

	it('preserves legacy whatsappTemplate from demo', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				sharing: {
					whatsappTemplate: 'Legacy demo template',
					shareMessages: {
						whatsappWithPhone: 'Demo with phone',
						whatsappWithoutPhone: 'Demo without phone',
					},
				},
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		expect(sharing.whatsappTemplate).toBe('Legacy demo template');
	});

	it('returns undefined sharing when no draft or demo sharing exists', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: { ...baseDemoContent, sharing: undefined },
		});

		expect(result.sharing).toBeUndefined();
	});

	it('existing invitations without shareMessages still work through demo whatsappTemplate', () => {
		const result = mapDraftToPublished({
			...baseInput,
			demoContent: {
				...baseDemoContent,
				sharing: { whatsappTemplate: 'Only legacy template' },
			},
		});

		const sharing = result.sharing as Record<string, unknown>;
		expect(sharing.whatsappTemplate).toBe('Only legacy template');
		expect(sharing.shareMessages).toBeUndefined();
	});
});
