import { defineCanonicalInvitation } from './canonical-definition.ts';
import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation "La noche de las linternas" on the storybook-lilac preset: lilac paper at the
 * tower door (hero, quote, family) and a violet night with rising lanterns from the countdown on,
 * because the misa starts after sunset and the reception is a night garden. Original
 * storybook-lanterns envelope and ornaments, no characters. Map links are address searches until
 * the client sends pins; song, gifts and itinerary are omitted until supplied. Adults only, with
 * personalized passes of fixed seats.
 */
export const AMERICA_TIMING = {
	localDateTime: '2026-11-21T18:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-11-22T01:00:00.000Z',
} as const;

const CELEBRANT_NAME = 'América';
const EVENT_DATE_LABEL = '21 de noviembre de 2026';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-storybook-lilac',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	description: `Con cariño le invitamos a celebrar los XV años de ${CELEBRANT_NAME} el ${EVENT_DATE_LABEL}.`,
	theme: { preset: 'storybook-lilac', fontFamily: 'serif' },
	eventTiming: AMERICA_TIMING,
	sectionOrder: [
		'quote',
		'family',
		'countdown',
		'location',
		'gallery',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		ornaments: 'storybook-lanterns',
		intersections: {
			// Two doors bound the story: the paper rises into the tower door under an arch, and the
			// closing returns to the door under the mirrored arch, drawn in gold over the night.
			// Between them, two light handoffs: nightfall out of the door photograph, and the reply
			// card opening out of the contact sheet. Every other boundary stays neutral.
			quote: { family: 'arch', source: 'hero' },
			countdown: { family: 'atmospheric-blend', source: 'interlude-after-family' },
			'personalized-access': { family: 'atmospheric-blend', source: 'gallery' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// Seated at the iron door: she has left the tower. Phones keep her face in frame.
			image: 'interludeDoor',
			afterSection: 'family',
			alt: 'América con vestido lila, sentada frente a una puerta de hierro forjado.',
			height: 'medium',
			focalPoint: '52% 30%',
			focalPointDesktop: '52% 26%',
		},
		{
			// The save-the-date paper she holds announces the night, framed like a print.
			image: 'interludePregon',
			afterSection: 'countdown',
			alt: 'América sostiene un periódico con la fecha 21 de noviembre de 2026.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		// The whole arch of the iron and stone door runs to the edges: the tower of the story.
		variant: 'bleed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-11-21T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 55%',
		focalPointMobile: '50% 55%',
		presentation: { venueIndex: 0 },
	},
	envelope: {
		disabled: false,
		revealVariant: 'storybook-lanterns',
		sealStyle: 'wax',
		sealIcon: 'sunburst',
		sealInitials: 'A',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV años',
		cardTagline: 'Érase una vez una noche de linternas',
		guestLabel: 'Para',
		microcopy: 'Toque el sello para abrir',
	},
	quote: {
		text: 'Durante quince años soñé con esta noche. Hoy se encienden las linternas y quiero que usted esté aquí para verlas conmigo.',
	},
	family: {
		variant: 'standard',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: {
			father: 'Cruz Abiel Solís Araux',
			mother: 'Jenniffer Abigail Mendoza Orduño',
		},
		godparents: [
			{ name: 'Wilton Galdámez', role: 'Padrino' },
			{ name: 'Brianda Galdámez', role: 'Madrina' },
		],
		labels: {
			sectionTitle: 'Con la bendición de Dios y el amor de mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			godparentsTitle: 'Mis padrinos',
			sectionMessage: 'Tengo el honor de invitarle a celebrar mis quince años.',
		},
	},
	countdown: {
		// One written line that counts nights: "Faltan 43 noches para ver las linternas".
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para ver las linternas',
		presentationOptions: { dayUnit: 'nights' },
	},
	location: {
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
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal',
				text: 'Le agradecemos acompañarnos con atuendo formal.',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Lila',
				text: 'Reservado para la quinceañera; le agradecemos elegir otro tono.',
			},
			{
				iconName: 'Forbidden',
				styleVariant: 'default',
				text: 'Con mucho cariño, esta celebración es solo para adultos.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Misa',
				venueName: 'Parroquia Cristo Rey',
				address: 'San Francisco esquina con Oaxaca, col. Estrella, Los Mochis, Sin.',
				city: 'Los Mochis',
				date: '2026-11-21',
				time: '18:00',
				// Address search until the client sends a pin.
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia+Cristo+Rey+San+Francisco+y+Oaxaca+Colonia+Estrella+Los+Mochis+Sinaloa',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Jardín Los Mangos',
				address:
					'Carretera Los Mochis–Topolobampo, entronque a 9 de Diciembre, Los Mochis, Sin.',
				city: 'Los Mochis',
				date: '2026-11-21',
				time: '20:00',
				// Not indexed online: address search until the client sends a pin.
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Los+Mangos+Carretera+Los+Mochis+Topolobampo+9+de+Diciembre',
				isVisible: true,
			},
		],
	},
	gallery: {
		// Contact sheet of the four looks; the tower door stays for the hero and the closing.
		variant: 'mirrored-mosaic',
		eyebrow: '',
		title: 'Antes de la noche',
		subtitle: 'Retratos de los días que esperaron esta fecha.',
		items: [
			{
				image: 'gallery01',
				alt: 'América con vestido lila en un patio de ladrillo, junto a una reja.',
				focalPoint: '55% 30%',
			},
			{
				image: 'gallery02',
				alt: 'América con vestido rosa en un café con flores y un espejo dorado.',
				focalPoint: '45% 35%',
			},
			{
				image: 'gallery03',
				alt: 'América con vestido rosa junto a una columna blanca.',
				focalPoint: '55% 30%',
			},
			{
				image: 'gallery04',
				alt: 'América en estudio con vestido rosa, guantes blancos y lentes de corazón.',
				focalPoint: '35% 35%',
			},
			{
				image: 'gallery05',
				alt: 'América de pie en estudio con vestido rosa de tul y guantes blancos.',
				focalPoint: '50% 30%',
			},
			{
				image: 'gallery06',
				alt: 'América sentada en una silla con vestido amarillo y guantes blancos.',
				focalPoint: '50% 30%',
			},
		],
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card; seats are fixed per guest.
		variant: 'reply-card',
		title: 'Confirme su asistencia',
		subcopy: 'Su respuesta nos ayuda a preparar cada detalle de esta noche.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Su lugar en el reino',
			subtitle: 'Hemos reservado estos lugares en su honor.',
			footerText: 'Confirme a continuación para reservar sus lugares',
		},
		labels: {
			name: 'Su nombre',
			notesPlaceholder: 'Escriba un mensaje para América…',
		},
		confirmationMessage: 'Gracias por confirmar. Nos vemos bajo las linternas.',
	},
	thankYou: {
		// Back at the same door, closer and smiling: the story ends where it began.
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 30%',
		message: 'Gracias por ser parte de mi historia. Nos vemos bajo las linternas.',
		closingName: CELEBRANT_NAME,
		closingPhrase: 'América · XV años · Los Mochis · MMXXVI',
	},
	// A storybook needs no site menu: a single RSVP link leaves the header without navigation.
	navigation: [{ label: 'Confirmar', href: '#rsvp' }],
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Le invitamos a celebrar los XV años de América el sábado ${EVENT_DATE_LABEL} en Los Mochis, Sinaloa.`,
		shareMessages: createShareMessages(
			'Hola {{invitado}}: con mucho cariño le compartimos la invitación a los XV años de América.\n\n{{enlace}}\n\nEn ella encontrará los detalles y podrá confirmar su asistencia.',
		),
	},
};

export const americaSolisInvitation = defineCanonicalInvitation({
	slug: 'america',
	eventType: 'xv',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	clientName: 'Jenniffer Abigail Mendoza Orduño',
	baseDemoId: 'demo-xv-storybook-lilac',
	themeId: 'storybook-lilac',
	visualProfileId: 'america',
	eventTiming: AMERICA_TIMING,
	content,
	managedIdentityId: 'dfb7f4e9-0c68-4c5c-8d2f-9fe01f742fd4',
	managedIdentityProvenance: 'owner-approved',
	lifecycle: 'in_progress',
	hostLoginAlias: 'america_solis',
	assetDir: 'src/assets/invitations/america',
	// One role per photograph; the og crop is a separate derivative of the bleed interlude.
	assetFiles: {
		hero: 'hero-tower-door.webp',
		interludeDoor: 'interlude-door.webp',
		interludePregon: 'interlude-pregon.webp',
		thankYouPortrait: 'thank-you-door.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
