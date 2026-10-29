import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation for Yireh Ana on the storybook-lilac preset, styled as an illustrated watercolor
 * stationery album with Level-América craft: ultra-pale lilac paper, floral watercolor framing,
 * illustrated interludes of the oak tree and golden ribbons, bespoke envelope and seal, and a
 * poignant narrative of waiting and hope ("el roble y los lazos amarillos que esperan").
 *
 * The celebrant explicitly requested no personal photos or human silhouettes. Photo gallery is
 * deactivated. All unverified client data from v1 has been removed: itinerary synthetic hours
 * are removed, gifts are omitted until the client decides, the ceremony card is hidden from display
 * until its time is confirmed (announced in the intro lede), and guestCap uses the documented default.
 *
 * Song: "Tie a Yellow Ribbon Round the Ole Oak Tree" by Tony Orlando & Dawn (YouTube: 8N1UutuYlL0).
 * Religious ceremony officiated by Pastor Jesús Manuel Ozaeta Pérez at Salón Casino Imperial.
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
		'family',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			// Three intentional joins across the whole narrative arc (Bridge, Bridge, Climax),
			// preserving clean neutral paper-mist cuts everywhere else.
			countdown: { family: 'overlap', source: 'interlude-after-quote' },
			'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// Illustrated interlude 1: watercolor oak branch with lilac blossoms and golden-yellow ribbon.
			image: 'interludeRibbon',
			afterSection: 'quote',
			alt: 'Rama de roble con flores lilas y un lazo amarillo en acuarela.',
			height: 'medium',
			presentation: 'framed',
		},
		{
			// Illustrated interlude 2: ancient oak tree in soft light with fluttering yellow ribbons.
			image: 'interludeOak',
			afterSection: 'countdown',
			alt: 'El roble antiguo con lazos amarillos entre sus ramas, en acuarela.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		variant: 'framed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV Años',
		date: '2027-10-23T12:00:00.000Z',
		backgroundImage: 'hero',
		scrollLabel: 'Deslice para descubrir',
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
		text: 'Dicen que quien espera con el corazón ata un lazo al roble para recordar siempre el camino de vuelta.',
		closingLine:
			'Quince años después, mi lazo lleva su nombre. Deseo de corazón que me acompañe.',
	},
	countdown: {
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para reunirnos bajo el roble',
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
			'La ceremonia religiosa será oficiada por el Pastor Jesús Manuel Ozaeta Pérez en el mismo salón.',
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
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Salón Casino Imperial',
				address: 'Carr. Delicias–Ortiz km 1, Centro',
				city: 'Ciudad Delicias, Chihuahua',
				date: '2027-10-23',
				time: '',
				googleMapsUrl:
					'https://maps.google.com/?q=Casino+Imperial,+Carr.+Delicias+-+Ortiz+Km+1,+Ciudad+Delicias,+Chihuahua',
				isVisible: false,
			},
		],
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
				'A usted, mamá, que me ha enseñado a ser firme como el roble y a guardar siempre un lazo de esperanza en el corazón.',
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
		variant: 'portrait-keepsake',
		image: 'tree',
		focalPoint: '50% 50%',
		message:
			'Hay lazos que nunca se rompen y lugares a los que siempre se puede volver. Gracias por ser parte de mi camino y por acompañarme en mis quince años.',
		closingName: CELEBRANT_NAME,
		closingPhrase: `Yireh Ana · Mis XV Años · Delicias, Chihuahua · MMXXVII`,
	},
	navigation: [
		{ label: 'Momento', href: '#quote-section' },
		{ label: 'Lugar', href: '#event-location' },
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
		hero: 'hero-watercolor.webp',
		interludeRibbon: 'interlude-ribbon.webp',
		interludeOak: 'interlude-oak.webp',
		tree: 'oak-tree.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
	voice: 'usted',
});
