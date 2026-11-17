import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * Wedding invitation on the jewelry-box-wedding preset, recolored by the profile into the
 * client's stationery: an olive envelope, a full-bleed cover under an olive veil with a fine gold
 * frame, and light cards for the inner sections. Gold appears only as hairlines. The photographs
 * are the couple's five session originals, cropped per role. Sections are added one by one as the
 * client's data is confirmed; pending data stays out of the page.
 */
const WEDDING_TIMING = {
	localDateTime: '2027-01-23T16:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2027-01-23T23:00:00.000Z',
} as const;

const BRIDE_NAME = 'Daniela';
const GROOM_NAME = 'David';
const COUPLE_NAME = `${BRIDE_NAME} y ${GROOM_NAME}`;
const EVENT_DATE_LABEL = '23 de enero de 2027';

const content: CanonicalEventContentInput = {
	eventType: 'boda',
	isDemo: false,
	title: `Nuestra boda — ${COUPLE_NAME}`,
	description: `${COUPLE_NAME} se casan. Sábado ${EVENT_DATE_LABEL}, Mazatlán, Sinaloa.`,
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
				items: [
					{ name: 'Lourdes Marcela Ramirez Torreblanca' },
					{ name: 'Juan Manuel Yáñez Rendon', deceased: true },
				],
			},
			{
				title: 'Madre del novio',
				items: [{ name: 'Maria Felicitas Rendon Gutierrez' }],
			},
		],
		godparents: [{ name: 'Gabriel Ramirez Torreblanca' }, { name: 'Monica Barraza Wong' }],
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
		// The program sheet lists both events as compact rows with large times, so the whole
		// section fits one screen; the standard cards carried a decorative fake map.
		variant: 'pinned-program',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: { showCalendarLinks: true, indicationsLayout: 'enclosure' },
		introHeading: 'Ceremonia y recepción',
		introLede: 'Mazatlán, Sinaloa',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Formal',
				text: 'Les agradecemos acompañarnos con atuendo formal.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Parroquia de Nuestra Señora de Fátima',
				address: 'Calle Parada y callejón Corona, col. Montuosa',
				city: 'Mazatlán, Sinaloa',
				date: '2027-01-23',
				time: '16:00',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia+de+Nuestra+Se%C3%B1ora+de+F%C3%A1tima+Montuosa+Mazatl%C3%A1n',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Belcanto Jardín',
				address: 'Av. Libramiento 3, col. Valles del Ejido',
				city: 'Mazatlán, Sinaloa',
				date: '2027-01-23',
				time: '20:00',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Belcanto+Jard%C3%ADn+Mazatl%C3%A1n',
				isVisible: true,
			},
		],
	},
	gallery: {
		variant: 'rising-stack',
		eyebrow: 'Nosotros',
		title: 'Nuestra historia',
		items: [
			{ image: 'gallery01', alt: 'David besa la frente de Daniela', focalPoint: '50% 30%' },
			{ image: 'gallery02', alt: 'Daniela y David se abrazan', focalPoint: '50% 30%' },
			{ image: 'gallery03', alt: 'Daniela y David sonríen juntos', focalPoint: '50% 45%' },
			{
				image: 'gallery04',
				alt: 'Las manos de Daniela y David con el anillo',
				focalPoint: '55% 60%',
			},
		],
	},
	gifts: {
		variant: 'framed-card',
		title: 'Mesa de regalos',
		subtitle: 'Su presencia es nuestro mejor regalo. Si desea tener un detalle con nosotros:',
		items: [
			{
				type: 'store',
				title: 'Liverpool',
				description: 'Mesa de regalos',
				tableNumber: '60063833',
				url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/60063833',
			},
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
			subtitle: 'Hemos reservado estos lugares para usted.',
			footerText: 'Le pedimos confirmar su asistencia al final de esta invitación.',
		},
		labels: {
			name: 'Nombre',
			// Short label so the total and the children sit side by side on short screens.
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
				subtitle: 'Le esperamos el 23 de enero en Mazatlán.',
			},
			declined: {
				title: 'Gracias por avisarnos.',
				subtitle: 'Le tendremos presente ese día.',
			},
		},
	},
	thankYou: {
		variant: 'veiled-photo',
		image: 'thankYouPortrait',
		focalPoint: '50% 35%',
		message: 'Gracias por acompañarnos en el día más importante de nuestras vidas.',
		closingName: COUPLE_NAME,
		// The footer prints it under the reply, beneath a gold point.
		closingPhrase: `Sábado ${EVENT_DATE_LABEL}\nMazatlán, Sinaloa`,
	},
	navigation: [
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Galería', href: '#galeria' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/boda/daniela-y-david/music-48d6683d3f7ab5a1afa12ea78a57448a37197fd61fbbda632d55091aaefc1199.mp3',
		title: 'Photograph (Instrumental) — Ed Sheeran',
		control: 'equalizer',
		autoPlay: true,
	},
	quote: {
		variant: 'veiled-photo',
		text: 'Con la bendición de Dios y de nuestros padres, tenemos el honor de invitarle a celebrar nuestro matrimonio.',
		closingLine: COUPLE_NAME,
	},
	hero: {
		// The composition drops the arch on every screen: the photograph bleeds to the edges under
		// an olive veil, with the names at its foot inside a fine gold frame.
		variant: 'veiled-arch',
		name: BRIDE_NAME,
		secondaryName: GROOM_NAME,
		label: 'Nuestra boda',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2027-01-23T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 40%',
		focalPointMobile: '50% 40%',
	},
	envelope: {
		disabled: false,
		// The profile recolors the night envelope to olive paper with an ivory card.
		revealVariant: 'pocket-fold',
		cardLabel: 'BODA',
		envelopeName: COUPLE_NAME,
		teaserDetails: '23 · ENE · 2027 · MAZATLÁN',
		cardName: BRIDE_NAME,
		cardSecondaryName: GROOM_NAME,
		guestPlacement: 'outside-envelope',
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'D·D',
		documentLabel: 'D & D',
		stampText: 'BODA',
		stampYear: '2027',
		microcopy: 'Tenemos el honor de invitarle',
		tooltipText: 'Abrir invitación',
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · Mazatlán, Sinaloa. Ceremonia a las 4:00 p. m. y recepción a las 8:00 p. m.`,
	},
};

export default defineCanonicalInvitation({
	slug: 'daniela-y-david',
	eventType: 'boda',
	title: `Nuestra boda — ${COUPLE_NAME}`,
	clientName: 'Daniela Yáñez',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'daniela-y-david',
	eventTiming: WEDDING_TIMING,
	content,
	managedIdentityId: 'efbd7c4e-1f7c-4e06-898f-f34fe3ae6af2',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'in_progress',
	hostLoginAlias: 'daniela_yanez',
	assetDir: 'src/invitations/clients/daniela-y-david/assets',
	// One role per crop; the hero and the og card share one source photograph.
	assetFiles: {
		hero: 'hero.webp',
		thankYouPortrait: 'thank-you.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
