import { defineCanonicalInvitation } from './canonical-definition.ts';
import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/**
 * Owner-authorized local draft. The ten client photographs are the definitive selection;
 * delivery WebP files are prepared from the supplied messaging-app sources.
 */
export const NAYDELIN_TIMING = {
	localDateTime: '2026-10-17T19:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-10-18T02:00:00.000Z',
} as const;

const CELEBRANT_NAME = 'Naydelin Pauleth Paredes Martinez';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-jewelry-box',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	description: 'Le invito a celebrar conmigo mis XV años el 17 de octubre de 2026.',
	theme: { preset: 'jewelry-box', fontFamily: 'serif' },
	eventTiming: NAYDELIN_TIMING,
	sectionOrder: [
		'personalizedAccess',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'gifts',
		'thankYou',
	],
	composition: {
		intersections: { rsvp: { family: 'atmospheric-blend', source: 'itinerary' } },
	},
	hero: {
		variant: 'framed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-10-17T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 50%',
		focalPointMobile: '50% 50%',
		presentation: { venueIndex: 0 },
		scrollLabel: 'Descubra los detalles',
	},
	envelope: {
		disabled: false,
		variant: 'jewelry-box',
		sealStyle: 'wax',
		sealIcon: 'heart',
		sealInitials: 'NP',
		microcopy: 'Toque para abrir la invitación',
	},
	family: {
		variant: 'ceremonial-family',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: { father: 'David Martinez', mother: 'María Cota' },
		godparents: [
			{ name: 'Eduardo Martinez Verdin y Florentina Solis' },
			{ name: 'Eduardo Martinez Solis y Delia Cota' },
		],
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			fatherRole: '',
			motherRole: '',
			godparentsTitle: 'Mis padrinos',
			sectionMessage: '',
		},
	},
	interludes: [
		{
			image: 'interludeReclining',
			afterSection: 'personalizedAccess',
			alt: 'Naydelin recostada con su vestido de gala y su ramo de rosas.',
			height: 'tall',
			focalPoint: '50% 30%',
		},
		{
			image: 'interludeArches',
			afterSection: 'countdown',
			alt: 'Naydelin con su vestido de gala junto a los arcos.',
			height: 'tall',
			focalPoint: '50% 38%',
		},
	],
	gallery: {
		variant: 'paired-feature-band',
		eyebrow: 'Mis XV años',
		title: 'Retratos de Naydelin',
		items: [
			{ image: 'gallery01', alt: 'Retrato de Naydelin junto a un tocador.' },
			{ image: 'gallery02', alt: 'Naydelin sentada en un sillón.' },
			{ image: 'gallery03', alt: 'Naydelin de pie junto a una pared con plantas.' },
			{ image: 'gallery04', alt: 'Naydelin sentada en un sillón con vestido de lunares.' },
			{
				image: 'galleryFeature',
				layoutRole: 'feature',
				alt: 'Retrato horizontal de Naydelin junto al estante.',
			},
		],
	},
	countdown: {
		variant: 'standard',
		title: 'La cuenta regresiva',
		footerText: '',
	},
	location: {
		variant: 'stacked-venue-plates',
		visibility: 'public',
		accessPolicy: { visibility: 'public' },
		presentationOptions: { showNavigationButtons: true, showFlourishes: false },
		introEyebrow: 'Los Mochis, Sinaloa',
		introHeading: '17 de octubre de 2026',
		mapStyle: 'dark',
		indications: [],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia',
				venueName: 'Parroquia El Señor San José',
				address: 'Calle Ignacio Allende y Av. Bienestar, La Bienestar, Los Mochis, Sinaloa',
				date: '17 de octubre de 2026',
				time: '19:00',
				googleMapsUrl: 'https://maps.app.goo.gl/LPtwqZq8qf8Jmkux8',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Granada',
				address: 'Gral. Ángel Flores 525, Centro, Los Mochis, Sinaloa',
				date: '17 de octubre de 2026',
				time: '21:00',
				googleMapsUrl: 'https://maps.app.goo.gl/H6AyoUXDHLmH6QYk6',
				isVisible: true,
			},
		],
	},
	itinerary: {
		variant: 'editorial-ledger',
		title: 'Itinerario',
		items: [
			{
				iconName: 'Church',
				label: 'Ceremonia',
				time: '19:00',
				description: 'Parroquia El Señor San José',
			},
			{
				iconName: 'Reception',
				label: 'Recepción',
				time: '21:00',
				description: 'Salón Granada',
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		title: 'Confirme su asistencia',
		subcopy: 'Le agradeceré confirmar su asistencia desde esta invitación.',
		guestCap: 1,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'formal-pass',
			title: 'Pase personalizado',
			subtitle: '',
			footerText: 'Confirme su asistencia en la sección de RSVP.',
		},
		labels: {
			name: 'Su nombre',
			attendance: 'Asistencia',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
			notesPlaceholder: 'Escriba un mensaje para Naydelin…',
		},
		confirmationMessage: 'Gracias por confirmar. Me dará mucho gusto contar con usted.',
		responseMessages: {
			confirmed: { title: 'Gracias por confirmar', subtitle: '' },
			declined: {
				title: 'Gracias por avisarme',
				subtitle: 'Lamento que no pueda acompañarme.',
			},
		},
	},
	gifts: {
		variant: 'standard',
		title: 'Regalos',
		subtitle:
			'Su presencia es mi mejor regalo. Si desea obsequiarme algo, habrá lluvia de sobres.',
		items: [{ type: 'cash', title: 'Lluvia de sobres' }],
	},
	thankYou: {
		variant: 'portrait-letter',
		image: 'thankYouPortrait',
		focalPoint: '50% 35%',
		message: 'Gracias por acompañarme a celebrar mis XV años.',
		closingName: CELEBRANT_NAME,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Mis XV años — ${CELEBRANT_NAME}`,
		shareMessages: createShareMessages(
			'Hola {{invitado}}, con mucho cariño le compartimos la invitación a los XV años de Naydelin:\n\n{{enlace}}\n\nÁbrala para ver los detalles y confirmar su asistencia.',
		),
	},
};

export const naydelinInvitation = defineCanonicalInvitation({
	slug: 'naydelin-paredes',
	eventType: 'xv',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	clientName: 'Mary Cota',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	visualProfileId: 'naydelin-paredes',
	eventTiming: NAYDELIN_TIMING,
	content,
	managedIdentityId: '69968615-42e9-4830-ab4a-67ada3ca90bf',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'naydelin_paredes',
	assetDir: 'src/assets/invitations/naydelin-paredes',
	assetFiles: {
		hero: 'hero-doorway.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		galleryFeature: 'gallery-feature.webp',
		interludeReclining: 'interlude-gown-reclining.webp',
		interludeArches: 'interlude-gown-arches.webp',
		thankYouPortrait: 'thank-you-bouquet.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
