import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/**
 * Wedding of Olivia and Antonio on the jewelry-box-wedding preset, retinted to the couple's
 * palette: navy ink, slate and dusty blues, champagne for fine accents on ivory paper. Photographs
 * come from their engagement session (garden, dock, beach at sunset and a save-the-date newspaper
 * prop). Ceremony in the Parroquia del Santo Niño de la Salud and reception at Liarah Salón de
 * Eventos, Los Mochis. The couple's song is hosted on the production R2 media bucket. Map links
 * are Google Maps place pins approved by the owner; the reception keeps the client's address
 * wording.
 */
const OLIVIA_TIMING = {
	localDateTime: '2026-12-18T19:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-12-19T02:00:00.000Z',
} as const;

const SCHEDULE = { ceremony: '19:00', reception: '21:00' } as const;

const COUPLE = 'Olivia & Antonio';
const EVENT_DATE_LONG = '18 de diciembre de 2026';
const EVENT_DATE_HEADING = 'Viernes, 18 de diciembre de 2026';
const RSVP_DEADLINE = 'miércoles 18 de noviembre';

const CEREMONY = {
	name: 'Parroquia del Santo Niño de la Salud',
	address: 'Lic. Benito Juárez S/N, 81257 Los Mochis, Sinaloa',
	mapUrl: 'https://www.google.com/maps/place/Parroquia+del+Santo+Ni%C3%B1o+de+la+Salud/@25.7804807,-108.9757035,17z/data=!4m6!3m5!1s0x86ba2f40212114a9:0x399dcabc76e64840!8m2!3d25.7804807!4d-108.9757035',
} as const;

const RECEPTION = {
	name: 'Liarah Salón de Eventos',
	address: 'Carretera Topolobampo-Choix 4731, Los Mochis, Sinaloa',
	mapUrl: 'https://www.google.com/maps/place/Liarah+Sal%C3%B3n+de+Eventos/@25.733151,-109.0161631,17z/data=!4m6!3m5!1s0x86ba2576fa86f683:0x887cfeffa331e57c!8m2!3d25.733151!4d-109.0161631',
} as const;

