import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation on the storybook-emerald preset: an ivory album that turns into an emerald night
 * from the countdown on, with fine gold butterflies at a few thresholds. The cover frames the
 * portrait in an arch over the name. The five photographs come from an AI session edited from the
 * client's snapshots (accepted by the owner 2026-10-24), upscaled 2× with a resampling filter that
 * invents no detail. Map links are address searches until the client sends pins; the song is
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
		ornaments: 'fine-butterflies',
		intersections: {
			// One designed join: the ivory family chapter closes on the silhouette of a door as the
			// night begins; every other boundary is a clean cut.
			countdown: { family: 'arch', source: 'family' },
		},
	},
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
		sealStyle: 'wax',
		sealIcon: 'wax-monogram',
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
		// One written line: "Faltan 252 días para mi gran noche".
		variant: 'written-days',
		title: 'Faltan',
		footerText: 'para mi gran noche',
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
		introLede: 'Primero daremos gracias en misa y después celebraremos juntos.',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal',
				text: 'Favor de respetar el código de vestimenta.',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Verde esmeralda y dorado',
				text: 'El verde esmeralda y dorado se reservan para la quinceañera.',
			},
			{
				iconName: 'Forbidden',
				styleVariant: 'default',
				text: 'NO NIÑOS',
			},
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
				// Address search until the client sends a pin.
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia+San+Juan+Mar%C3%ADa+Bautista+Vianney+Tepaneca+301+Fraccionamiento+Azteca+Guadalupe+Nuevo+Le%C3%B3n',
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
				// Address search until the client sends a pin.
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Luna+Boutique+Eventos+5+de+Mayo+620+Fraccionamiento+Marte+Guadalupe+Nuevo+Le%C3%B3n',
				isVisible: true,
			},
		],
	},
	itinerary: {
		// A common XV program, drafted for the client's approval.
		variant: 'stacked-cards',
		title: 'Así será mi noche',
		items: [
			{ time: '17:30', iconName: 'Church', label: 'Misa' },
			{ time: '20:00', iconName: 'Reception', label: 'Recepción' },
			{ time: '21:30', iconName: 'Waltz', label: 'Vals' },
			{ time: '22:30', iconName: 'Dinner', label: 'Cena' },
			{ time: '01:00', iconName: 'Party', label: 'Cierre' },
		],
	},
	gallery: {
		// Two portraits side by side: the face sheet and the full gown.
		variant: 'paired-portraits',
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
	managedIdentityProvenance: 'owner-approved',
	lifecycle: 'in_progress',
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
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
