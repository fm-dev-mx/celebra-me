import type {
	CanonicalVariantRegistryEntry,
	CanonicalVariantSection,
} from '@/lib/invitation/section-variants';

export type SyntheticVariantOverrides = {
	section: CanonicalVariantSection;
	variant: string;
	themePreset?: string;
};

export interface IncompatiblePrerequisiteExpectation {
	expectedPath: (string | number)[];
	expectedMessageSubstring?: string;
}

export const CROSS_PRESET_REPRESENTATIVE_VARIANTS: readonly {
	section: CanonicalVariantSection;
	variant: string;
}[] = [
	{ section: 'hero', variant: 'split-cover' },
	{ section: 'family', variant: 'asymmetric-groups' },
	{ section: 'location', variant: 'split-map' },
	{ section: 'itinerary', variant: 'editorial-program' },
	{ section: 'gallery', variant: 'magazine-spread' },
	{ section: 'gifts', variant: 'editorial-catalog' },
	{ section: 'personalizedAccess', variant: 'formal-pass' },
	{ section: 'rsvp', variant: 'editorial-press-pass' },
	{ section: 'thankYou', variant: 'full-bleed-photo' },
	{ section: 'countdown', variant: 'magazine-folio' },
] as const;

export function buildSyntheticVariantEvent(
	overrides: SyntheticVariantOverrides,
): { id: string; data: Record<string, unknown> } {
	const { section, variant, themePreset = 'jewelry-box' } = overrides;

	const envelopeVariant =
		themePreset === 'celestial-blue' ? 'celestial-blue' : 'jewelry-box';

	const data: Record<string, unknown> = {
		eventType: 'xv',
		isDemo: true,
		templateId: 'xv-synthetic-test',
		_assetSlug: 'demo-xv-jewelry-box',
		title: 'XV Celebración — Modelo Sintético',
		description: 'Invitación sintética para pruebas deterministas de variantes estructurales.',
		theme: {
			fontFamily: 'serif',
			preset: themePreset,
		},
		sectionOrder: [section === 'hero' ? 'family' : section],
		composition: {
			intersections: {},
		},
		hero: {
			name: 'Celebrante Principal',
			label: 'Mis XV Años',
			date: '2026-11-21T18:00:00.000Z',
			backgroundImage: 'hero',
			portrait: 'portrait',
			focalPoint: '50% 40%',
			focalPointMobile: '50% 35%',
			variant: section === 'hero' ? variant : 'standard',
		},
		quote: {
			text: 'Hay momentos en la vida que son inolvidables, y compartirlos con quienes más amamos los hace eternos.',
			author: 'Celebrante',
		},
		countdown: {
			title: '¡Falta muy poco!',
			footerText: 'Prepárate para una noche inolvidable',
			variant: section === 'countdown' ? variant : 'standard',
		},
		family: {
			variant: section === 'family' ? variant : 'standard',
			...(section === 'family' &&
			(variant === 'split-groups' || variant === 'asymmetric-groups')
				? {
						groups: [
							{
								title: 'Familia Paterna',
								items: [{ name: 'Roberto García' }, { name: 'Lucía Pérez' }],
							},
							{
								title: 'Familia Materna',
								items: [{ name: 'Carlos Ramos' }, { name: 'Elena Torres' }],
							},
						],
						godparents: [{ name: 'Carlos Ramos', role: 'Padrino' }],
					}
				: {
						parents: {
							father: 'Roberto García',
							mother: 'Lucía Pérez',
						},
						godparents: [{ name: 'Carlos Ramos', role: 'Padrino' }],
					}),
		},
		location: {
			variant: section === 'location' ? variant : 'standard',
			introEyebrow: 'Monterrey nos espera',
			introHeading: 'Sábado, 21 de noviembre de 2026',
			introLede: 'Acompáñanos a celebrar este día tan especial.',
			indications: [
				{
					iconName: 'Crown',
					styleVariant: 'reserved',
					text: 'El color púrpura está reservado para la festejada.',
				},
				{
					iconName: 'Forbidden',
					styleVariant: 'default',
					text: 'Celebración sin niños.',
				},
			],
			presentationOptions: {
				showFlourishes: true,
			},
			venues: [
				{
					type: 'ceremony',
					venueEvent: 'Ceremonia',
					venueName: 'Parroquia de la Sagrada Familia',
					address: 'Avenida Ayuntamiento s/n, Jardines de Guadalupe',
					city: 'Monterrey',
					date: '21 de noviembre de 2026',
					time: '18:00',
					mapUrl: 'https://maps.app.goo.gl/example1',
					appleMapsUrl: 'https://maps.apple.com/?address=Monterrey',
					googleMapsUrl: 'https://maps.app.goo.gl/example1',
					wazeUrl: 'https://waze.com/ul?q=Parroquia',
					image: 'ceremony',
					coordinates: {
						lat: 25.6816,
						lng: -100.252,
					},
					isVisible: true,
				},
				{
					type: 'reception',
					venueEvent: 'Recepción',
					venueName: 'Quinta Las Flores',
					address: 'Av. Real de Catorce 123, Col. Valle Alto',
					city: 'Monterrey',
					date: '21 de noviembre de 2026',
					time: '20:00',
					mapUrl: 'https://maps.app.goo.gl/example2',
					appleMapsUrl: 'https://maps.apple.com/?address=Valle+Alto',
					googleMapsUrl: 'https://maps.app.goo.gl/example2',
					wazeUrl: 'https://waze.com/ul?q=Quinta+Las+Flores',
					image: 'reception',
					coordinates: {
						lat: 25.5687,
						lng: -100.2488,
					},
					isVisible: true,
				},
			],
			mapStyle: 'dark',
		},
		itinerary: {
			variant: section === 'itinerary' ? variant : 'standard',
			items: [
				{
					iconName: 'Church',
					label: 'Ceremonia Religiosa',
					description: 'Misa de acción de gracias en la parroquia.',
					time: '18:00',
				},
				{
					iconName: 'Reception',
					label: 'Recepción',
					description: 'Bienvenida a los invitados.',
					time: '20:00',
				},
				{
					iconName: 'Waltz',
					label: 'Vals',
					description: 'Vals principal.',
					time: '21:30',
				},
				{
					iconName: 'Dinner',
					label: 'Cena',
					description: 'Cena formal.',
					time: '22:30',
				},
				{
					iconName: 'Sparkles',
					label: 'Cierre',
					description: 'Fin del evento.',
					time: '01:00',
				},
			],
		},
		gallery: {
			eyebrow: 'Galería',
			title: 'Momentos Especiales',
			variant: section === 'gallery' ? variant : 'uniform-grid',
			items:
				section === 'gallery' && variant === 'single-keepsake'
					? [{ key: 'g1', image: 'gallery01', caption: 'Recuerdo Principal' }]
					: section === 'gallery' && variant === 'paired-feature-band'
						? [
								{ key: 'g1', image: 'gallery01' },
								{ key: 'g2', image: 'gallery02', layoutRole: 'feature' },
								{ key: 'g3', image: 'gallery03' },
							]
						: section === 'gallery' && variant === 'feature-stack'
							? [
									{ key: 'g1', image: 'gallery01', layoutRole: 'feature' },
									{ key: 'g2', image: 'gallery02', layoutRole: 'standard' },
									{ key: 'g3', image: 'gallery03', layoutRole: 'wide' },
								]
							: [
									{ key: 'g1', image: 'gallery01', caption: 'Foto 1' },
									{ key: 'g2', image: 'gallery02', caption: 'Foto 2' },
									{ key: 'g3', image: 'gallery03', caption: 'Foto 3' },
								],
		},
		gifts: {
			variant: section === 'gifts' ? variant : 'standard',
			title: 'Mesa de Regalos',
			subtitle: 'Tu presencia es mi mejor regalo, pero si deseas tener un detalle:',
			items: [
				{
					type: 'bank',
					title: 'Transferencia bancaria',
					bankName: 'BBVA',
					clabe: '012345678901234567',
					accountHolder: 'Celebrante Principal',
				},
				{
					type: 'cash',
					title: 'Lluvia de Sobres',
					text: 'Recepción de sobres el día del evento.',
				},
			],
		},
		rsvp: {
			variant: section === 'rsvp' ? variant : 'standard',
			title: 'Confirmación de Asistencia',
			subcopy: 'Favor de confirmar tu asistencia antes del 1 de noviembre.',
			personalizedAccess: {
				variant: section === 'personalizedAccess' ? variant : 'standard',
				title: 'Pase de Acceso',
				subtitle: 'Este pase muestra los accesos asignados.',
				footerText: 'Acceso válido para adultos y niños.',
			},
		},
		thankYou: {
			variant: section === 'thankYou' ? variant : 'standard',
			message: 'Gracias por acompañarme en este día tan especial e inolvidable.',
			closingName: 'Celebrante Principal',
			closingPhrase: 'Con cariño,',
			date: '21 de noviembre de 2026',
			image: 'portrait',
		},
		envelope: {
			variant: envelopeVariant,
		},
		music: {
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/sample.mp3',
			autoPlay: false,
			title: 'Música de fondo',
		},
		navigation: [
			{ label: 'Inicio', href: '#hero' },
			{ label: 'Ubicación', href: '#location' },
		],
		interludes: [],
		sharing: {
			whatsappTemplate: '¡Estás invitado a celebrar mis XV años!',
			shareMessages: {
				invitation: '¡Estás invitado a celebrar mis XV años!',
				reminder: 'Recordatorio: Mis XV años se acercan.',
			},
		},
	};

	return {
		id: 'event-demos/xv/demo-xv-jewelry-box',
		data,
	};
}