const content: CanonicalEventContentInput = {
	eventType: 'boda',
	isDemo: false,
	templateId: 'boda-jewelry-box-wedding',
	title: 'Boda de Olivia Martínez y Antonio Vázquez',
	description: `Invitación a la boda de Olivia y Antonio, el ${EVENT_DATE_LONG} en Los Mochis, Sinaloa.`,
	theme: { preset: 'jewelry-box-wedding', motion: 'editorial' },
	music: {
		url: 'https://media.celebra-me.com/invitations/boda/olivia-y-antonio/music-e19e90b0128f53b42ba90ccbbbfe1b55f96224dce5edd070e8c6375080228c32.mp3',
		title: 'Alex Warren — Ordinary',
		autoPlay: true,
	},
	eventTiming: OLIVIA_TIMING,
	sectionOrder: [
		'quote',
		'countdown',
		'family',
		'location',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			quote: { family: 'atmospheric-blend', source: 'hero' },
			countdown: { family: 'atmospheric-blend', source: 'quote' },
			// The save-the-date print is framed like a clipping out of the countdown.
			'interlude-after-countdown': { family: 'atmospheric-blend', source: 'countdown' },
			family: { family: 'atmospheric-blend', source: 'interlude-after-countdown' },
			'interlude-after-family': { family: 'overlap', source: 'family' },
			location: { family: 'arch', source: 'interlude-after-family' },
			gallery: { family: 'atmospheric-blend', source: 'location' },
			gifts: { family: 'atmospheric-blend', source: 'gallery' },
			'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
			// The RSVP rises over the pinned pass like a card laid on it.
			rsvp: { family: 'stack', source: 'personalized-access' },
			thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
		},
	},
	hero: {
		name: 'Olivia',
		secondaryName: 'Antonio',
		label: 'Nuestra boda',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-12-18T19:00:00.000Z',
		variant: 'night-arch',
		scrollLabel: 'Descubra más',
		// Standing on the garden dock, framed by the arch; one 2:3 frame in two widths.
		backgroundImage: 'heroArchDesktop',
		backgroundImageMobile: 'heroArchMobile',
		backgroundImageDesktop: 'heroArchDesktop',
		focalPoint: '50% 42%',
		presentation: { timeFormat: '12h' },
	},
	envelope: {
		disabled: false,
		// Navy night envelope; the letter's arched window flies onto the cover arch.
		revealVariant: 'night-envelope',
		cardLabel: 'BODA',
		envelopeName: COUPLE,
		teaserDetails: '18 · DIC · 2026 · LOS MOCHIS',
		cardName: 'Olivia',
		cardSecondaryName: 'Antonio',
		guestPlacement: 'outside-envelope',
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'O·A',
		documentLabel: 'O & A',
		stampText: 'BODA',
		stampYear: '2026',
		microcopy: 'Tenemos el honor de invitarle',
		tooltipText: 'Abrir invitación',
	},
	quote: {
		text: 'El amor es paciente, es bondadoso. Todo lo disculpa, todo lo cree, todo lo espera,',
		closingLine: 'todo lo soporta.',
		author: '1 Corintios 13:4–7',
	},
	countdown: {
		variant: 'standard',
		title: 'Falta poco para decir que sí',
		footerText: 'Los Mochis, Sinaloa',
		presentationOptions: { calendar: { mark: 'ring' } },
	},
	interludes: [
		{
			// The couple's own save-the-date newspaper, presented as a print.
			image: 'interludeSaveTheDate',
			afterSection: 'countdown',
			alt: 'Olivia y Antonio sostienen un periódico con la fecha 18 de diciembre de 2026.',
			height: 'medium',
			presentation: 'framed',
		},
		{
			// Walking the shore: the pause between the families and the venues.
			image: 'interludeBeach',
			afterSection: 'family',
			alt: 'Olivia y Antonio caminan de la mano a la orilla del mar.',
			height: 'tall',
			focalPoint: '50% 55%',
		},
	],
	family: {
		variant: 'asymmetric-groups',
		presentation: 'with-photo',
		// One label per role with its names beneath; no couples are inferred.
		godparentsLayout: 'by-role',
		featuredImage: 'family',
		featuredImageAlt: 'Olivia y Antonio de pie entre bambúes, ella con un ramo blanco.',
		focalPoint: '50% 40%',
		// Names as the couple sent them; no roles are inferred from first names.
		groups: [
			{
				title: 'Padres de la novia',
				items: [{ name: 'Irma Miranda' }, { name: 'Guadalupe Martínez' }],
			},
			{
				title: 'Madre del novio',
				items: [{ name: 'Josefa Flores' }],
			},
		],
		godparents: [
			{ name: 'Flor Martínez', role: 'Velación' },
			{ name: 'Manuel Valenzuela', role: 'Velación' },
			{ name: 'Karla Osobampo', role: 'Velación' },
			{ name: 'Alfredo Martínez', role: 'Velación' },
			{ name: 'Marisela Lerma', role: 'Lazo' },
			{ name: 'Guadalupe Martínez', role: 'Lazo' },
			{ name: 'Liliana Domínguez', role: 'Arras' },
			{ name: 'Yuliana Domínguez', role: 'Arras' },
			{ name: 'Lizbeth Miranda', role: 'Biblia y rosario' },
			{ name: 'Raúl López', role: 'Biblia y rosario' },
		],
		labels: {
			sectionSubtitle: 'Nuestras familias',
			sectionTitle: 'Con la bendición de Dios, de nuestros padres y padrinos',
			godparentsTitle: 'Padrinos',
			sectionMessage: 'Su amor y su guía nos acompañan en este día.',
		},
	},
	location: {
		accessPolicy: { visibility: 'public' },
		mapStyle: 'dark',
		variant: 'night-route',
		presentation: 'simple',
		presentationOptions: {
			showFlourishes: false,
			showNavigationButtons: true,
			// Each card opens with its time and keeps one «Cómo llegar» button, no map tile.
			venueCard: 'compact',
			// Guests save each part of the night to their calendar from its card.
			showCalendarLinks: true,
		},
		introEyebrow: 'Los Mochis, Sinaloa',
		introHeading: 'Dónde celebraremos',
		introLede: `${EVENT_DATE_HEADING}. Les esperamos primero en la parroquia para la ceremonia y después en el salón para celebrar juntos.`,
		venues: [
			{
				type: 'ceremony',
				id: 'ceremony-santo-nino',
				venueEvent: 'Ceremonia religiosa',
				venueName: CEREMONY.name,
				address: CEREMONY.address,
				city: 'Los Mochis, Sinaloa',
				date: EVENT_DATE_LONG,
				time: SCHEDULE.ceremony,
				googleMapsUrl: CEREMONY.mapUrl,
			},
			{
				type: 'reception',
				id: 'reception-liarah',
				venueEvent: 'Recepción',
				venueName: RECEPTION.name,
				address: RECEPTION.address,
				city: 'Los Mochis, Sinaloa',
				date: EVENT_DATE_LONG,
				time: SCHEDULE.reception,
				googleMapsUrl: RECEPTION.mapUrl,
			},
		],
		indicationsHeading: 'Consideraciones',
		indications: [
			{
				title: 'Vestimenta',
				iconName: 'DressCode',
				styleVariant: 'default',
				text: 'Formal. Le pedimos amablemente reservar el blanco, el rojo y los tonos azul marino u oscuro.',
			},
			{
				title: 'Pase personal',
				iconName: 'Enveloped',
				styleVariant: 'default',
				text: `Su invitación es personal y los lugares corresponden a su pase. Le pedimos confirmar a más tardar el ${RSVP_DEADLINE}.`,
			},
		],
	},
	gallery: {
		// A pinned track of seven photos (one dance, not three); at rest, 4:5 features and 3:4 pairs.
		variant: 'pinned-track',
		eyebrow: 'Galería',
		title: 'Nuestra historia',
		subtitle: 'Del jardín al mar: algunos momentos antes del gran día.',
		items: [
			{
				image: 'gallery01',
				layoutRole: 'feature',
				alt: 'Antonio besa la frente de Olivia mientras ella muestra su anillo.',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery02',
				alt: 'Antonio carga a Olivia frente a una casa de piedra con enredaderas.',
				focalPoint: '50% 40%',
			},
			{
				image: 'gallery03',
				alt: 'Antonio levanta a Olivia en brazos a la orilla del mar.',
				focalPoint: '50% 45%',
			},
			{
				image: 'gallery04',
				layoutRole: 'feature',
				alt: 'Antonio inclina a Olivia en un paso de baile en el jardín.',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery07',
				layoutRole: 'feature',
				alt: 'Olivia con un ramo junto a Antonio en la playa.',
				focalPoint: '45% 45%',
			},
			{
				image: 'gallery08',
				alt: 'Olivia y Antonio sentados junto al lago leen su periódico de boda.',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery09',
				alt: 'Detalle del periódico con la fecha 18 de diciembre de 2026.',
				focalPoint: '50% 50%',
			},
		],
	},
	gifts: {
		variant: 'standard',
		title: 'Regalos',
		presentation: 'catalog',
		subtitle: 'Su presencia es nuestro mejor regalo. Si desea tener un detalle con nosotros:',
		items: [
			{
				type: 'cash',
				title: 'Lluvia de sobres',
				text: 'Habrá lluvia de sobres durante la fiesta.',
			},
			{
				type: 'bank',
				title: 'Transferencia',
				bankName: 'BBVA',
				accountHolder: 'José Antonio Vázquez Flores',
				clabe: '4152 3146 2062 2954',
				accountKind: 'card',
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		title: 'Confirme su asistencia',
		subcopy: `Le pedimos registrar su respuesta a más tardar el ${RSVP_DEADLINE}. El número de lugares corresponde al pase asignado.`,
		lockedMessage: `Esta invitación es personal. Abra el enlace que le enviamos para ver su lugar y confirmar a más tardar el ${RSVP_DEADLINE}.`,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		confirmationMessage: 'Su respuesta quedó registrada. Le esperamos.',
		labels: {
			name: 'Su nombre',
			notesLabel: 'Mensaje para Olivia y Antonio',
			notesPlaceholder: 'Escriba unas palabras para los novios…',
		},
		responseMessages: {
			confirmed: {
				title: 'Confirmación recibida, {guestName}.',
				subtitle: 'Su lugar quedó registrado para la celebración.',
			},
			declined: {
				title: 'Registramos su aviso, {guestName}.',
				subtitle: 'Agradecemos que nos lo haya hecho saber.',
			},
		},
		calendar: {
			title: 'Boda de Olivia y Antonio',
			description: `Ceremonia religiosa en la ${CEREMONY.name} (${SCHEDULE.ceremony}) y recepción en ${RECEPTION.name} (${SCHEDULE.reception}). Los Mochis, Sinaloa.`,
			startsAt: OLIVIA_TIMING.startsAtUtc,
		},
		personalizedAccess: {
			variant: 'formal-pass',
			ticket: {
				signature: COUPLE,
				monogram: 'O · A',
			},
			title: 'Pase personal',
			subtitle: 'Será un placer celebrar con usted.',
			noteText: 'Su pase incluye a {count} {personWord}. Gracias por acompañarnos.',
			footerText: 'Confirme su asistencia y celebremos juntos.',
		},
	},
	thankYou: {
		// The sunset kiss fades into the wedding night that closes the invitation.
		variant: 'full-bleed-photo',
		image: 'thankYou',
		focalPoint: '50% 60%',
		message:
			'Gracias por acompañarnos en el comienzo de esta nueva etapa y por hacer de este día un recuerdo inolvidable.',
		closingName: COUPLE,
		date: EVENT_DATE_LONG,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Viernes ${EVENT_DATE_LONG} · Los Mochis, Sinaloa. Ceremonia a las ${SCHEDULE.ceremony} y recepción a las ${SCHEDULE.reception}.`,
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: con mucha alegría le compartimos la invitación a nuestra boda, con su pase y la opción para confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Nos dará mucho gusto verle.\n\nPuede confirmar hasta el miércoles 18 de noviembre:\n{{enlace}}',
		},
	},
};

export const oliviaAntonioInvitation = defineCanonicalInvitation({
	slug: 'olivia-y-antonio',
	eventType: 'boda',
	title: 'Boda de Olivia Martínez y Antonio Vázquez',
	clientName: 'Olivia Martínez',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'olivia-y-antonio',
	eventTiming: OLIVIA_TIMING,
	content,
	managedIdentityId: 'f0139dcd-8734-43bd-a286-cef91442aa7d',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'olivia_martinez',
	assetDir: 'src/assets/invitations/olivia-y-antonio',
	// One role per photograph; the og crop is a separate derivative of the hero source.
	assetFiles: {
		heroArchDesktop: 'hero-arch-desktop.webp',
		heroArchMobile: 'hero-arch-mobile.webp',
		family: 'family.webp',
		interludeBeach: 'interlude-01.webp',
		interludeSaveTheDate: 'interlude-02.webp',
		thankYou: 'thank-you.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		gallery07: 'gallery-07.webp',
		gallery08: 'gallery-08.webp',
		gallery09: 'gallery-09.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
