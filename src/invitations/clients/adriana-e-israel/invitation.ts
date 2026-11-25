import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * Wedding invitation on the jewelry-box-wedding preset, recolored by the profile into indigo
 * stationery: an indigo envelope, a full-bleed cover under an indigo veil, and light cards for the
 * inner sections, with silver only as hairlines. The couple's own photographs carry the cover (two
 * portraits that crossfade inside the arch), the quote (two portraits that alternate), a short
 * gallery of their selfies and the closing thank-you. The ceremony is at 17:00; the event timing follows the
 * reception.
 */
const WEDDING_TIMING = {
	localDateTime: '2027-07-10T20:00',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2027-07-11T02:00:00.000Z',
} as const;

const BRIDE_NAME = 'Adriana';
const GROOM_NAME = 'Israel';
const COUPLE_NAME = `${BRIDE_NAME} e ${GROOM_NAME}`;
const EVENT_DATE_LABEL = '10 de julio de 2027';
const CITY_LABEL = 'Oaxaca de Juárez, Oaxaca';

const content: CanonicalEventContentInput = {
	eventType: 'boda',
	isDemo: false,
	title: `Nuestra boda — ${COUPLE_NAME}`,
	description: `${COUPLE_NAME} se casan. Sábado ${EVENT_DATE_LABEL}, ${CITY_LABEL}.`,
	theme: { preset: 'jewelry-box-wedding', motion: 'editorial' },
	eventTiming: WEDDING_TIMING,
	sectionOrder: [
		'quote',
		'family',
		'countdown',
		'location',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		footerVariant: 'framed-closing',
		intersections: {
			quote: { family: 'atmospheric-blend', source: 'hero' },
			family: { family: 'atmospheric-blend', source: 'quote' },
			countdown: { family: 'atmospheric-blend', source: 'family' },
			location: { family: 'atmospheric-blend', source: 'countdown' },
			gallery: { family: 'atmospheric-blend', source: 'location' },
			gifts: { family: 'atmospheric-blend', source: 'gallery' },
			'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
			rsvp: { family: 'atmospheric-blend', source: 'personalized-access' },
			thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
		},
	},
	family: {
		variant: 'framed-groups',
		presentation: 'text-only',
		groups: [
			{
				title: 'Padres de la novia',
				items: [{ name: 'Eduardo Rivas Márquez' }, { name: 'Clemencia Hernández Ramírez' }],
			},
			{
				title: 'Padres del novio',
				items: [
					{ name: 'Luis Hernández Santiago' },
					{ name: 'Virgina Irma Martínez Santiago', deceased: true },
				],
			},
		],
		godparents: [{ name: 'Ramiro Vallejo Ríos' }, { name: 'Jesseni de Vallejo' }],
		labels: {
			sectionTitle: 'Con la bendición de nuestras familias',
			sectionSubtitle: 'Nos acompañan en este día',
			godparentsTitle: 'Nuestros padrinos',
		},
	},
	countdown: {
		variant: 'framed-scene',
		// The section already prints the date between silver rules; an empty footer stops the adapter
		// from repeating it below.
		title: 'Falta muy poco',
		footerText: '',
	},
	location: {
		variant: 'pinned-program',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: { showCalendarLinks: true, indicationsLayout: 'enclosure' },
		introHeading: 'Ceremonia y recepción',
		introLede: CITY_LABEL,
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'A su gusto',
				text: 'Use lo que más le guste para que disfrute con nosotros al máximo.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Parroquia Corazón Eucarístico de Jesús',
				address: 'Claveles 291, Las Flores Sur, Santa Lucía del Camino',
				city: CITY_LABEL,
				date: '2027-07-10',
				time: '17:00',
				googleMapsUrl: 'https://maps.app.goo.gl/gNjW4So5aCaxURWY6',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Santa Mónica',
				address: 'Punta Diamante 108, San Francisco Tutla',
				city: 'Oaxaca',
				date: '2027-07-10',
				time: '20:00',
				// The reception runs until 01:00; the calendar entry blocks those five hours.
				durationMinutes: 300,
				googleMapsUrl: 'https://maps.app.goo.gl/bP3hRCpcCcjKx38w5',
				isVisible: true,
			},
		],
	},
	gallery: {
		variant: 'rising-stack',
		eyebrow: 'Nosotros',
		title: 'Galería',
		// Focal points sit on the faces, which are in the upper part of every selfie. The grid cell of
		// each photograph is set by index in composition.scss (gallery01 takes the wide strip).
		items: [
			{ image: 'gallery01', alt: 'Adriana e Israel sonríen juntos', focalPoint: '50% 10%' },
			{ image: 'gallery02', alt: 'Adriana e Israel en un jardín', focalPoint: '50% 15%' },
			{ image: 'gallery03', alt: 'Adriana e Israel en una cena', focalPoint: '50% 25%' },
			{
				image: 'gallery04',
				alt: 'Adriana e Israel una noche de invierno',
				focalPoint: '50% 15%',
			},
			{ image: 'gallery05', alt: 'Adriana e Israel de camino', focalPoint: '50% 20%' },
		],
	},
	gifts: {
		variant: 'framed-card',
		title: 'Regalos',
		subtitle: 'Si desea tener un detalle con nosotros:',
		items: [
			{
				type: 'cash',
				title: 'Lluvia de sobres',
				text: 'El día de la recepción habrá un buzón para sus sobres.',
			},
		],
	},
	rsvp: {
		variant: 'framed-register',
		title: 'Confirme su asistencia',
		subcopy: 'Nos dará mucho gusto contar con su presencia.',
		lockedMessage: 'Abra el enlace personal que recibió para confirmar su asistencia.',
		// Demo pass only (personalized-only ignores guestCap for submissions): four places, one of
		// them a child, so the preview shows the adults and children split.
		guestCap: 4,
		demoMaxChildren: 1,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'framed-pass',
			title: 'Su invitación',
			subtitle:
				'Hemos reservado estos lugares para usted. Le pedimos respetar el número de pases asignados.',
			// The register now sits right under the pass, so the line points down instead of "at the end".
			footerText: 'Confirme su asistencia aquí abajo para asegurar sus lugares.',
		},
		labels: {
			name: 'Nombre',
			guestCount: 'Personas',
			guestHint: 'Reservamos {count} lugares a su nombre.',
			stepAttendance: '¿Nos acompañará?',
			stepDetails: '¿Cuántos asistirán?',
			confirmButton: 'Enviar confirmación',
			notesLabel: 'Unas palabras para los novios',
			notesPlaceholder:
				'Un deseo, un consejo o un recuerdo para Adriana e Israel. Lo leeremos con mucho cariño.',
		},
		confirmationMessage: 'Gracias por confirmar.',
		responseMessages: {
			confirmed: {
				title: 'Gracias, {guestName}.',
				subtitle: 'Le esperamos el 10 de julio en Oaxaca.',
			},
			declined: {
				title: 'Gracias por avisarnos.',
				subtitle: 'Le tendremos presente ese día.',
			},
		},
	},
	thankYou: {
		// The couple's own words, from the phrase card they sent, over the selfie they chose for the
		// closing, under the indigo veil (the profile maps the veil tokens).
		variant: 'veiled-photo',
		image: 'thankYouPortrait',
		focalPoint: '50% 30%',
		message:
			'Qué suerte tenerlos en este día. Hay momentos que se vuelven todavía más especiales cuando los compartimos con las personas que queremos. Gracias por estar aquí, por acompañarnos y por formar parte de un recuerdo que guardaremos para siempre.',
		closingName: COUPLE_NAME,
		closingPhrase: `Sábado ${EVENT_DATE_LABEL}\n${CITY_LABEL}`,
	},
	navigation: [
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Galería', href: '#galeria' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/boda/adriana-y-israel/music-f880964f3fbec2ce2abd19f433b07f11d2efc4cb97390a366785642da4ac6336.mp3',
		title: 'Regalo de Dios (Saxofón) — Julión Álvarez',
		control: 'equalizer',
		autoPlay: true,
	},
	quote: {
		variant: 'veiled-photo',
		text: 'Con la bendición de Dios y de nuestros padres, tenemos el honor de invitarle a celebrar nuestro matrimonio.',
		closingLine: COUPLE_NAME,
	},
	hero: {
		variant: 'veiled-arch',
		name: BRIDE_NAME,
		secondaryName: GROOM_NAME,
		label: 'Nuestra boda',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2027-07-10T12:00:00.000Z',
		backgroundImage: 'hero',
		// First of the two cover portraits, kept at full width so the whole light star fits the arch;
		// composition.scss crossfades the second over it and slowly pushes this one in on the couple.
		// The asset adds a blurred sky band on top so narrow arches keep both side points; anchor bottom.
		focalPoint: '50% 100%',
		focalPointMobile: '50% 100%',
	},
	envelope: {
		disabled: false,
		// The profile recolors the night envelope to indigo paper with an ivory card.
		revealVariant: 'silver-thread',
		cardLabel: 'BODA',
		envelopeName: COUPLE_NAME,
		teaserDetails: '10 · JUL · 2027 · OAXACA',
		cardName: BRIDE_NAME,
		cardSecondaryName: GROOM_NAME,
		guestPlacement: 'outside-envelope',
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'A·I',
		documentLabel: 'A & I',
		stampText: 'BODA',
		stampYear: '2027',
		microcopy: 'Toque para abrir',
		tooltipText: 'Abrir invitación',
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · ${CITY_LABEL}. Recepción a las 8:00 p. m.`,
	},
};

export default defineCanonicalInvitation({
	slug: 'adriana-e-israel',
	previousSlugs: ['adriana-y-israel'],
	eventType: 'boda',
	title: `Nuestra boda — ${COUPLE_NAME}`,
	clientName: 'Adriana Rivas',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'adriana-e-israel',
	eventTiming: WEDDING_TIMING,
	content,
	managedIdentityId: '219a037e-f9f3-4cdf-9827-3739ea60d14c',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'adriana_rivas',
	assetDir: 'src/invitations/clients/adriana-e-israel/assets',
	// Cropped from the couple's photographs; the two quote photos are wired by the profile.
	assetFiles: {
		hero: 'hero-01.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		thankYouPortrait: 'thank-you.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