export function buildIncompatiblePrerequisiteEvent(
	entry: CanonicalVariantRegistryEntry,
): Record<string, unknown> {
	const validEvent = buildSyntheticVariantEvent({
		section: entry.section,
		variant: entry.variant,
	});
	const data = structuredClone(validEvent.data) as Record<string, unknown>;

	switch (entry.section) {
		case 'hero':
			if (entry.variant === 'editorial-cover' || entry.variant === 'split-cover') {
				const hero = data.hero as Record<string, unknown>;
				delete hero.backgroundImage;
			}
			break;
		case 'family':
			if (
				entry.variant === 'split-groups' ||
				entry.variant === 'asymmetric-groups'
			) {
				const family = data.family as Record<string, unknown>;
				family.groups = [{ title: 'Solo Uno', items: [{ name: 'Solo' }] }];
			}
			break;
		case 'location':
			if (entry.variant === 'split-map') {
				const location = data.location as Record<string, unknown>;
				location.venues = [
					{
						type: 'ceremony',
						venueEvent: 'Ceremonia',
						venueName: 'Parroquia',
						address: 'Calle 1',
						date: '2026-11-21',
						time: '18:00',
						isVisible: true,
					},
				];
			} else if (entry.variant === 'stacked-venue-plates') {
				const location = data.location as Record<string, unknown>;
				location.venues = [(location.venues as Array<unknown>)[0]];
			}
			break;
		case 'itinerary':
			if (
				entry.variant === 'timeline-paper' ||
				entry.variant === 'editorial-ledger' ||
				entry.variant === 'editorial-program'
			) {
				const itinerary = data.itinerary as Record<string, unknown>;
				delete itinerary.items;
			}
			break;
		case 'gallery':
			if (entry.variant === 'single-keepsake') {
				const gallery = data.gallery as Record<string, unknown>;
				gallery.items = [{ image: 'gallery01' }, { image: 'gallery02' }];
			} else if (entry.variant === 'feature-stack') {
				const gallery = data.gallery as Record<string, unknown>;
				gallery.items = [{ image: 'gallery01' }, { image: 'gallery02' }];
			} else if (entry.variant === 'paired-feature-band') {
				const gallery = data.gallery as Record<string, unknown>;
				gallery.items = [
					{ image: 'gallery01' },
					{ image: 'gallery02' },
					{ image: 'gallery03' },
				];
			} else {
				const gallery = data.gallery as Record<string, unknown>;
				delete gallery.items;
			}
			break;
		case 'gifts':
			if (entry.variant === 'editorial-catalog') {
				(data.gifts as Record<string, unknown>).items = [{ type: 'invalid' }];
			}
			break;
		case 'thankYou':
			if (entry.variant === 'full-bleed-photo') {
				const thankYou = data.thankYou as Record<string, unknown>;
				delete thankYou.image;
			} else if (entry.variant === 'editorial-back-cover') {
				const thankYou = data.thankYou as Record<string, unknown>;
				delete thankYou.closingName;
			}
			break;
		case 'countdown':
			delete (data.countdown as Record<string, unknown>).variant;
			break;
		case 'rsvp':
		case 'personalizedAccess':
			delete (data.rsvp as Record<string, unknown>).personalizedAccess;
			break;
	}

	return data;
}

