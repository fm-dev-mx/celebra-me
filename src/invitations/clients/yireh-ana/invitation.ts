import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation for Yireh Ana on the storybook-lilac preset, styled as illustrated watercolor
 * stationery: ultra-pale lilac paper, lilac and purple floral corners with a few tiny yellow
 * flowers, and a small yellow bow as the recurring motif (seal, quote mark, program, reply card).
 * The cover follows the client's reference 40 without the books: floral corners above, the name
 * on clean paper and the single oak with one yellow ribbon below. The oak appears only there;
 * the interludes are bespoke stills (lilac branch, bouquet, sealed envelope) without people.
 *
 * The celebrant asked for no personal photos or silhouettes, so the gallery is exempt. The copy
 * speaks of the ties that bind and never of waiting or returning, so it reads well for every
 * guest. The client confirmed on 2026-10-29: no religious ceremony; a thanksgiving celebration at
 * 19:30 led by Pastor Jesús Manuel Ozaeta Pérez in the same hall; an estimated program; a
 * heart-felt gift line with no registry or envelopes; no reserved dress color.
 *
 * Song: "Tie a Yellow Ribbon Round the Ole Oak Tree" by Tony Orlando & Dawn (YouTube: 8N1UutuYlL0).
 * Reception at 19:00 at Salón Casino Imperial, Ciudad Delicias, Chihuahua.
 */
const YIREH_TIMING = {
	localDateTime: '2027-10-23T19:00',
	timeZone: 'America/Chihuahua',
	startsAtUtc: '2027-10-24T01:00:00.000Z',
} as const;

