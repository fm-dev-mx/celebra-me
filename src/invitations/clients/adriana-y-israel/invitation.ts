import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * Wedding invitation on the jewelry-box-wedding preset, recolored by the profile into indigo
 * stationery: an indigo envelope, a full-bleed cover under an indigo veil, and light cards for the
 * inner sections, with gold only as hairlines. The couple's own photographs carry the cover (their
 * portrait under the tree), the quote (the flower arch) and a short gallery of their selfies. The
 * ceremony time is pending at the parish, so the ceremony entry carries no time and no calendar
 * link; the event timing follows the reception.
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
		// The section already prints the date between gold rules; an empty footer stops the adapter
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
				address: 'Calle Claveles 102, col. Las Flores',
				city: CITY_LABEL,
				date: '2027-07-10',
				// Pending at the parish: an empty time renders no hour and no calendar link.
				time: '',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia+Coraz%C3%B3n+Eucar%C3%ADstico+de+Jes%C3%BAs+Claveles+102+Oaxaca',
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
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+Santa+M%C3%B3nica+San+Francisco+Tutla+Oaxaca',
				isVisible: true,
			},
		],
	},
	gallery: {
		variant: 'rising-stack',
		eyebrow: 'Nosotros',
		title: 'Nuestra historia',
		items: [
			{ image: 'gallery01', alt: 'Adriana e Israel sonríen juntos', focalPoint: '50% 30%' },
			{ image: 'gallery02', alt: 'Adriana e Israel en un jardín', focalPoint: '50% 30%' },
			{ image: 'gallery03', alt: 'Adriana e Israel en una cena', focalPoint: '50% 30%' },
			{
				image: 'gallery04',
				alt: 'Adriana e Israel una noche de invierno',
				focalPoint: '50% 35%',
			},
			{ image: 'gallery05', alt: 'Adriana e Israel de camino', focalPoint: '40% 35%' },
		],
	},
	gifts: {
		variant: 'framed-card',
		title: 'Regalos',
		subtitle: 'Su presencia es nuestro mejor regalo. Si desea tener un detalle con nosotros:',
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
			footerText: 'Le pedimos confirmar su asistencia al final de esta invitación.',
		},
		labels: {
			name: 'Nombre',
			guestCount: 'Asistentes',
			guestHint: 'Tiene {count} lugares reservados.',
			stepAttendance: 'Asistencia',
			stepDetails: 'Detalles',
			notesLabel: 'Mensaje para los novios',
			notesPlaceholder: 'Escriba aquí su mensaje',
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
		// The couple's own words, from the phrase card they sent.
		variant: 'standard',
		message:
			'Qué suerte tenerlos en este día. Hay momentos que se vuelven todavía más especiales cuando los compartimos con las personas que queremos. Gracias por estar aquí, por acompañarnos y por formar parte de un recuerdo que guardaremos para siempre.',
		closingName: COUPLE_NAME,
		closingPhrase: `Sábado ${EVENT_DATE_LABEL}\n${CITY_LABEL}`,
	},
	navigation: [
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Nosotros', href: '#galeria' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
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
		// Their portrait under the tree: both faces sit in the upper half, above the indigo veil.
		focalPoint: '50% 30%',
		focalPointMobile: '46% 30%',
	},
	envelope: {
		disabled: false,
		// The profile recolors the night envelope to indigo paper with an ivory card.
		revealVariant: 'pocket-fold',
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
		microcopy: 'Tenemos el honor de invitarle',
		tooltipText: 'Abrir invitación',
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · ${CITY_LABEL}. Recepción a las 8:00 p. m.`,
	},
};

export default defineCanonicalInvitation({
	slug: 'adriana-y-israel',
	eventType: 'boda',
	title: `Nuestra boda — ${COUPLE_NAME}`,
	clientName: 'Adriana Rivas',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'adriana-y-israel',
	eventTiming: WEDDING_TIMING,
	content,
	managedIdentityId: '219a037e-f9f3-4cdf-9827-3739ea60d14c',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'adriana_rivas',
	assetDir: 'src/invitations/clients/adriana-y-israel/assets',
	// Cropped from the couple's photographs; the quote photo is wired by the profile.
	assetFiles: {
		hero: 'hero.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
