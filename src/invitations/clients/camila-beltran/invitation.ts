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
		'itinerary',
		'dressCode',
		'gifts',
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
			focalPoint: '50% 25%',
		},
		{
			image: 'interludeAmbientFloral',
			afterSection: 'dressCode',
			alt: 'Rosas en tono rosa empolvado y marfil con listón rose gold y pasadores con perlas sobre papel crema',
			height: 'screen',
			presentation: 'framed',
		},
		{
			image: 'interludeAmbientTulle',
			afterSection: 'gallery',
			alt: 'Tul y encaje floral en rosa empolvado junto a un sobre crema artesanal y listón dorado',
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
		introLede:
			'Ceremonia de XV años · 7:00 p. m. en Salón Áurea · Rev. Enrique Ruelas Carrillo.',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Celebremos con estilo',
				text: 'El <strong>rose gold</strong> está reservado para la quinceañera. Le agradezco elegir otro color para acompañarme en esta noche especial.',
			},
		],
		venues: [
			{
				...VENUE,
				type: 'reception',
				venueEvent: 'Recepción',
				time: '20:00',
			},
		],
	},
	itinerary: {
		variant: 'standard',
		timeFormat: '12h-es',
		title: 'Itinerario',
		subtitle: 'Así celebraremos mis XV años',
		items: [
			{ time: '19:00', iconName: 'Sparkles', label: 'Ceremonia de XV años' },
			{ time: '20:00', iconName: 'Reception', label: 'Bienvenida y recepción' },
			{
				time: '20:30',
				iconName: 'Sparkles',
				label: 'Mi gran entrada',
				description: '¡Comienza la celebración!',
			},
			{
				time: '21:00',
				iconName: 'Dinner',
				label: 'Cena',
				description: 'Un momento para compartir.',
			},
			{
				time: '21:30',
				iconName: 'Waltz',
				label: 'Vals',
				description: 'Un baile para recordar.',
			},
			{
				time: '22:00',
				iconName: 'Party',
				label: '¡A bailar!',
				description: 'La pista nos espera.',
			},
		],
		closingNote: 'Gracias por acompañarme en cada momento de esta noche.',
	},
	gifts: {
		variant: 'standard',
		presentation: 'catalog',
		title: 'Regalos',
		subtitle:
			'Su presencia es mi mejor regalo. Si además desea tener un detalle conmigo, le comparto estas opciones.',
		items: [
			{ type: 'cash', title: 'Lluvia de sobres', medallionIconName: 'Enveloped' },
			{ type: 'cash', title: 'Regalo sorpresa', medallionIconName: 'Gift' },
		],
		note: 'Habrá un baúl en la recepción para sus sobres.',
	},
	gallery: {
		variant: 'uniform-grid',
		eyebrow: 'Momentos',
		title: 'Galería',
		items: [
			{
				image: 'gallery01',
				alt: 'Camila con sonrisa suave, un ramo de rosas rosa palo y guantes de encaje',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery02',
				alt: 'Aretes de gota rosa, collar fino, guante de encaje y tul rosa sobre un pedestal blanco',
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
				focalPoint: '50% 25%',
			},
		],
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirme su asistencia',
		// The client manages the guest list and pass counts through the host dashboard.
		subcopy: 'Confirme su asistencia a más tardar el 25 de noviembre de 2026.',
		lockedMessage: 'Abra su enlace personalizado para confirmar su asistencia.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'standard',
			title: 'Pases reservados',
			subtitle: 'Esta invitación es para',
			footerText: 'Confirme su asistencia en la siguiente sección.',
		},
		labels: {
			name: 'Nombre completo',
			guestHint: 'Inclúyase usted en el número',
			stepAttendance: '¿Nos acompañará?',
			stepDetails: 'Sus pases',
			notesLabel: 'Mensaje para Camila',
			notesPlaceholder: 'Escriba aquí unas palabras',
		},
		confirmationMessage: '¡Gracias por confirmar! Le espero el 11 de diciembre.',
		responseMessages: {
			confirmed: {
				title: '¡Gracias por confirmar!',
				subtitle: 'Le espero el viernes 11 de diciembre a las 7:00 p. m.',
			},
			declined: {
				title: 'Gracias por avisar',
				subtitle: 'Le voy a extrañar. Gracias por su cariño.',
			},
		},
	},
	thankYou: {
		variant: 'portrait-keepsake',
		image: 'thankYouPortrait',
		focalPoint: '50% 25%',
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
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/camila-beltran/music-2a99b2682dba29919f8fd021a8672c3d40128a0742509fadd8be0c2d7469496a.mp3',
		title: 'No crezcas más — Tercer Cielo',
		autoPlay: true,
	},
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
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'camila_beltran',
	assetDir: 'src/invitations/clients/camila-beltran/assets',
	assetFiles: {
		hero: 'hero.webp',
		interludePortrait: 'interlude-portrait.webp',
		interludeDress: 'interlude-dress.webp',
		interludeAmbientFloral: 'interlude-ambient-floral.webp',
		interludeAmbientTulle: 'interlude-ambient-tulle.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		thankYouPortrait: 'thank-you.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
