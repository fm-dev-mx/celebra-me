import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * XV invitation on the storybook-blush preset, recolored by the profile into a cherry disco
 * night: cherry paper and wine ink by day, a deep wine night for the countdown and the closing,
 * with a mirror ball, fine stars and a cherry pair as the only motifs. The photographs are the
 * client's WhatsApp deliveries, cropped per role and never upscaled. Every guest-facing line is a
 * draft for the client's approval, except the program, the snacks note and the envelope gift,
 * which the client confirmed. The song is the client's YouTube pick, encoded at 64 kbps and hosted
 * on the media domain. The reply deadline and photo-QR space are pending and stay out of the page
 * until the client confirms them.
 */
const VALERIA_TIMING = {
	localDateTime: '2027-01-09T17:45',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2027-01-09T23:45:00.000Z',
} as const;

const CELEBRANT_NAME = 'Valeria';
const EVENT_DATE_LABEL = '9 de enero de 2027';

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	description: `${CELEBRANT_NAME} cumple quince. Sábado ${EVENT_DATE_LABEL}, Puebla, Puebla.`,
	theme: { preset: 'storybook-blush', motion: 'editorial' },
	eventTiming: VALERIA_TIMING,
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'itinerary',
		'family',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			// Every boundary is joined, each a different way: the night rises out of the quote, the
			// route opens in a glow, the family page and the pass turn a corner on opposite sides,
			// the album climbs a slope, and the closing rises into the reply card.
			countdown: { family: 'overlap', source: 'quote' },
			location: { family: 'atmospheric-blend', source: 'countdown' },
			family: { family: 'folio', source: 'itinerary' },
			gallery: { family: 'arch', source: 'family' },
			'personalized-access': { family: 'folio', source: 'gifts' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	hero: {
		// The close portrait stands in an arch over the name.
		variant: 'disco-stage',
		name: CELEBRANT_NAME,
		label: 'Mis XV Años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2027-01-09T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 35%',
		focalPointMobile: '50% 35%',
		presentation: { venueIndex: 0 },
		scrollLabel: 'Deslice para descubrir',
		// The same disco room as the opening clip, looping without the ball the hero draws itself.
		ambientVideo: {
			webm: '/videos/valeria-hernandez/hero-loop.webm',
			mp4: '/videos/valeria-hernandez/hero-loop.mp4',
			poster: '/videos/valeria-hernandez/hero-loop-poster.webp',
		},
	},
	envelope: {
		disabled: false,
		variant: 'storybook-blush',
		// The night envelope opens the cherry disco night; the profile recolors it to wine and silver.
		revealVariant: 'disco-night',
		sealStyle: 'wax',
		sealIcon: 'wax-monogram',
		sealInitials: 'V',
		envelopeName: CELEBRANT_NAME,
		cardName: CELEBRANT_NAME,
		cardLabel: 'Mis XV Años',
		guestLabel: 'Para',
		microcopy: 'Abra su invitación',
		// The rendered disco room plays behind the live letter as it opens.
		openingVideo: {
			webm: '/videos/valeria-hernandez/opening.webm',
			mp4: '/videos/valeria-hernandez/opening.mp4',
			poster: '/videos/valeria-hernandez/poster.webp',
		},
	},
	quote: {
		variant: 'neon-sign',
		text: 'Quince años,\nuna noche\ny una pista llena de luces.',
		closingLine: 'Me haría muy feliz que usted estuviera ahí.',
	},
	family: {
		// No family photograph was delivered, so the names stand alone.
		variant: 'standard',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: {
			father: 'Alfredo Hernández Gómez',
			mother: 'Laura Flores Galindo',
		},
		godparents: [{ name: 'Rolando Flores Espinoza' }, { name: 'Cristina Canela Gómez' }],
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: 'Esta noche se presentan',
			parentsTitle: 'Mis padres',
			godparentsTitle: 'Mis padrinos',
			sectionMessage: 'Gracias por acompañarme en cada paso hasta esta noche.',
		},
	},
	countdown: {
		variant: 'mirror-ball',
		title: 'Faltan',
		footerText: 'para mi noche disco',
		presentationOptions: { visibleUnits: ['days', 'hours', 'minutes', 'seconds'] },
	},
	location: {
		variant: 'program-sheet',
		accessPolicy: { visibility: 'public' },
		mapStyle: 'minimal',
		presentationOptions: {
			showCalendarLinks: true,
			indicationsLayout: 'enclosure',
			// The mass and the party are club passes that stack over a dance-floor night.
			scene: 'mirror-ball-route',
		},
		introHeading: 'Dos lugares, una noche',
		introLede:
			'A las 5:45 p. m. daré gracias en misa; a las 7:30 p. m. le espero en Las Barricas para celebrar.',
		indicationsHeading: 'Cherry disco',
		indicationsReference: {
			image: 'dressCodeReference',
			label: 'Ver inspiración',
			alt: 'Ideas de vestimenta glam disco: vestidos y trajes con lentejuelas, satín y brillos en negro, plata y dorado',
			note: 'El color vino queda reservado para la quinceañera.',
		},
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				title: 'Código de vestimenta',
				text: 'Glam disco: brillos y lentejuelas en negro, plata o dorado',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				title: 'Vino',
				text: 'Reservado para la quinceañera',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Misa',
				venueName: 'Parroquia de la Divina Providencia',
				address: '14 Oriente 4215, Col. El Porvenir, Puebla, Pue.',
				city: 'Puebla',
				date: '2027-01-09',
				time: '17:45',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Parroquia%20de%20la%20Divina%20Providencia%2C%2014%20Oriente%204215%2C%20El%20Porvenir%2C%20Puebla%2C%20Pue.',
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Las Barricas',
				address: 'Cto. Juan Pablo II 2455, Col. La Hacienda, Puebla, Pue.',
				city: 'Puebla',
				date: '2027-01-09',
				time: '19:30',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20Las%20Barricas%2C%20Cto.%20Juan%20Pablo%20Segundo%202455%2C%20La%20Hacienda%2C%20Puebla%2C%20Pue.',
				isVisible: true,
			},
		],
	},
	itinerary: {
		// Times, labels and order confirmed by the client; the night ends after midnight, on
		// January 10. The snacks note is hers too.
		variant: 'standard',
		title: 'Así será mi noche',
		subtitle: 'Nueve momentos para brillar juntos.',
		items: [
			{
				time: '17:45',
				iconName: 'Church',
				label: 'Ceremonia',
				description: 'Comenzamos dando gracias.',
			},
			{
				time: '19:30',
				iconName: 'Reception',
				label: 'Recepción',
				description: 'Se abren las puertas del salón.',
			},
			{
				time: '20:00',
				iconName: 'Crown',
				label: 'Entrada XV',
				description: 'Luces, música… y mi gran entrada.',
			},
			{
				time: '20:30',
				iconName: 'Taco',
				label: 'Snacks',
				description: 'Habrá snacks; no se servirá cena.',
			},
			{
				time: '21:30',
				iconName: 'Toast',
				label: 'Brindis',
				description: 'Copas en alto por mis quince.',
			},
			{
				time: '22:00',
				iconName: 'Waltz',
				label: 'Vals familiar',
				description: 'Un baile con quienes más quiero.',
			},
			{
				time: '00:00',
				iconName: 'Cake',
				label: 'Pastel',
				description: 'Algo dulce a la medianoche.',
			},
			{
				time: '00:10',
				iconName: 'Sparkles',
				label: 'Sorpresa',
				description: 'No se la pierda.',
			},
			{
				time: '02:00',
				iconName: 'Party',
				label: 'Fin del evento',
				description: 'Gracias por brillar conmigo.',
			},
		],
		closingNote: 'Llegue puntual: la noche no espera.',
	},
	gifts: {
		// The client asked for envelopes only.
		variant: 'gift-tag',
		title: 'Regalos',
		presentation: 'catalog',
		subtitle: 'Su presencia es mi mejor regalo.',
		items: [
			{
				type: 'cash',
				title: 'Lluvia de sobres',
				text: 'Si desea tener un detalle conmigo, será bienvenido en sobre el día de la fiesta.',
			},
		],
	},
	gallery: {
		// Two film strips of four prints that run through a pinned photo-booth window.
		variant: 'photo-booth',
		eyebrow: '',
		title: 'De niña a mis quince',
		items: [
			{
				image: 'gallery06',
				alt: 'Valeria bebé con un trajecito rosa.',
				focalPoint: '50% 45%',
			},
			{
				image: 'gallery03',
				alt: 'Valeria de niña con vestido rojo, junto a otra niña de vestido vino.',
				focalPoint: '50% 40%',
			},
			{
				image: 'gallery05',
				alt: 'Valeria de niña jugando en la arena de la playa.',
				focalPoint: '50% 50%',
			},
			{
				image: 'gallery08',
				alt: 'Valeria con abrigo rosa en el marco de una puerta.',
				focalPoint: '50% 40%',
			},
			{
				image: 'gallery04',
				alt: 'Valeria sonríe con un suéter tejido.',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery07',
				alt: 'Valeria con chamarra roja.',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery01',
				alt: 'Retrato de Valeria con sudadera.',
				focalPoint: '50% 35%',
			},
			{
				image: 'gallery02',
				alt: 'Valeria de noche, con las manos en señal de rock.',
				focalPoint: '50% 40%',
			},
		],
	},
	rsvp: {
		// Pass and confirmation read as one printed reply card; seats are fixed per guest.
		variant: 'reply-card',
		title: '¿Me acompaña?',
		// No deadline was given by the client, so the line asks for an early reply without a date.
		subcopy: 'Le agradeceré confirmar su asistencia con tiempo.',
		lockedMessage:
			'Cada pase de esta noche lleva un nombre. Abra el enlace que le envié para ver el suyo.',
		// Technical fallback only; every real pass carries the seats set per guest.
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		flow: 'steps',
		personalizedAccess: {
			variant: 'reply-card',
			title: 'Pase personal e intransferible',
			subtitle: 'Su lugar ya está apartado.',
			footerText: 'Confírmeme su llegada aquí abajo.',
		},
		labels: {
			name: 'Su nombre',
			guestHint: 'Tiene {count} lugares. Si vienen menos, ajústelo aquí.',
			stepAttendance: '¿Contamos con usted?',
			stepDetails: '¿Cuántos llegan, contándose usted?',
			notesLabel: 'Un mensaje para mí (opcional)',
			notesPlaceholder: 'Escríbame lo que quiera decirme',
		},
		confirmationMessage: 'Le espero el sábado 9 de enero, desde la misa de las 5:45 p. m.',
		responseMessages: {
			confirmed: {
				title: 'Su lugar está listo, {guestName}.',
				subtitle: 'Si sus planes cambian, aquí mismo puede corregir su respuesta.',
			},
			declined: {
				title: 'Me hará falta, {guestName}.',
				subtitle: 'Gracias por decírmelo a tiempo.',
			},
		},
	},
	thankYou: {
		// A smiling night photograph closes the page the way the party ends.
		variant: 'last-song',
		image: 'thankYouPortrait',
		// The last song: the hero's disco room plays its lights over the closing portrait.
		ambientVideo: {
			webm: '/videos/valeria-hernandez/hero-loop.webm',
			mp4: '/videos/valeria-hernandez/hero-loop.mp4',
			poster: '/videos/valeria-hernandez/hero-loop-poster.webp',
		},
		focalPoint: '50% 35%',
		message: 'Gracias por ser parte de mis quince años. Le espero el 9 de enero.',
		closingName: CELEBRANT_NAME,
		closingPhrase: 'Valeria · XV años · Puebla · MMXXVII',
	},
	navigation: [
		{ label: 'Lugar', href: '#event-location' },
		{ label: 'Familia', href: '#family-section' },
		{ label: 'Galería', href: '#galeria' },
		{ label: 'Confirmar', href: '#rsvp' },
	],
	music: {
		url: 'https://media.celebra-me.com/invitations/xv/valeria-hernandez/music-a3568da6f8a9ced712575065bf378bf6c3ca223bc365aca31c84e4dbaec38d09.mp3',
		title: 'Someone to Love (Piano Version) — Freya Skye',
		control: 'equalizer',
		autoPlay: true,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription: `Sábado ${EVENT_DATE_LABEL} · Puebla, Puebla. Misa a las 5:45 p. m. y recepción a las 7:30 p. m.`,
		// A custom reminder is sent verbatim to every status, so it never assumes a pending reply.
		shareMessages: {
			invitation:
				'Hola, {{invitado}}: el 9 de enero celebro mis quince y quiero verle ahí. En este enlace está su pase y puede confirmar:\n\n{{enlace}}',
			reminder:
				'Hola, {{invitado}}: {{hora_evento}} Ya casi es 9 de enero.\n\nSi aún no confirma, aquí puede hacerlo:\n{{enlace}}',
		},
	},
};

export default defineCanonicalInvitation({
	slug: 'valeria-hernandez',
	eventType: 'xv',
	title: `Mis XV Años — ${CELEBRANT_NAME}`,
	// The mother is the contracting client.
	clientName: 'Laura Flores Galindo',
	themeId: 'storybook-blush',
	visualProfileId: 'valeria-hernandez',
	eventTiming: VALERIA_TIMING,
	content,
	managedIdentityId: 'a1611c44-f6ee-44cc-906c-aa14de8b3f98',
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'valeria_hernandez',
	assetDir: 'src/invitations/clients/valeria-hernandez/assets',
	// One role per crop; the hero and the og card share one source photograph.
	assetFiles: {
		hero: 'hero.webp',
		thankYouPortrait: 'thank-you.webp',
		dressCodeReference: 'dress-code-reference.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		gallery07: 'gallery-07.webp',
		gallery08: 'gallery-08.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
