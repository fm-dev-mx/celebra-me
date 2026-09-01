import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-08-01T18:00:00.000Z',
		name: 'Ayrin Samantha Lerma Castro',
		label: 'Mis XV años',
		nickname: '',
		portrait: {
			key: 'portrait',
			type: 'internal',
		},
		secondaryName: '',
		backgroundImage: 'hero',
		backgroundImageMobile: 'heroMobile',
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirmación de asistencia',
		subcopy: 'Te esperamos para celebrar juntos.',
		guestCap: 5,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		responseMessages: {
			confirmed: {
				title: 'Gracias por acompañarnos, {guestName}.',
				subtitle: 'Tu confirmación ha sido registrada.',
			},
		},
		confirmationMessage: 'Confirma tu asistencia a los XV años de Ayrin Samantha.',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				text: '',
				type: 'cash',
				title: 'Lluvia de sobres',
			},
		],
		title: 'Mesa de regalos',
		subtitle:
			'Tu presencia es el regalo más valioso. Si deseas tener un detalle adicional, habrá un cofre para sobres el día del evento.',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1780703235/Taylor_Swift_-_Style_compressed_r5caxg.mp3',
		title: 'Style — Taylor Swift',
		autoPlay: true,
	},
	quote: {
		text: 'A Dios por la vida y las bendiciones, a mis padres por su amor incondicional, y por hacer mi sueño realidad.',
		author: 'Ayrin Samantha',
	},
	theme: {
		preset: 'enchanted-rose',
		fontFamily: 'serif',
	},
	title: 'XV Años de Ayrin Samantha',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Con la bendición de',
			sectionTitle: 'Mi Familia',
			sectionMessage:
				'Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos.',
			godparentsTitle: 'Padrinos',
			sectionSubtitle: 'Con amor y gratitud',
		},
		parents: {
			father: 'Cristhian Jesús Lerma Higuera',
			mother: 'Nirya Samantha Castro Martínez',
			fatherDeceased: false,
			motherDeceased: false,
		},
		godparents: [
			{
				name: 'Wilfrido Ruiz Castro',
			},
			{
				name: 'María Dolores Luna Morales',
			},
		],
		parentsOrder: 'father-first',
		sectionMessage:
			'Hija, parece que fue ayer cuando te tuvimos en nuestros brazos por primera vez. \nHoy celebramos tus XV años y en lo maravillosa que te has convertido. Te amamos.',
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: {
					key: 'gallery10',
					type: 'internal',
				},
				caption: 'Entre rosas, velas y un toque de magia.',
			},
			{
				image: {
					key: 'gallery06',
					type: 'internal',
				},
				caption: 'Un instante envuelto en luz dorada.',
			},
			{
				image: {
					key: 'gallery03',
					type: 'internal',
				},
				caption: 'El brillo antiguo de una noche de gala.',
			},
			{
				image: {
					key: 'gallery08',
					type: 'internal',
				},
				caption: 'Momentos que florecen con cariño.',
			},
			{
				image: {
					key: 'gallery02',
					type: 'internal',
				},
				caption: 'Primer plano con detalles rosados.',
				focalPoint: '47% 0%',
			},
			{
				image: {
					key: 'gallery04',
					type: 'internal',
				},
				caption: 'Cadenas doradas, flores y luz suave al fondo.',
			},
			{
				image: {
					key: 'interlude01',
					type: 'internal',
				},
				caption: 'Un nuevo capítulo entre rosas.',
			},
		],
		title: 'Instantes de Ayrin',
		eyebrow: 'Galería',
		subtitle: 'Una selección de momentos entre rosas, luz cálida y detalles dorados.',
		variant: 'feature-mosaic',
	},
	sharing: {
		ogImage: {
			key: 'portrait',
			type: 'internal',
		},
		ogDescription: 'Celebra con nosotros los XV años de Ayrin Samantha.',
		shareMessages: {
			reminder:
				'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
			invitation:
				'Hola {guestName}, te compartimos tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		},
		reminderSettings: {
			enabled: true,
			audience: 'all-shared',
			showWhenDaysBeforeEvent: 10,
		},
	},
	envelope: {
		disabled: false,
		sealIcon: 'flower',
		microcopy: 'Abre tu invitación',
		sealStyle: 'wax',
		sealInitials: 'A•S',
		closedPalette: {
			accent: 'actionAccent',
			primary: 'surfacePrimary',
			background: 'surfaceDark',
		},
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		presentationOptions: {
			showFlourishes: true,
		},
		introLede: 'Aquí encontrarás la ruta para llegar al evento.',
		indications: [
			{
				text: 'Tonos reservados para la quinceañera: dorado, champagne y vino.',
				iconName: 'Sparkles',
				styleVariant: 'default',
			},
			{
				text: 'Vestimenta formal',
				iconName: 'DressCode',
				styleVariant: 'default',
			},
		],
		introEyebrow: 'Punto de encuentro',
		introHeading: 'Ceremonia y recepción',
		indicationsHeading: 'Indicaciones',
		venues: [
			{
				date: '2026-08-01',
				time: '18:00',
				image: {
					key: 'mapCeremony',
					type: 'internal',
				},
				mapUrl: 'https://maps.app.goo.gl/jLJPcB1pTMKTJrBy7?g_st=iwb',
				address: 'Av. Independencia, Col. Centro',
				venueName: 'Parroquia del Santuario de Guadalupe',
				venueEvent: 'Ceremonia',
				type: 'ceremony',
				isVisible: true,
			},
			{
				date: '2026-08-01',
				time: '20:00',
				image: {
					key: 'mapReception',
					type: 'internal',
				},
				mapUrl: 'https://maps.app.goo.gl/chSToUcmmaN8ejWH6?g_st=awb',
				address: 'Av. Santos Degollado #30, Fracc. Las Fuentes',
				venueName: 'Viñedos',
				venueEvent: 'Recepción',
				type: 'reception',
				isVisible: true,
			},
		],
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'editorial-back-cover',
		image: {
			key: 'thankYouPortrait',
			type: 'internal',
		},
		message:
			'Gracias por ser parte de este momento tan importante para mí. Compartir mis XV años con ustedes convierte esta noche en un recuerdo que guardaré siempre en mi corazón.',
		closingName: 'Ayrin Lerma',
	},
	countdown: {
		variant: 'standard',
		title: 'La celebración comienza en',
		footerText: 'Viñedos • LOS MOCHIS, SINALOA',
	},
	eventType: 'xv',
	itinerary: {
		variant: 'standard',
		title: 'Programa',
		items: [
			{
				time: '18:00',
				label: 'Ceremonia Religiosa',
				iconName: 'Church',
				description: 'Un momento especial para agradecer',
			},
			{
				time: '20:00',
				label: 'Recepción',
				iconName: 'Reception',
				description: 'Nos reuniremos en el Salón Viñedos para dar inicio a la celebración.',
			},
			{
				time: '20:30',
				label: 'Vals',
				iconName: 'Waltz',
				description: 'Uno de los momentos más especiales de la noche.',
			},
			{
				time: '21:30',
				label: 'Cena',
				iconName: 'Dinner',
				description: 'Cena especial en compañía de nuestros seres queridos.',
			},
			{
				time: '01:00',
				label: 'Cierre',
				iconName: 'Party',
				description: 'Gracias por celebrar conmigo.',
			},
		],
	},
	_assetSlug: 'demo-xv-enchanted-rose',
	interludes: [
		{
			alt: 'Detalle de palacio con espejo antiguo y rosas rojas',
			image: {
				key: 'interlude02',
				type: 'internal',
			},
			height: 'screen',
			lightX: '54%',
			lightY: '34%',
			focalPoint: '50% 25%',
			afterSection: 'family',
		},
		{
			alt: 'Mesa de gala con velas, detalles dorados y rosas',
			image: {
				key: 'interlude03',
				type: 'internal',
			},
			height: 'screen',
			lightX: '68%',
			lightY: '44%',
			focalPoint: '54% 22%',
			afterSection: 'gallery',
			overlayOpacity: '18%',
		},
	],
	description:
		'Una invitación de palacio con rosas rojas, luz de velas y una atmósfera cálida de gala para celebrar XV años.',
	eventTiming: {
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-08-02T01:00:00.000Z',
		localDateTime: '2026-08-01T18:00',
	},
	sectionOrder: [
		'quote',
		'location',
		'countdown',
		'family',
		'itinerary',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
};

export const ayrinInvitation = defineCanonicalInvitation({
	slug: 'ayrin-samantha-lerma-castro',
	eventType: 'xv',
	title: 'XV Años de Ayrin Samantha',
	baseDemoId: 'demo-xv-enchanted-rose',
	themeId: 'enchanted-rose',
	visualProfileId: 'ayrin-samantha-lerma-castro',
	eventTiming: {
		localDateTime: '2026-08-01T18:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-08-02T01:00:00.000Z',
	},
	content,
	managedIdentityId: '74f2410f-22f9-4201-a015-9ed2a7823ebe',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'ayrin_samantha_lerma_castro',
	assetDir: 'src/assets/images/events/xv-ayrin-samantha-lerma-castro',
	assetFiles: {
		hero: 'remote-hero.webp',
		heroMobile: 'remote-hero-mobile.webp',
		portrait: 'portrait.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery06: 'gallery-06.webp',
		gallery08: 'gallery-08.webp',
		gallery10: 'gallery-10.webp',
		interlude01: 'interlude-01.webp',
		interlude02: 'interlude-02.webp',
		interlude03: 'interlude-03.webp',
		mapCeremony: 'map-ceremony.webp',
		mapReception: 'map-reception.webp',
		thankYouPortrait: 'thank-you-portrait.webp',
	},
	deliveryScope: 'content-and-assets',
});
