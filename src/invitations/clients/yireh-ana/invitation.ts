import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation for Yireh Ana on the storybook-lilac preset, styled as an illustrated watercolor
 * stationery piece: ultra-pale lilac paper, floral corners in watercolor lilac and purple tones with
 * small yellow wildflowers and gold/yellow ribbon accents, and a majestic watercolor oak tree at the
 * base. The celebrant explicitly requested no personal photographs or human silhouettes; photo
 * gallery sections are turned off. The song is the classic "Tie a Yellow Ribbon Round the Ole Oak
 * Tree", hosted on Cloudflare R2 at 64 kbps MP3. Religious ceremony officiated by Pastor Jesús
 * Manuel Ozaeta Pérez in the same venue; reception at 7:00 pm at Salón Casino Imperial in Ciudad
 * Delicias, Chihuahua.
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
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'family',
		'itinerary',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			countdown: { family: 'overlap', source: 'quote' },
			location: { family: 'atmospheric-blend', source: 'countdown' },
			family: { family: 'atmospheric-blend', source: 'location' },
			itinerary: { family: 'atmospheric-blend', source: 'family' },
			gifts: { family: 'atmospheric-blend', source: 'itinerary' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	hero: {
		variant: 'standard',
		name: CELEBRANT_NAME,
		label: 'Mis XV Años',
		date: '2027-10-23T12:00:00.000Z',
		backgroundImage: 'hero',
		scrollLabel: 'Deslice para descubrir',
	},
	envelope: {
		disabled: false,
		variant: 'storybook-lilac',
		sealStyle: 'wax',
		sealIcon: 'flower',
		sealInitials: 'Y',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV Años',
		guestLabel: 'Para',
		microcopy: 'Abra su invitación',
	},
	quote: {
		text: 'Hay momentos que marcan el corazón y personas que los hacen inolvidables.',
		closingLine: 'Deseo compartir con usted la dicha de llegar a mis quince años.',
	},
	countdown: {
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para mis quince años',
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
		introLede:
			'La ceremonia religiosa será oficiada por el Pastor Jesús Manuel Ozaeta Pérez en el mismo salón.',
		indicationsHeading: 'Detalles del evento',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Código de vestimenta',
				text: 'Formal',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Salón Casino Imperial',
				address: 'Carr. Delicias–Ortiz km 1, Centro',
				city: 'Ciudad Delicias, Chihuahua',
				date: '2027-10-23',
				time: 'Por definir',
				googleMapsUrl:
					'https://maps.google.com/?q=Casino+Imperial,+Carr.+Delicias+-+Ortiz+Km+1,+Ciudad+Delicias,+Chihuahua',
				isVisible: true,
			},
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
		],
	},
	family: {
		variant: 'standard',
		presentation: 'text-only',
		parents: {
			mother: 'Nichme Margarita Urueta Hermosillo',
		},
		labels: {
			sectionTitle: 'Con amor y gratitud',
			sectionSubtitle: '',
			parentsTitle: 'Mi mamá',
			sectionMessage: 'Gracias por su amor, su guía y su apoyo incondicional en cada paso.',
		},
	},
	itinerary: {
		variant: 'stacked-cards',
		title: 'Así será mi noche',
		items: [
			{ time: '19:00', iconName: 'Reception', label: 'Recepción' },
			{ time: '20:30', iconName: 'Waltz', label: 'Vals' },
			{ time: '21:30', iconName: 'Dinner', label: 'Cena' },
			{ time: '23:00', iconName: 'Party', label: 'Celebración' },
		],
	},
	gifts: {
		variant: 'standard',
		title: 'Lluvia de sobres',
		presentation: 'legend-only',
		subtitle:
			'Su presencia es mi mejor regalo. Si desea tener un detalle conmigo, habrá lluvia de sobres.',
	},
	rsvp: {
		variant: 'reply-card',
		title: '¿Me acompaña?',
		subcopy: 'Le agradeceré confirmar su asistencia.',
		lockedMessage:
			'Esta invitación es personal. Si le llegó directo de mí, abra su enlace para ver su lugar.',
		guestCap: 2,
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
			'Gracias por acompañarme en mis quince años y por ser parte de los recuerdos más hermosos de mi vida.',
		closingName: CELEBRANT_NAME,
		closingPhrase: `Yireh Ana · Mis XV Años · Delicias, Chihuahua · MMXXVII`,
	},
	navigation: [
		{ label: 'Momento', href: '#quote-section' },
		{ label: 'Dónde y cuándo', href: '#event-location' },
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Programa', href: '#itinerary' },
		{ label: 'Regalos', href: '#regalos' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/yireh-ana/music-b35b0e7c7aea0a11fa5f13fa0537bb5f4df26e09a1e94919362b59f5c671b80e.mp3',
		title: 'Tie a Yellow Ribbon Round the Ole Oak Tree',
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
		tree: 'oak-tree.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
	voice: 'usted',
});
