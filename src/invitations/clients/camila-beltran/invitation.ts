import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

const TIMING = {
	localDateTime: '2026-12-11T19:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-12-12T02:00:00.000Z',
} as const;

const VENUE = {
	venueName: 'Salón Áurea',
	address: 'Carretera Los Mochis - Topolobampo Km 5, Col. Morelos',
	city: 'Los Mochis, Sinaloa',
	date: '2026-12-11',
	googleMapsUrl:
		'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+%C3%81urea+Los+Mochis+Sinaloa',
	wazeUrl: 'https://waze.com/ul?q=Sal%C3%B3n%20%C3%81urea%20Los%20Mochis%20Sinaloa&navigate=yes',
	appleMapsUrl: 'https://maps.apple.com/?q=Sal%C3%B3n+%C3%81urea+Los+Mochis+Sinaloa',
	isVisible: true,
} as const;

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	title: 'XV Años de Camila',
	description:
		'Acompáñenos a celebrar los XV años de Camila el viernes 11 de diciembre de 2026 en Salón Áurea, Los Mochis.',
	theme: { preset: 'jewelry-box', motion: 'editorial' },
	eventTiming: TIMING,
	sectionOrder: [
		'quote',
		'family',
		'countdown',
		'location',
		'dressCode',
		'gallery',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: { intersections: {} },
	interludes: [
		{
			image: 'interludePortrait',
			afterSection: 'family',
			alt: 'Camila con su vestido rosa, mirando hacia abajo',
			height: 'screen',
			presentation: 'framed',
		},
		{
			image: 'interludeDress',
			afterSection: 'location',
			alt: 'Camila con vestido rosa strapless y guante de encaje',
			height: 'screen',
			presentation: 'framed',
		},
	],
	hero: {
		variant: 'standard',
		name: 'Camila',
		label: 'Mis XV Años',
		date: '2026-12-11T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '56% 40%',
		focalPointMobile: '56% 50%',
		scrollLabel: 'Desliza',
	},
	envelope: {
		disabled: false,
		variant: 'jewelry-box',
		revealVariant: 'storybook-lanterns',
		sealStyle: 'wax',
		sealIcon: 'sunburst',
		sealInitials: 'C',
		envelopeName: 'Camila',
		cardName: 'Camila',
		cardLabel: 'Mis XV Años · 2026',
		teaserDetails: 'Mis XV Años · 2026',
		guestLabel: 'Para',
		microcopy: 'Toque el sello para abrir',
	},
	quote: {
		text: 'Hay días que se sueñan desde niña. El mío ya tiene fecha, y quiero vivirlo con ustedes.',
		closingLine: 'Viernes · 11 · 12 · 26',
	},
	family: {
		variant: 'standard',
		presentation: 'text-only',
		parentsOrder: 'mother-first',
		parents: {
			father: 'Rosario Beltrán Rabago',
			mother: 'Anahy Soto Acosta',
		},
		labels: {
			sectionTitle: 'Con el amor de mis padres',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			sectionMessage: 'Gracias por cada paso que me trajo hasta aquí.',
		},
	},
	countdown: {
		variant: 'standard',
		title: 'El gran día',
		footerText: 'Viernes 11 de diciembre de 2026',
		presentationOptions: {
			visibleUnits: ['days', 'hours', 'minutes', 'seconds'],
			calendar: { mark: 'heart', addToCalendar: true },
		},
	},
	location: {
		variant: 'standard',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: { showCalendarLinks: false, indicationsLayout: 'list' },
		introHeading: '¿Dónde?',
		introLede: 'La ceremonia y la recepción serán en el mismo lugar.',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Color reservado',
				text: 'El color Rose Gold se reserva para la xvañera.',
			},
		],
		venues: [
			{
				...VENUE,
				type: 'ceremony',
				label: 'Ceremonia y recepción',
				venueEvent: 'Ceremonia de XV años',
				time: '19:00',
			},
			{
				...VENUE,
				type: 'reception',
				venueEvent: 'Recepción',
				time: '20:00',
			},
		],
	},
	gallery: {
		variant: 'uniform-grid',
		eyebrow: '',
		title: 'Galería',
		items: [
			{
				image: 'gallery01',
				alt: 'Camila sonriente con un ramo de rosas rosa palo y guantes de encaje',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery02',
				alt: 'Tiara de cristal, guante de encaje y tul rosa sobre un pedestal blanco',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery03',
				alt: 'Camila de espaldas mirando sobre el hombro con media sonrisa',
				focalPoint: '50% 30%',
			},
			{
				image: 'gallery04',
				alt: 'Rostro de Camila con la mano enguantada en alto',
				focalPoint: '50% 50%',
			},
		],
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirmen su asistencia',
		subcopy:
			'Será un honor contar con su presencia. Por favor confirmen para reservar su lugar.',
		lockedMessage: 'Abran la invitación desde el enlace que recibieron para confirmar.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'standard',
			title: 'Pases reservados',
			subtitle: 'Esta invitación es para',
			footerText: 'Los espero con mucha ilusión.',
		},
		labels: {
			name: 'Nombre completo',
			guestHint: 'Inclúyase usted en el número',
			stepAttendance: 'Asistencia',
			stepDetails: 'Detalles',
			notesLabel: 'Mensaje para Camila',
			notesPlaceholder: 'Escriban aquí unas palabras',
		},
		confirmationMessage: '¡Gracias por confirmar! Los espero el 11 de diciembre.',
		responseMessages: {
			confirmed: {
				title: '¡Gracias por confirmar!',
				subtitle: 'Los espero el viernes 11 de diciembre a las 7:00 pm.',
			},
			declined: {
				title: 'Gracias por avisar',
				subtitle: 'Los voy a extrañar. Gracias por su cariño.',
			},
		},
	},
	thankYou: {
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 30%',
		message: 'Gracias por acompañarme en la noche que tanto he soñado.',
		closingName: 'Camila',
		closingPhrase: 'Con cariño',
	},
	navigation: [
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Ubicación', href: '#event-location' },
		{ label: 'Galería', href: '#galeria' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	sharing: {
		ogImage: 'ogShare',
		ogDescription: 'Viernes 11 de diciembre de 2026 · Salón Áurea, Los Mochis',
		shareMessages: {
			invitation:
				'Hola {{invitado}}, con mucha ilusión les comparto la invitación a mis XV años: {{enlace}}',
			reminder:
				'Hola {{invitado}}, les recuerdo mis XV años este viernes 11 de diciembre a las {{hora_evento}} en Salón Áurea: {{enlace}}',
		},
	},
};

export default defineCanonicalInvitation({
	slug: 'camila-beltran',
	eventType: 'xv',
	title: 'XV Años de Camila',
	clientName: 'Camila Beltrán',
	themeId: 'jewelry-box',
	visualProfileId: 'camila-beltran',
	eventTiming: TIMING,
	content,
	managedIdentityId: '23f6782c-3bae-487c-9bb7-67925cf4f6d3',
	managedIdentityProvenance: 'owner-approved',
	lifecycle: 'in_progress',
	hostLoginAlias: 'camila_beltran',
	assetDir: 'src/invitations/clients/camila-beltran/assets',
	assetFiles: {
		hero: 'hero.webp',
		interludePortrait: 'interlude-portrait.webp',
		interludeDress: 'interlude-dress.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		thankYouPortrait: 'thank-you.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
