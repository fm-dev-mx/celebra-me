import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation on the storybook-blush preset: a fairy tale told in powder pink and silver, set
 * in the stone castle of the client's photo session. Blush paper and pale mist alternate by
 * section, the countdown is one short rose night between two framed plates, and the closing is
 * the night again. Fine silver butterflies are the only motif. The photographs are the client's
 * final session at their delivered size, cropped per role and never upscaled. The song is the
 * client's pick, hosted on the media domain. The program, gifts, reply deadline and
 * every guest-facing line are drafts for the client's approval.
 */
const NAOMI_TIMING = {
	localDateTime: '2026-12-18T18:30',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-12-19T00:30:00.000Z',
} as const;

const CELEBRANT_NAME = 'Naomi';
// The client asked for both given names on the cover.
const CELEBRANT_FULL_NAME = 'Naomi Alina';
const EVENT_DATE_LABEL = '18 de diciembre de 2026';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	description: `${CELEBRANT_NAME} cumple quince. Viernes ${EVENT_DATE_LABEL}, Guadalajara, Jalisco.`,
	theme: { preset: 'storybook-blush', motion: 'editorial' },
	eventTiming: NAOMI_TIMING,
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
		ornaments: 'fine-butterflies',
		intersections: {
			// Three joins in a bridge, bridge, climax cadence; every other boundary is a clean cut.
			// The night rises under the golden door, the veil print hangs out of the night into the
			// paper, and the closing rises into the reply card under an arch.
			countdown: { family: 'overlap', source: 'interlude-after-quote' },
			'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// The golden castle door and its reflection, framed before the night.
			image: 'interludeDoor',
			afterSection: 'quote',
			alt: 'Naomi con vestido rosa frente a una gran puerta dorada que se refleja en el piso.',
			height: 'medium',
			presentation: 'framed',
		},
		{
			// She lifts her veil at the castle gate, framed like a print.
			image: 'interludeVeil',
			afterSection: 'countdown',
			alt: 'Naomi levanta su velo frente a las torres de un castillo de piedra.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		// The portrait under the rose window stands in an arch over the name.
		variant: 'framed-portrait',
		name: CELEBRANT_FULL_NAME,
		label: 'Mis XV Años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-12-18T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '40% 70%',
		focalPointMobile: '40% 70%',
		presentation: { venueIndex: 0 },
		scrollLabel: 'Deslice para descubrir',
	},
	envelope: {
		disabled: false,
		variant: 'storybook-blush',
		revealVariant: 'storybook-butterflies',
		sealStyle: 'wax',
		// Hidden under the profile's pressed ring of leaves; the monogram is struck on top.
		sealIcon: 'flower',
		sealInitials: 'N',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV Años',
		guestLabel: 'Para',
		microcopy: 'Abra su invitación',
	},
	quote: {
		text: 'Esperé quince años por esta noche.',
		closingLine: 'Me haría muy feliz que usted estuviera ahí.',
	},
	family: {
		// No family photograph was delivered, so the names stand alone.
		variant: 'standard',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: {
			father: 'José Humberto Huerta Navarro',
			mother: 'Martha Leticia Chávez García',
		},
		// The client sent one couple without a role; spelled with the accent pending confirmation.
		godparents: [{ name: 'Christina y Anthony Macías' }],
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			godparentsTitle: 'Mis padrinos',
			sectionMessage: 'Gracias por acompañarme en cada paso hasta esta noche.',
		},
	},
	countdown: {
		variant: 'standard',
		title: 'Faltan',
		footerText: 'para mi gran noche',
		presentationOptions: { visibleUnits: ['days', 'hours', 'minutes', 'seconds'] },
	},
	location: {
		variant: 'program-sheet',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: {
			showCalendarLinks: true,
			indicationsLayout: 'enclosure',
			// From the church to the hall: a silver butterfly flies the route while the entries swap.
			scene: 'butterfly-route',
		},
		introHeading: 'Dos lugares, una noche',
		introLede:
			'A las 18:30 daré gracias en misa; a las 20:15 le espero en La Mattea para celebrar.',
		indicationsHeading: 'Formal',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				text: 'Favor de respetar el código de vestimenta',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Rosa',
				text: 'Reservado para la quinceañera',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Misa',
				venueName: 'Parroquia del Espíritu Santo',
				address: 'C. Miguel Ramos Arizpe 385, Magaña, Guadalajara, Jal.',
				city: 'Guadalajara',
				date: '2026-12-18',
				time: '18:30',
				googleMapsUrl: 'https://maps.app.goo.gl/H9gHpH19ZKGUMyri8',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'La Mattea Eventos',
				address: 'C. Juan de Dios Robledo 1800-A, Balcones del Rosario, Tonalá, Jal.',
				city: 'Tonalá',
				date: '2026-12-18',
				time: '20:15',
				googleMapsUrl: 'https://maps.app.goo.gl/Nw4o7RqdNkLTADQu7',
				isVisible: true,
			},
		],
	},
	itinerary: {
		// Program confirmed by the client.
		variant: 'stacked-cards',
		title: 'Los capítulos de mi noche',
		items: [
			{ time: '18:30', iconName: 'Church', label: 'Misa' },
			{ time: '20:15', iconName: 'Reception', label: 'Recepción' },
			{ time: '21:00', iconName: 'Waltz', label: 'Vals' },
			{ time: '22:00', iconName: 'Dinner', label: 'Cena' },
			{ time: '23:00', iconName: 'Party', label: 'Baile' },
			{ time: '02:00', iconName: 'Sparkles', label: 'Despedida' },
		],
	},
	gallery: {
		// An album page that assembles itself, one look per stretch of the scroll.
		variant: 'album-assemble',
		eyebrow: '',
		title: 'Mi cuento de hadas',
		items: [
			{
				image: 'gallery01',
				alt: 'Naomi sonríe con un ramo de rosas frente a la puerta de un castillo.',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery02',
				alt: 'Naomi de espaldas, con el gran moño de su vestido rosa, ante las torres del castillo.',
				focalPoint: '50% 55%',
			},
			{
				image: 'gallery03',
				alt: 'Naomi con su ramo ante el arco de piedra del castillo.',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery04',
				alt: 'Naomi de perfil, con su tiara y su ramo de rosas, bajo la luz cálida del castillo.',
				focalPoint: '50% 40%',
			},
		],
	},
	gifts: {
		// Client-supplied Liverpool registry plus a cash box; the subtitle adapts the client's own wording.
		variant: 'standard',
		title: 'Mesa de regalos',
		presentation: 'catalog',
		subtitle:
			'Su regalo es totalmente opcional: puede elegir de mi mesa o el detalle que usted guste. Lo más valioso para mí es contar con su presencia en este día tan especial.',
		items: [
			{
				type: 'store',
				title: 'Liverpool',
				url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/60070167',
				tableNumber: '60070167',
			},
			{
				type: 'cash',
				title: 'Buzón de sobres',
				text: 'Si prefiere obsequiar efectivo, habrá un buzón de sobres en la recepción.',
			},
		],
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card; seats are fixed per guest.
		variant: 'reply-card',
		title: '¿Me acompaña?',
		// Replies close two weeks before the event; the canonical RSVP block has no deadline field.
		subcopy: 'Le agradeceré confirmar antes del viernes 4 de diciembre.',
		lockedMessage:
			'Cada pase de esta noche lleva un nombre. Abra el enlace que le envié para ver el suyo.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Pase personal e intransferible',
			subtitle: 'Su lugar ya está apartado.',
			footerText: 'Confírmeme su llegada aquí abajo.',
		},
		labels: {
			name: 'Su nombre',
			guestHint: 'Tiene {count} lugares. Si vienen menos, ajústelo aquí.',
			stepAttendance: '¿Contamos con usted?',
			stepDetails: '¿Cuántos llegan, contándose usted?',
			// The client asked for the names of everyone attending; the notes step collects them.
			notesLabel: 'Nombres de quienes asistirán',
			notesPlaceholder: 'Escriba el nombre de cada persona que llegará',
		},
		confirmationMessage: 'Le espero el viernes 18 de diciembre, desde la misa de las 18:30.',
		responseMessages: {
			confirmed: {
				title: 'Su lugar está listo, {guestName}.',
				subtitle: 'Si sus planes cambian, aquí mismo puede corregir su respuesta.',
			},
			declined: {
				title: 'Me hará falta, {guestName}.',
				subtitle: 'Gracias por decírmelo a tiempo.',
			},
		},
	},
	thankYou: {
		// The castle again, seen from afar: the story closes at the gate where it began.
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 75%',
		message: 'Gracias por ser parte de mis quince años. Le espero el 18 de diciembre.',
		closingName: CELEBRANT_NAME,
		closingPhrase: 'Naomi · XV años · Guadalajara · MMXXVI',
	},
	navigation: [
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Programa', href: '#itinerary' },
		{ label: 'Galería', href: '#galeria' },
		{ label: 'Regalos', href: '#regalos' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/naomi-huerta/music-2d774ae1246bc0b460b18138b1d7955a35311347a64c3b7db3d00c4359aee2cb.mp3',
		title: 'So This Is Love — Cinderella',
		control: 'equalizer',
		autoPlay: true,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Viernes ${EVENT_DATE_LABEL} · Guadalajara, Jalisco. Misa a las 18:30 y recepción a las 20:15.`,
		// A custom reminder is sent verbatim to every status, so it never assumes a pending reply.
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: el 18 de diciembre celebro mis quince y quiero verle ahí. En este enlace está su pase y puede confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Ya casi es 18 de diciembre.\n\nSi aún no confirma, tiene hasta el viernes 4 de diciembre:\n{{enlace}}',
		},
	},
};

export default defineCanonicalInvitation({
	slug: 'naomi-huerta',
	eventType: 'xv',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	// Owner-confirmed: the mother is the contracting client.
	clientName: 'Martha Leticia Chávez García',
	themeId: 'storybook-blush',
	visualProfileId: 'naomi-huerta',
	eventTiming: NAOMI_TIMING,
	content,
	managedIdentityId: '19b65fbe-7082-44d6-9df6-75992163d044',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'naomi_xv',
	assetDir: 'src/invitations/clients/naomi-huerta/assets',
	// One role per crop; the thank-you portrait and the og card share one source photograph.
	assetFiles: {
		hero: 'hero.webp',
		thankYouPortrait: 'thank-you.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		// A detail of the hero photograph: the tiara, the profile and the bouquet.
		gallery04: 'gallery-04.webp',
		interludeDoor: 'interlude-door.webp',
		interludeVeil: 'interlude-veil.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
