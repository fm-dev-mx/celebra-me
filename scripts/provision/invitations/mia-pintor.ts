import { defineCanonicalInvitation } from './canonical-definition.ts';
import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation hosted by the celebrant's family (no parents or godparents listed, by client
 * request). Marine direction uses the reusable `seaside-lineart` envelope and ornament set over
 * celestial-blue. Two session photographs act as chapter interludes: the lifeguard hut closes
 * the shore chapter after family, and the framed meadow opens the way to the venues.
 * Itinerary and background music are configured from the client-confirmed salon schedule and audio track.
 */
export const MIA_TIMING = {
	localDateTime: '2026-12-06T17:00',
	timeZone: 'America/Monterrey',
	startsAtUtc: '2026-12-06T23:00:00.000Z',
} as const;

const CELEBRANT_NAME = 'Mía';
const EVENT_DATE_LABEL = '6 de diciembre de 2026';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-celestial-blue',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	description: `Con cariño le invitamos a celebrar los XV años de ${CELEBRANT_NAME} el ${EVENT_DATE_LABEL}.`,
	theme: { preset: 'celestial-blue', fontFamily: 'serif' },
	eventTiming: MIA_TIMING,
	sectionOrder: [
		'quote',
		'family',
		'countdown',
		'location',
		'itinerary',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		ornaments: 'seaside-lineart',
		intersections: {
			family: { family: 'arch', source: 'quote' },
			itinerary: { family: 'atmospheric-blend', source: 'location' },
			gallery: { family: 'atmospheric-blend', source: 'itinerary' },
			gifts: { family: 'atmospheric-blend', source: 'gallery' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// The photographer mark sits bottom-right: phones show the whole 3:2 frame (profile
			// token) and wider screens crop only the sky. No arch overlaps its bottom edge.
			image: 'gallery09',
			afterSection: 'family',
			alt: 'Mía en la escalera de la caseta de salvavidas, frente a la playa.',
			height: 'medium',
			focalPoint: '100% 100%',
			focalPointDesktop: '100% 100%',
		},
		{
			// Small figure centered in a wide meadow: framed so the whole photograph and its mark
			// stay visible at every width.
			image: 'gallery01',
			afterSection: 'countdown',
			alt: 'Mía sentada en el pasto con vestido azul cielo, rodeada de árboles.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		// The mirror photograph runs to the edges at its own 2:3 proportion (handwritten date and
		// photographer mark intact); the letter adds the written date and the ceremony venue.
		variant: 'bleed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-12-06T12:00:00.000Z',
		backgroundImage: 'hero',
		// The handwritten "Save the date" and the photographer mark stay inside the frame.
		focalPoint: '50% 45%',
		focalPointMobile: '50% 45%',
		presentation: { venueIndex: 0 },
	},
	envelope: {
		disabled: false,
		revealVariant: 'seaside-lineart',
		sealStyle: 'wax',
		sealIcon: 'shell',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV años',
		cardTagline: 'Bajo el cielo, frente al mar',
		// The front carries only the name, the recipient and the seal; the date is revealed
		// inside, and a single instruction sits below the envelope.
		guestLabel: 'Para',
		microcopy: 'Abra su invitación',
	},
	quote: {
		text: '«Hay momentos que, como el mar, se quedan para siempre en el corazón».',
	},
	family: {
		variant: 'standard',
		featuredImage: 'family',
		featuredImageAlt: 'Mía junto al número quince escrito en la arena de la playa.',
		labels: {
			sectionTitle: 'Con el cariño de su familia',
			sectionSubtitle: '',
			sectionMessage:
				'Con la bendición de Dios y todo nuestro cariño, tenemos el gusto de invitarle a celebrar los XV años de Mía. Su presencia hará de este día un recuerdo inolvidable.',
		},
	},
	countdown: {
		// One written fact instead of a clock: "Faltan 60 días" and the date in words.
		variant: 'written-days',
		title: 'Faltan',
		// Empty on purpose: the schema default is a generic closing line.
		footerText: '',
	},
	location: {
		// A printed program: line-drawn church and hall, written times and text links, no cards.
		variant: 'program-sheet',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: {
			showCalendarLinks: true,
			indicationsLayout: 'enclosure',
		},
		introHeading: 'Dónde y cuándo',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			// Enclosure card: icons are not rendered; iconName stays for the schema and editor.
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal',
				text: 'Caballeros, traje. Damas, vestido de noche.',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Azul cielo',
				text: 'Reservado para la quinceañera; le agradecemos elegir otro tono.',
			},
			{
				iconName: 'Forbidden',
				styleVariant: 'default',
				text: 'Celebración solo para adultos.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Misa de acción de gracias',
				venueName: 'Parroquia Nuestra Señora de Lourdes',
				address: 'Ébano 401, Col. Petrolera, Tampico, Tamps.',
				city: 'Tampico',
				date: '2026-12-06',
				time: '17:00',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia+Nuestra+Se%C3%B1ora+de+Lourdes+%C3%89bano+401+Petrolera+Tampico+Tamaulipas',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'SOLEMIO Salón de Eventos',
				address: 'Fco. I. Madero 171, Col. Emilio Carranza, Cd. Madero, Tamps.',
				city: 'Ciudad Madero',
				date: '2026-12-06',
				time: '18:30',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=SOLEMIO+Sal%C3%B3n+de+Eventos+Francisco+I.+Madero+171+Emilio+Carranza+Ciudad+Madero+Tamaulipas',
				isVisible: true,
			},
		],
	},
	itinerary: {
		variant: 'timeline-paper',
		title: 'Itinerario',
		subtitle: 'Momentos especiales de nuestra celebración',
		items: [
			{
				time: '17:00',
				iconName: 'Church',
				label: 'Misa de acción de gracias',
				description: 'Parroquia Nuestra Señora de Lourdes',
			},
			{
				time: '18:30',
				iconName: 'Reception',
				label: 'Recepción',
				description: 'Bienvenida en Salón Solé Mío',
			},
			{
				time: '19:15',
				iconName: 'Sparkles',
				label: 'Entrada de Mía',
				description: 'Entrada triunfal al salón',
			},
			{
				time: '20:00',
				iconName: 'Waltz',
				label: 'Vals y brindis',
				description: 'Momentos especiales con su familia',
			},
			{
				time: '21:00',
				iconName: 'Dinner',
				label: 'Cena',
				description: 'Cena a tres tiempos acompañada de saxofón',
			},
			{
				time: '22:00',
				iconName: 'Party',
				label: 'Baile y fiesta',
				description: 'Baile sorpresa y música con Tracker Sound',
			},
			{
				time: '00:00',
				iconName: 'Calendar',
				label: 'Conclusión',
				description: 'Fin del evento (12:00 a. m.)',
			},
		],
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1791406870/Dancing_Queen_hxqiaf.mp3',
		title: 'Dancing Queen — ABBA',
		// Starts with the envelope tap (inside the gesture, so mobile browsers allow it).
		autoPlay: true,
	},
	gallery: {
		// Contact sheet: two mirrored blocks of a principal portrait and two stacked frames.
		variant: 'mirrored-mosaic',
		// Empty on purpose: no eyebrow above the gallery title (schema default is "Galería").
		eyebrow: '',
		title: 'Entre el mar y el bosque',
		subtitle: 'Retratos que guardan la ilusión de sus quince años.',
		items: [
			// 01 and 09 are the interludes; 07 and 08 retired because they repeat the lifeguard hut
			// of the first interlude. Six portraits read as two mirrored rows of a contact sheet.
			{ image: 'gallery02', alt: 'Mía sentada entre la vegetación, sonriendo.' },
			{
				image: 'gallery10',
				alt: 'Mía de pie junto al tronco de un árbol.',
				focalPoint: '60% 25%',
			},
			{
				image: 'gallery04',
				alt: 'Mía de pie entre el follaje con vestido azul cielo.',
				focalPoint: '50% 25%',
			},
			{
				image: 'gallery03',
				alt: 'Mía sentada sobre un tronco rodeada de plantas.',
				focalPoint: '50% 40%',
			},
			{
				image: 'gallery05',
				alt: 'Mía recargada en un tronco con la mano en el cabello.',
				focalPoint: '50% 25%',
			},
			{ image: 'gallery06', alt: 'Mía de perfil en el campo con vestido azul cielo.' },
		],
	},
	gifts: {
		variant: 'standard',
		title: 'Regalos',
		// A two-line note, as on printed stationery: no catalog card for a single suggestion.
		presentation: 'legend-only',
		subtitle:
			'Su presencia es nuestro mejor regalo. Si desea tener un detalle con Mía, habrá lluvia de sobres el día de la celebración.',
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card.
		variant: 'reply-card',
		title: 'Confirme su asistencia',
		subcopy: 'Su respuesta nos ayuda a preparar cada detalle de esta celebración.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Su pase',
			subtitle: 'Hemos reservado estos lugares en su honor.',
			footerText: 'Confirme a continuación para reservar sus lugares',
		},
		labels: {
			name: 'Su nombre',
			notesPlaceholder: 'Escriba un mensaje para Mía…',
		},
		confirmationMessage: 'Gracias por confirmar. Será un honor compartir este día con usted.',
	},
	thankYou: {
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 40%',
		message:
			'Gracias por acompañarnos en este día tan especial. Su cariño hace de los XV años de Mía un momento que guardaremos siempre.',
		closingName: 'Mía y familia',
		// Footer colophon instead of the generic closing phrase.
		closingPhrase: 'Mía · XV años · Tampico · MMXXVI',
	},
	// A letter needs no site menu: a single RSVP link leaves the header without navigation.
	navigation: [{ label: 'Confirmar', href: '#rsvp' }],
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Le invitamos a celebrar los XV años de Mía el domingo ${EVENT_DATE_LABEL} en Tampico, Tamaulipas.`,
		shareMessages: createShareMessages(
			'Hola {{invitado}}: con mucho cariño le compartimos la invitación a los XV años de Mía.\n\n{{enlace}}\n\nEn ella encontrará los detalles y podrá confirmar su asistencia.',
		),
	},
};

export const miaInvitation = defineCanonicalInvitation({
	slug: 'mia-pintor',
	eventType: 'xv',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	clientName: 'Martha Paz Quintero',
	baseDemoId: 'demo-xv-celestial-blue',
	themeId: 'celestial-blue',
	visualProfileId: 'mia-pintor',
	eventTiming: MIA_TIMING,
	content,
	managedIdentityId: 'dfc141c1-7006-4621-a23c-e7a4e63122bc',
	managedIdentityProvenance: 'persisted',
	hostLoginAlias: 'mia_pintor',
	assetDir: 'src/assets/invitations/mia-pintor',
	assetFiles: {
		hero: 'hero-save-the-date.webp',
		family: 'family-sand-fifteen.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		gallery09: 'gallery-09.webp',
		gallery10: 'gallery-10.webp',
		thankYouPortrait: 'thank-you-balloons.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
