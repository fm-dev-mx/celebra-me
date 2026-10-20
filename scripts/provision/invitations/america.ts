import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation "La noche de las linternas" on the storybook-lilac preset, set as an editorial
 * photo album: lilac paper and mist alternate section by section, and the countdown is the one
 * night band, because the misa starts after sunset. The photographs lead (one color grade baked
 * into every derivative); no ornament set or painted art. Original storybook-lanterns envelope,
 * no characters. Map links are address searches until
 * the client sends pins; the song is omitted until supplied. The program uses the moments and
 * hours most common across our XV invitations (owner-approved placeholder until the client
 * confirms them), gifts are an envelope shower, and replies close 15 days before the event.
 * Adults only, with personalized passes of fixed seats.
 */
const AMERICA_TIMING = {
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
	description: `${CELEBRANT_NAME} cumple quince. Sábado ${EVENT_DATE_LABEL}, Los Mochis.`,
	theme: { preset: 'storybook-lilac', fontFamily: 'serif', motion: 'editorial' },
	eventTiming: AMERICA_TIMING,
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'family',
		'itinerary',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			// Three joins out of eleven boundaries, bridge, bridge, climax; every other boundary is
			// a clean cut between paper and mist. The night rises on a diagonal (deep on the left)
			// under the patio photograph, the save-the-date print hangs out of the night into the
			// paper, and the closing door rises into the reply card under the mirrored arch (crown
			// on the right, against the diagonal). The profile draws the diagonal and reserves
			// each depth.
			countdown: { family: 'overlap', source: 'interlude-after-quote' },
			'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// The lilac look in the brick patio, laid on the mist as a plate before the night.
			image: 'gallery01',
			afterSection: 'quote',
			alt: 'América con vestido lila en un patio de ladrillo, junto a una reja.',
			height: 'medium',
			presentation: 'framed',
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
		guestLabel: 'Para',
		microcopy: 'Toque el sello para abrir',
	},
	quote: {
		text: 'Quince años y una lista muy corta de personas que no pueden faltar.',
		closingLine: 'Usted está en ella.',
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
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis papás',
			godparentsTitle: 'Mis padrinos',
			// Rendered after the names: parents first, then the godparents beside them.
			sectionMessage:
				'Me han visto crecer, y al cabello también. Mis padrinos, siempre a un paso. Esa noche quiero que usted también esté.',
		},
	},
	countdown: {
		// One written line that counts nights: "Faltan 43 noches para encender las linternas".
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para encender las linternas',
		presentationOptions: { dayUnit: 'nights', calendar: { mark: 'sun' } },
	},
	location: {
		variant: 'program-sheet',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: {
			showCalendarLinks: true,
			indicationsLayout: 'enclosure',
			// From the church to the garden: a lantern walks the route while the entries swap.
			scene: 'lantern-route',
		},
		introHeading: 'Apunte la fecha',
		introLede: 'Misa a las seis, fiesta a las ocho.',
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
				text: 'El lila es mi color esa noche; ¿me ayuda a que siga siendo solo mío?',
			},
			{
				iconName: 'Forbidden',
				styleVariant: 'default',
				text: 'Esta vez, solo adultos.',
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
	itinerary: {
		// The moments and hours most common across our XV programs (vals 1h30 after the reception,
		// a surprise dance, dinner an hour later, closing at 01:00), until the client confirms her
		// own.
		variant: 'stacked-cards',
		title: 'Así será mi noche',
		items: [
			{
				time: '18:00',
				iconName: 'Church',
				label: 'Misa',
				description: 'Para empezar, dar gracias.',
			},
			{
				time: '20:00',
				iconName: 'Reception',
				label: 'Recepción',
				description: 'Abren las puertas del jardín.',
			},
			{
				time: '21:30',
				iconName: 'Waltz',
				label: 'Vals',
				description: 'Ensayé más de lo que voy a admitir.',
			},
			{
				time: '22:00',
				iconName: 'Sparkles',
				label: 'Baile sorpresa',
				description: 'No le cuento nada. Llegue a tiempo.',
			},
			{
				time: '22:30',
				iconName: 'Dinner',
				label: 'Cena',
				description: 'A la mesa, que la noche todavía es larga.',
			},
			{
				time: '01:00',
				iconName: 'Party',
				label: 'Cierre',
				description: 'La última canción no se negocia.',
			},
		],
	},
	gallery: {
		// An album page that assembles itself, one look per stretch of the scroll; the door stays
		// for the hero and the closing, and the patio plate opens the night.
		variant: 'album-assemble',
		eyebrow: '',
		title: 'Antes de la noche',
		subtitle: 'Rosa, lila, amarillo. El cabello, el mismo.',
		items: [
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
	gifts: {
		// A two-line note, as on printed stationery: no catalog card for a single suggestion.
		variant: 'standard',
		title: 'Regalos',
		presentation: 'legend-only',
		subtitle: 'Lo importante es que venga. Si quiere traer algo más, habrá lluvia de sobres.',
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card; seats are fixed per guest.
		variant: 'reply-card',
		title: '¿Me acompaña?',
		// Replies close 15 days before the event (owner decision); the canonical RSVP block has no
		// deadline field, so the date lives in the copy and the reminder.
		subcopy: 'Confírmeme antes del viernes 6 de noviembre.',
		lockedMessage:
			'Esta invitación es personal. Si le llegó directo de mí, abra su enlace para ver su lugar.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		// One question at a time on the reply card; the lantern rises when the reply is sent.
		flow: 'steps',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Su lugar ya está apartado',
			subtitle: 'Lleva su nombre.',
			footerText: 'Confírmelo abajo.',
		},
		labels: {
			name: 'Su nombre',
			notesLabel: 'Pida un deseo para mis quince',
			notesPlaceholder: 'Lo guardo para cuando se apaguen las luces.',
			guestHint: 'Tiene {count} lugares. Si vienen menos, ajústelo aquí.',
			stepAttendance: 'Primero lo importante',
			stepDetails: '¿Quiénes le acompañan?',
		},
		// The confirmed card reads title, confirmationMessage, then subtitle.
		confirmationMessage: 'Nos vemos el sábado 21 de noviembre.',
		responseMessages: {
			confirmed: {
				title: 'Ya le espero, {guestName}.',
				subtitle: 'Si algo cambia, puede modificar su respuesta aquí mismo.',
			},
			declined: {
				title: 'Le voy a extrañar, {guestName}.',
				subtitle: 'Gracias por avisarme.',
			},
		},
	},
	thankYou: {
		// Back at the same door, now seated: the story ends where it began, framed differently.
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 40%',
		message: 'Lo que falta no cabe aquí. Se lo enseño el 21 de noviembre.',
		closingName: CELEBRANT_NAME,
		closingPhrase: 'América · XV años · Los Mochis · MMXXVI',
	},
	// A storybook needs no site menu: a single RSVP link leaves the header without navigation.
	navigation: [{ label: 'Confirmar', href: '#rsvp' }],
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · Los Mochis, Sinaloa. Misa a las 18:00 y recepción a las 20:00.`,
		// A custom reminder is sent verbatim to every status, so it never assumes a pending reply.
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: cumplo quince y usted está en mi lista. Aquí va su invitación, con su pase y la opción para confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Las linternas ya casi están listas.\n\nSi aún no confirma, tiene hasta el viernes 6 de noviembre:\n{{enlace}}',
		},
	},
};

export const americaSolisInvitation = defineCanonicalInvitation({
	slug: 'america',
	eventType: 'xv',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	clientName: 'Jenniffer Abigail Mendoza Orduño',
	themeId: 'storybook-lilac',
	visualProfileId: 'america',
	eventTiming: AMERICA_TIMING,
	content,
	managedIdentityId: 'dfb7f4e9-0c68-4c5c-8d2f-9fe01f742fd4',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'america_solis',
	assetDir: 'src/assets/invitations/america',
	// One role per photograph; the closing and og crops are separate derivatives of the seated
	// door photograph.
	assetFiles: {
		hero: 'hero-tower-door.webp',
		interludePregon: 'interlude-pregon.webp',
		thankYouPortrait: 'thank-you-door-seated.webp',
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
