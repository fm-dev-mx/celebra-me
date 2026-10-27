import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation on the storybook-emerald preset, staged as a printed photo album: ivory paper and
 * sage mist alternate by section, the countdown is one short emerald night between two framed
 * plates, and the closing is the night again. Three joins carry the story: the night rises under
 * the garden plate, the sealed-letter print hangs out of it, and the closing rises into the reply
 * card under an arch. Fine gold butterflies are the only motif. The cover frames the portrait in
 * an arch over the name. The photographs come from an AI session edited from the client's
 * snapshots, upscaled 2× with a resampling filter that invents no detail. The song is
 * omitted until its file is hosted on the media domain. The program, gifts, reply deadline and
 * every guest-facing line are drafts for the client's approval. The family section is «Mi
 * familia» (never «Mis padres») and has no godparents. Adults only, with personalized passes.
 */
const ANDREA_TIMING = {
	localDateTime: '2027-07-03T17:30',
	timeZone: 'America/Monterrey',
	startsAtUtc: '2027-07-03T23:30:00.000Z',
} as const;

const CELEBRANT_NAME = 'Andrea';
const EVENT_DATE_LABEL = '3 de julio de 2027';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-storybook-emerald',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	description: `${CELEBRANT_NAME} cumple quince. Sábado ${EVENT_DATE_LABEL}, Guadalupe, Nuevo León.`,
	theme: { preset: 'storybook-emerald', fontFamily: 'serif', motion: 'editorial' },
	eventTiming: ANDREA_TIMING,
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
			// Three joins in a bridge, bridge, climax cadence; every other boundary is a clean cut
			// between ivory and sage. The night rises on a slow horizon under the garden plate, the
			// sealed-letter print hangs out of the night into the paper, and the closing rises into
			// the reply card under an arch. The profile draws the horizon and reserves each depth.
			countdown: { family: 'overlap', source: 'interlude-after-quote' },
			'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	interludes: [
		{
			// The garden terrace, laid on the sage as an arched plate before the night.
			image: 'interludeGarden',
			afterSection: 'quote',
			alt: 'Andrea con vestido verde esmeralda en una terraza de piedra con plantas.',
			height: 'medium',
			presentation: 'framed',
		},
		{
			// Her hands on the sealed letter: the invitation itself, framed like a print.
			image: 'interludeDetail',
			afterSection: 'countdown',
			alt: 'Las manos de Andrea sostienen un sobre marfil con sello dorado sobre su falda verde.',
			height: 'medium',
			presentation: 'framed',
		},
	],
	hero: {
		// The portrait stands in an arch over the name, as in the accepted first screen.
		variant: 'framed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV Años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2027-07-03T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '62% 30%',
		focalPointMobile: '62% 30%',
		presentation: { venueIndex: 0 },
		scrollLabel: 'Deslice para descubrir',
	},
	envelope: {
		disabled: false,
		variant: 'storybook-emerald',
		revealVariant: 'storybook-butterflies',
		sealStyle: 'wax',
		// Hidden under the profile's pressed ring of leaves; the monogram is struck on top.
		sealIcon: 'flower',
		sealInitials: 'A',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV Años',
		guestLabel: 'Para',
		microcopy: 'Abra su invitación',
	},
	quote: {
		text: 'Hay noches que se esperan toda la vida.',
		closingLine: 'La mía llega el 3 de julio, y quiero que usted esté ahí.',
	},
	family: {
		variant: 'standard',
		presentation: 'with-photo',
		featuredImage: 'family',
		featuredImageAlt:
			'Andrea con vestido verde esmeralda entre Daniel y Gloria en un salón marfil.',
		parentsOrder: 'father-first',
		parents: {
			father: 'Daniel',
			mother: 'Gloria',
		},
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Con amor y gratitud',
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
			// From the church to the hall: a gold butterfly flies the route while the entries swap.
			scene: 'butterfly-route',
		},
		introHeading: 'Dónde y cuándo',
		introLede: 'Primero daremos gracias en misa y después celebraremos juntos.',
		indicationsHeading: 'Vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal · Vestido largo y traje con corbata',
				text: 'Favor de respetar el código de vestimenta',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Verde esmeralda y dorado',
				text: 'Reservados para la quinceañera',
			},
			{ iconName: 'Forbidden', styleVariant: 'default', text: 'NO NIÑOS' },
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Misa',
				venueName: 'Parroquia San Juan María Bautista Vianney',
				address: 'Tepaneca 301, Fracc. Azteca, Guadalupe, N. L.',
				city: 'Guadalupe',
				date: '2027-07-03',
				time: '17:30',
				googleMapsUrl: 'https://maps.app.goo.gl/9SMypwvSG2JTLXUy6',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Luna Boutique Eventos',
				address: '5 de Mayo 620, Fracc. Marte, Guadalupe, N. L.',
				city: 'Guadalupe',
				date: '2027-07-03',
				time: '20:00',
				googleMapsUrl: 'https://maps.app.goo.gl/aUGB93WmVMLgnXKr7',
				isVisible: true,
			},
		],
	},
	itinerary: {
		// Client-requested program; the two performance names are displayed in Spanish.
		variant: 'stacked-cards',
		title: 'Así será mi noche',
		items: [
			{ time: '17:30', iconName: 'Church', label: 'Misa' },
			{ time: '20:00', iconName: 'Reception', label: 'Recepción' },
			{ time: '20:15', iconName: 'Waltz', label: 'Vals' },
			{ time: '21:30', iconName: 'Dinner', label: 'Cena' },
			{ time: '22:30', iconName: 'Party', label: 'Baile sorpresa' },
			{ time: '23:00', iconName: 'Party', label: 'Fiesta con espectáculo' },
			{ time: '01:00', iconName: 'Party', label: 'Cierre' },
		],
	},
	gallery: {
		// An album page that assembles itself, one look per stretch of the scroll.
		variant: 'album-assemble',
		eyebrow: '',
		title: 'Antes de mi gran noche',
		items: [
			{
				image: 'gallery01',
				alt: 'Andrea sonríe con vestido verde esmeralda y tiara dorada en un salón marfil.',
				focalPoint: '50% 25%',
			},
			{
				image: 'gallery02',
				alt: 'Andrea de cuerpo entero con vestido verde esmeralda y un ramo blanco.',
				focalPoint: '50% 30%',
			},
			{
				image: 'albumStaircase',
				alt: 'Andrea baja una escalera clásica con una mano en el barandal.',
				focalPoint: '50% 30%',
			},
			{
				image: 'albumWindow',
				alt: 'Andrea sentada junto a un ventanal, con la falda extendida a su alrededor.',
				focalPoint: '50% 35%',
			},
		],
	},
	gifts: {
		// A two-line note, as on printed stationery.
		variant: 'standard',
		title: 'Lluvia de sobres',
		presentation: 'legend-only',
		subtitle:
			'Su presencia es mi mejor regalo. Si desea tener un detalle conmigo, habrá lluvia de sobres.',
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card; seats are fixed per guest.
		variant: 'reply-card',
		title: '¿Me acompaña?',
		// Replies close 15 days before the event; the canonical RSVP block has no deadline field.
		subcopy: 'Le agradeceré confirmar antes del viernes 18 de junio.',
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
		confirmationMessage: 'Nos vemos el sábado 3 de julio.',
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
		// She looks back over her shoulder: the story closes on the same gown, seen from behind.
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 30%',
		message: 'Gracias por ser parte de mis quince años. Le espero el 3 de julio.',
		closingName: CELEBRANT_NAME,
		closingPhrase: 'Andrea · XV años · Guadalupe · MMXXVII',
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
		url: 'https://media.celebra-me.com/invitations/xv/andrea/music-62b002fb8800ac0195e08cfc858eea3bb836f057f0c148c0d3749ec77d7979ad.mp3',
		title: 'Beauty and the Beast · Solo Piano',
		autoPlay: true,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · Guadalupe, Nuevo León. Misa a las 17:30 y recepción a las 20:00.`,
		// A custom reminder is sent verbatim to every status, so it never assumes a pending reply.
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: cumplo quince y quiero que usted esté conmigo. Aquí va su invitación, con su pase y la opción para confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Ya casi llega mi gran noche.\n\nSi aún no confirma, tiene hasta el viernes 18 de junio:\n{{enlace}}',
		},
	},
};

export default defineCanonicalInvitation({
	slug: 'andrea',
	eventType: 'xv',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	clientName: 'Gloria Garza',
	themeId: 'storybook-emerald',
	visualProfileId: 'andrea',
	eventTiming: ANDREA_TIMING,
	content,
	managedIdentityId: '2096dd70-942d-4d00-ae01-63cb684a81ea',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	// Provisional: the celebrant's surname is not in the intake.
	hostLoginAlias: 'andrea_xv',
	assetDir: 'src/invitations/clients/andrea/assets',
	// One role per photograph; the og crop is a separate derivative of the cover source.
	assetFiles: {
		hero: 'hero-arch.webp',
		family: 'family.webp',
		thankYouPortrait: 'thank-you.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		albumStaircase: 'album-staircase.webp',
		albumWindow: 'album-window.webp',
		interludeGarden: 'interlude-garden.webp',
		interludeDetail: 'interlude-detail.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
