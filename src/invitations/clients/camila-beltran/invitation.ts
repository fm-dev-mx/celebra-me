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
			alt: 'Camila sentada con su vestido rosa y la mano enguantada en alto',
			height: 'screen',
			presentation: 'framed',
			focalPoint: '45% 30%',
		},
		{
			image: 'interludeDress',
			afterSection: 'location',
			alt: 'Camila con vestido rosa strapless y guante de encaje',
			height: 'screen',
			presentation: 'framed',
			focalPoint: '50% 30%',
		},
		{
			image: 'interludeStanding',
			afterSection: 'dressCode',
			alt: 'Camila de pie con su vestido rosa de tul, medias de encaje y guantes',
			height: 'screen',
			presentation: 'framed',
			focalPoint: '50% 30%',
		},
		{
			image: 'interludeAccessories',
			afterSection: 'gallery',
			alt: 'Aretes de gota rosa, collar fino, guante de encaje y tul rosa sobre un pedestal blanco',
			height: 'screen',
			focalPoint: '50% 50%',
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
		text: 'Hay días que se sueñan desde niña. El mío ya tiene fecha.',
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
			sectionTitle: 'Con la bendición de Dios y el amor de mis padres',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			sectionMessage:
				'Hoy me siento muy feliz de llegar a este momento de mi vida, el día que dejaré atrás mi infancia y comenzaré un nuevo viaje.',
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
		presentationOptions: { showCalendarLinks: true, indicationsLayout: 'list' },
		introHeading: 'Te espero en:',
		introLede:
			'Ceremonia de XV años · 7:00 p. m. en Salón Áurea · Rev. Enrique Ruelas Carrillo.',
		indicationsHeading: 'Código de vestimenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Formal',
				text: 'El color <strong>Rose Gold</strong> se reserva para la quinceañera.',
			},
		],
		venues: [
			{
				...VENUE,
				type: 'reception',
				venueEvent: 'Recepción',
				time: '20:00',
				image: 'venueSalon',
			},
		],
	},
	itinerary: {
		variant: 'standard',
		timeFormat: '12h-es',
		title: 'Itinerario',
		subtitle: 'Así celebraremos mis XV años',
		items: [
			{ time: '19:00', iconName: 'Church', label: 'Ceremonia de XV años' },
			{ time: '20:00', iconName: 'Toast', label: 'Bienvenida y recepción' },
			{ time: '20:30', iconName: 'Waltz', label: 'Mi gran entrada y vals' },
			{ time: '21:00', iconName: 'Dinner', label: 'Brindis y cena' },
			{ time: '21:30', iconName: 'Heel', label: '¡A bailar!' },
			{ time: '23:00', iconName: 'Cake', label: 'Pastel' },
		],
		closingNote: 'Horario referencia. Los detalles finales son ajustados en evento.',
	},
	gifts: {
		variant: 'standard',
		presentation: 'catalog',
		title: 'Regalos',
		subtitle:
			'Su presencia es mi mejor regalo. Si además desea tener un detalle conmigo, le comparto esta opción.',
		items: [
			{
				type: 'cash',
				title: 'Lluvia de sobres',
				text: 'Es la tradición de entregar a la quinceañera un sobre con un obsequio en efectivo el día de la celebración.',
				medallionIconName: 'Enveloped',
			},
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
				alt: 'Camila sentada sobre un pedestal blanco con su vestido rosa y guantes de encaje',
				focalPoint: '50% 40%',
			},
			{
				image: 'gallery02',
				alt: 'Retrato de Camila con su vestido rosa, aretes de gota y collar fino',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery03',
				alt: 'Camila con vestido champaña sobre un fondo cálido, la mano junto al rostro',
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
		subcopy:
			'Evento solo para adultos · No niños. Le pedimos su respuesta a más tardar el 25 de noviembre.',
		lockedMessage: 'Abra su enlace personalizado para confirmar su asistencia.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'formal-pass',
			ticket: { signature: 'Camila', monogram: 'C' },
			title: 'Pase de acceso',
			subtitle: 'Será un honor celebrar con usted.',
		},
		labels: {
			name: 'Nombre completo',
			guestHint: 'Inclúyase usted en el número',
			stepAttendance: '¿Nos acompañará?',
			stepDetails: 'Sus pases',
			notesLabel: 'Mensaje para Camila',
			notesPlaceholder: 'Escriba aquí unas palabras',
		},
		confirmationMessage: 'Su respuesta quedó registrada.',
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
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/camila-beltran/music-ac280437e080b10dd2b6ec51ea694b3c96173c36b5a8584bca35efb7be4719d6.mp3',
		title: 'A Thousand Years — Christina Perri',
		control: 'equalizer',
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
		interludeStanding: 'interlude-standing.webp',
		interludeAccessories: 'interlude-accessories.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		thankYouPortrait: 'thank-you.webp',
		venueSalon: 'venue-salon-aurea.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