const CELEBRANT_NAME = 'Yireh Ana';
const EVENT_DATE_LABEL = '23 de octubre de 2027';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-storybook-lilac',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	description: `${CELEBRANT_NAME} celebra sus quince años. Sábado ${EVENT_DATE_LABEL}, Salón Casino Imperial, Ciudad Delicias, Chihuahua.`,
	theme: { preset: 'storybook-lilac', fontFamily: 'serif', motion: 'editorial' },
	eventTiming: YIREH_TIMING,
	// Explicit photo-free celebration per celebrant's request: exempt from required gallery section.
	structuralExemptions: ['gallery'],
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'itinerary',
		'family',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			// Three intentional joins across the whole narrative arc (Bridge, Bridge, Climax),
			// preserving clean neutral paper-mist cuts everywhere else.
			countdown: { family: 'overlap', source: 'quote' },
			'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// Bespoke still 1: a lilac and purple bouquet with one yellow flower, tied with ribbon.
			image: 'interludeBouquet',
			afterSection: 'countdown',
			alt: 'Ramo de flores lilas y moradas con una flor amarilla, atado con un listón, en acuarela.',
			height: 'medium',
			presentation: 'framed',
		},
		{
			// Bespoke still 2: the invitation itself, a sealed lilac envelope, before the reply.
			image: 'interludeEnvelope',
			afterSection: 'gifts',
			alt: 'Sobre lila cerrado con un ramito de flores y un moño amarillo, en acuarela.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		variant: 'standard',
		name: CELEBRANT_NAME,
		label: 'Mis XV Años',
		date: '2027-10-23T12:00:00.000Z',
		backgroundImage: 'hero',
		backgroundImageDesktop: 'heroWide',
		scrollLabel: 'Deslice para descubrir',
		// The cover stays while the picture closes in on the oak's yellow ribbon.
		presentation: { timeFormat: '12h', scene: 'cover-approach' },
	},
	envelope: {
		disabled: false,
		revealVariant: 'storybook-butterflies',
		sealStyle: 'wax',
		sealIcon: 'flower',
		sealInitials: 'Y',
		sealColor: 'champagne',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV Años',
		guestLabel: 'Para',
		microcopy: 'Toque el sello para abrir',
	},
	quote: {
		text: 'Hay lazos que nos unen aunque pase el tiempo.',
		closingLine: 'Este día quiero compartirlo con usted.',
	},
	countdown: {
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para celebrar juntos',
	},
	location: {
		variant: 'program-sheet',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: {
			showCalendarLinks: true,
			indicationsLayout: 'enclosure',
		},
		introHeading: 'Lugar y momento',
		introLede:
			'La celebración de acción de gracias estará a cargo del Pastor Jesús Manuel Ozaeta Pérez, en el mismo salón. Le pedimos llegar antes de que comience, para no interrumpir la entrega de los diez elementos simbólicos a Yireh Ana.',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal',
				text: 'Le agradecemos acompañarnos con atuendo formal.',
			},
		],
		venues: [
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Casino Imperial',
				address: 'Carr. Delicias–Ortiz km 1, Centro',
				city: 'Ciudad Delicias, Chihuahua',
				date: '2027-10-23',
				time: '19:00',
				googleMapsUrl:
					'https://maps.google.com/?q=Casino+Imperial,+Carr.+Delicias+-+Ortiz+Km+1,+Ciudad+Delicias,+Chihuahua',
				isVisible: true,
			},
			{
				type: 'ceremony',
				venueEvent: 'Acción de gracias',
				venueName: 'Salón Casino Imperial',
				address: 'Carr. Delicias–Ortiz km 1, Centro',
				city: 'Ciudad Delicias, Chihuahua',
				date: '2027-10-23',
				time: '19:30',
				googleMapsUrl:
					'https://maps.google.com/?q=Casino+Imperial,+Carr.+Delicias+-+Ortiz+Km+1,+Ciudad+Delicias,+Chihuahua',
				isVisible: true,
			},
		],
	},
	itinerary: {
		// Estimated hours agreed with the client on 2026-10-29; the copy says they may shift.
		variant: 'standard',
		// Pinned scene: a yellow ribbon draws itself down the program and ends in the bow.
		scene: 'ribbon-route',
		title: 'Así será mi noche',
		items: [
			{
				time: '19:00',
				iconName: 'Reception',
				label: 'Recepción',
				description: 'Le recibimos en el Salón Casino Imperial.',
			},
			{
				time: '19:30',
				iconName: 'Dove',
				label: 'Acción de gracias',
				description: 'A cargo del Pastor Jesús Manuel Ozaeta Pérez.',
			},
			{
				time: '21:00',
				iconName: 'Waltz',
				label: 'Vals',
				description: 'Enseguida, el brindis.',
			},
			{
				time: '21:30',
				iconName: 'Dinner',
				label: 'Bocadillos y aguas frescas',
				description: 'Después, la pista se abre para bailar.',
			},
			{
				time: '00:00',
				iconName: 'Party',
				label: 'Cierre',
				description: 'Gracias por compartir esta noche.',
			},
		],
		closingNote: 'Horarios aproximados. El salón nos recibe de 7:00 p. m. a medianoche.',
	},
	gifts: {
		// No registry and no envelopes: one gentle line, in the client's words.
		variant: 'standard',
		title: 'Un detalle',
		presentation: 'legend-only',
		subtitle:
			'Si desea tener un detalle con Yireh Ana, lo que disponga su corazón será bien recibido.',
	},
	family: {
		variant: 'standard',
		presentation: 'text-only',
		parents: {
			mother: 'Nichme Margarita Urueta Hermosillo',
		},
		labels: {
			sectionTitle: 'A mi lado',
			sectionSubtitle: '',
			parentsTitle: 'Mi mamá',
			sectionMessage:
				'A usted, mamá, gracias por enseñarme a ser firme y a cuidar los lazos que nos unen.',
		},
	},
	rsvp: {
		variant: 'reply-card',
		title: '¿Me acompaña?',
		subcopy: 'Será un honor contar con su presencia en esta fecha tan significativa.',
		lockedMessage:
			'Esta invitación es personal. Si le llegó directo de mí, abra su enlace para ver su lugar.',
		guestCap: 1,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Su lugar ya está apartado',
			subtitle: 'Lleva su nombre.',
			footerText: 'Confírmelo abajo.',
		},
		labels: {
			name: 'Su nombre',
			notesLabel: 'Un mensaje para mis quince',
			notesPlaceholder: 'Escriba aquí sus palabras...',
			guestHint: 'Tiene {count} lugares. Si vienen menos, ajústelo aquí.',
			stepAttendance: 'Primero lo importante',
			stepDetails: '¿Quiénes le acompañan?',
		},
		confirmationMessage: `Nos vemos el sábado ${EVENT_DATE_LABEL}.`,
		responseMessages: {
			confirmed: {
				title: 'Gracias, {guestName}. Nos vemos pronto.',
				subtitle: 'Si algo cambia, puede modificar su respuesta aquí mismo.',
			},
			declined: {
				title: 'Gracias por avisarme, {guestName}.',
				subtitle: 'Le tendré presente ese día.',
			},
		},
	},
	thankYou: {
		variant: 'portrait-keepsake',
		image: 'wreath',
		focalPoint: '50% 50%',
		message:
			'Hay lazos que el tiempo no desata. Gracias por ser parte de mi historia y por acompañarme en mis quince años.',
		closingName: CELEBRANT_NAME,
		closingPhrase: `Yireh Ana · Mis XV Años · Delicias, Chihuahua · MMXXVII`,
	},
	navigation: [
		{ label: 'Momento', href: '#quote-section' },
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Programa', href: '#itinerary' },
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/yireh-ana/music-b35b0e7c7aea0a11fa5f13fa0537bb5f4df26e09a1e94919362b59f5c671b80e.mp3',
		title: 'Tie a Yellow Ribbon Round the Ole Oak Tree — Tony Orlando & Dawn',
		autoPlay: true,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · Salón Casino Imperial, Ciudad Delicias, Chihuahua.`,
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: celebro mis quince años y quiero que usted esté conmigo. Aquí va su invitación, con su pase y la opción para confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Ya se acerca el día de mis quince años.\n\nSi aún no confirma, puede hacerlo aquí:\n{{enlace}}',
		},
	},
};

export default defineCanonicalInvitation({
	slug: 'yireh-ana',
	eventType: 'xv',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	clientName: 'Nichme Margarita Urueta Hermosillo',
	themeId: 'storybook-lilac',
	visualProfileId: 'yireh-ana',
	eventTiming: YIREH_TIMING,
	content,
	managedIdentityId: '02c6c4ec-cf08-4772-94ff-a550c1158678',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'in_progress',
	hostLoginAlias: 'yireh_ana',
	assetDir: 'src/invitations/clients/yireh-ana/assets',
	assetFiles: {
		hero: 'hero-cover.webp',
		heroWide: 'hero-cover-wide.webp',
		interludeBouquet: 'interlude-bouquet.webp',
		interludeEnvelope: 'interlude-envelope.webp',
		wreath: 'closing-wreath.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
	voice: 'usted',
});