export function getIncompatiblePrerequisiteExpectation(
	entry: CanonicalVariantRegistryEntry,
): IncompatiblePrerequisiteExpectation {
	switch (entry.section) {
		case 'hero':
			return { expectedPath: ['hero', 'backgroundImage'] };
		case 'family':
			return {
				expectedPath: ['family', 'groups'],
				expectedMessageSubstring: '>=2',
			};
		case 'location':
			if (entry.variant === 'split-map') {
				return {
					expectedPath: ['location', 'variant'],
					expectedMessageSubstring: 'split-map requires at least one visible venue',
				};
			}
			return {
				expectedPath: ['location', 'variant'],
				expectedMessageSubstring: 'stacked-venue-plates requires at least two visible venues',
			};
		case 'itinerary':
			return { expectedPath: ['itinerary', 'items'] };
		case 'gallery':
			if (entry.variant === 'single-keepsake') {
				return {
					expectedPath: ['gallery', 'items'],
					expectedMessageSubstring: 'single-keepsake requires exactly one gallery item',
				};
			}
			if (entry.variant === 'feature-stack') {
				return {
					expectedPath: ['gallery', 'items'],
					expectedMessageSubstring: 'feature-stack requires at least three gallery items',
				};
			}
			if (entry.variant === 'paired-feature-band') {
				return {
					expectedPath: ['gallery', 'items'],
					expectedMessageSubstring: 'paired-feature-band requires at least one item with layoutRole=feature',
				};
			}
			return { expectedPath: ['gallery', 'items'] };
		case 'gifts':
			return { expectedPath: ['gifts', 'items', 0] };
		case 'thankYou':
			if (entry.variant === 'full-bleed-photo') {
				return { expectedPath: ['thankYou', 'image'] };
			}
			return { expectedPath: ['thankYou', 'closingName'] };
		case 'countdown':
			return { expectedPath: ['countdown', 'variant'] };
		case 'rsvp':
		case 'personalizedAccess':
			return { expectedPath: ['rsvp', 'personalizedAccess'] };
	}
}
