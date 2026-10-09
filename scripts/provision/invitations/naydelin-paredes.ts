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
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1790729635/Imagine_-_John_Lennon_The_Plastic_Ono_Band_ndhjjv.mp3',
		title: 'Imagine - John Lennon',
		autoPlay: true,
	},
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
		intersections: {
			rsvp: { family: 'arch', source: 'itinerary' },
			thankYou: { family: 'atmospheric-blend', source: 'gifts' },
		},
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
		// "Naydelin" leads in script; "Pauleth Paredes Martinez" follows as a tracked line.
		presentation: { venueIndex: 0, nameLeadWords: 1 },
		scrollLabel: 'Descubra los detalles',
	},
	envelope: {
		disabled: false,
		variant: 'jewelry-box',
		sealStyle: 'wax',
		// Embossed wax medallion carries the NP initials; the profile tints it champagne gold.
		sealIcon: 'wax-medallion',
		sealInitials: 'NP',
		cardTagline: 'Sábado 17 de octubre de 2026',
		microcopy: 'Toque para abrir la invitación',
		teaserDetails: '17 de octubre de 2026 · Los Mochis',
	},
	family: {
		variant: 'ceremonial-family',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: { father: 'David Martinez', mother: 'María Cota' },
		// Non-breaking spaces keep each person's full name on one line; pairs break at "y".
		godparents: [
			{ name: 'Eduardo\u00a0Martinez\u00a0Verdin y\u00a0Florentina\u00a0Solis' },
			{ name: 'Eduardo\u00a0Martinez\u00a0Solis y\u00a0Delia\u00a0Cota' },
		],
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			fatherRole: '',
			motherRole: '',
			godparentsTitle: 'Mis padrinos',
			sectionMessage: 'Con la bendición de Dios y el cariño de mi familia.',
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
			focalPointDesktop: '50% 22%',
		},
	],
	gallery: {
		variant: 'paired-feature-band',
		eyebrow: 'Sesión de fotos',
		title: 'Retratos de Naydelin',
		items: [
			{ image: 'gallery01', alt: 'Retrato de Naydelin junto a un tocador.' },
			{ image: 'gallery02', alt: 'Naydelin sentada en un sillón.' },
			// The feature band separates the two portraits taken at the same shelf.
			{
				image: 'galleryFeature',
				layoutRole: 'feature',
				alt: 'Retrato horizontal de Naydelin junto al estante.',
			},
			{ image: 'gallery03', alt: 'Naydelin de pie junto a una pared con plantas.' },
			{ image: 'gallery04', alt: 'Naydelin sentada en un sillón con vestido de lunares.' },
		],
	},
	countdown: {
		variant: 'standard',
		title: 'Falta muy poco',
		footerText: '',
	},
	location: {
		variant: 'stacked-venue-plates',
		visibility: 'public',
		accessPolicy: { visibility: 'public' },
		presentationOptions: { showNavigationButtons: true, showFlourishes: false },
		introEyebrow: 'Los Mochis, Sinaloa',
		introHeading: 'Ceremonia y recepción',
		mapStyle: 'dark',
		indicationsHeading: 'Para tomar en cuenta',
		indications: [
			{ iconName: 'Forbidden', styleVariant: 'default', text: 'Celebración sin niños.' },
			{
				iconName: 'Calendar',
				styleVariant: 'default',
				text: 'Confirme su asistencia a más tardar el <strong>sábado 10 de octubre</strong>.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Parroquia El Señor San José',
				address:
					'Calle Ignacio Allende y Av. Bienestar, Col. La Bienestar, Los Mochis, Sinaloa',
				date: '17 de octubre de 2026',
				time: '19:00',
				googleMapsUrl: 'https://maps.app.goo.gl/LPtwqZq8qf8Jmkux8',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Granada',
				address: 'Gral. Ángel Flores 525, Col. Centro, Los Mochis, Sinaloa',
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
		// Waltz, dinner, and closing times are owner estimates pending confirmation.
		items: [
			{
				iconName: 'Church',
				label: 'Ceremonia religiosa',
				time: '19:00',
				description: 'Parroquia El Señor San José',
			},
			{
				iconName: 'Reception',
				label: 'Recepción',
				time: '21:00',
				description: 'Salón Granada',
			},
			{
				iconName: 'Waltz',
				label: 'Vals',
				time: '22:00',
				description: 'Mi primer baile de la noche.',
			},
			{
				iconName: 'Dinner',
				label: 'Cena',
				time: '22:30',
				description: 'Compartamos la mesa y la alegría de esta noche.',
			},
			{
				iconName: 'Party',
				label: 'Cierre',
				time: '02:00',
				description: 'Los últimos momentos de la celebración.',
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		title: 'Confirme su asistencia',
		subcopy: 'Le agradeceré confirmar su asistencia a más tardar el sábado 10 de octubre.',
		guestCap: 1,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'formal-pass',
			// Admission-ticket presentation: notched stub, perforation, and monogram.
			ticket: { signature: 'Naydelin', monogram: 'NP' },
			title: 'Pase de acceso',
			subtitle: 'Con cariño le espero para celebrar mis XV años.',
		},
		labels: {
			name: 'Su nombre',
			attendance: 'Asistencia',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
			notesLabel: 'Un mensaje para Naydelin (opcional)',
			notesPlaceholder: 'Escriba unas palabras para Naydelin…',
		},
		confirmationMessage: 'Gracias por confirmar. Me dará mucho gusto celebrar con usted.',
		responseMessages: {
			confirmed: {
				title: 'Gracias por confirmar',
				subtitle: 'Le espero el sábado 17 de octubre.',
			},
			declined: {
				title: 'Gracias por avisarme',
				subtitle: 'Lamento que no pueda acompañarme; le tendré presente en este día.',
			},
		},
	},
	gifts: {
		variant: 'standard',
		title: 'Regalos',
		subtitle:
			'Su presencia es mi mejor regalo. Si además desea tener un detalle conmigo, esta es mi sugerencia:',
		items: [{ type: 'cash', title: 'Lluvia de sobres' }],
	},
	thankYou: {
		variant: 'portrait-letter',
		image: 'thankYouPortrait',
		focalPoint: '50% 35%',
		message:
			'Gracias por ser parte de este día tan especial. Su compañía hará de mis XV años un recuerdo inolvidable.',
		closingName: CELEBRANT_NAME,
		// Same hierarchy as the hero: "Naydelin" signs in script above the full name.
		closingNameLeadWords: 1,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription:
			'Le invito a celebrar mis XV años el sábado 17 de octubre de 2026 en Los Mochis.',
		shareMessages: createShareMessages(
			'Hola {{invitado}}: con mucho cariño le compartimos la invitación a los XV años de Naydelin.\n\n{{enlace}}\n\nEn ella encontrará los detalles y podrá confirmar su asistencia.',
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
	lifecycle: 'in_progress',
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
