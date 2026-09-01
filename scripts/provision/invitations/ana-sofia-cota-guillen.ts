import { defineCanonicalInvitation } from './canonical-definition.ts';

const content = {
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
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-05-23T07:00:00.000Z',
		name: 'Ana Sofía Cota Guillen',
		label: 'Mis XV Años',
		portrait: 'portrait',
		backgroundImage: 'hero',
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		labels: {
			name: 'Tu nombre',
			attendance: 'Asistencia',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
		},
		subcopy:
			'Tu respuesta nos ayuda a preparar cada detalle para compartir esta noche especial contigo.',
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		confirmationMessage: 'Nos dará mucha alegría compartir esta noche contigo.',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				text: 'Si deseas tener un detalle conmigo, podrás encontrar el buzón durante la recepción.',
				type: 'cash',
				title: 'Tu presencia es lo más importante',
			},
		],
		title: 'Lluvia de Sobres',
		subtitle: 'Gracias por acompañarnos en este momento tan especial.',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1778284157/Perfect-ultralight_pkrwyr.mp3',
		title: 'Música de fondo',
		autoPlay: true,
	},
	quote: {
		text: 'Hoy celebro rodeada del amor, la luz y las personas que más quiero.',
		author: 'Ana Sofía',
	},
	theme: {
		preset: 'celestial-blue',
	},
	title: 'XV Años de Ana Sofía',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Con la bendición de',
			sectionTitle: 'Mi Familia',
			sectionMessage:
				'Hoy celebro un recuerdo que guardaré para siempre en el corazón. Gracias por estar aquí, por su cariño y por formar parte de una noche que permanecerá conmigo toda la vida.',
			godparentsTitle: 'Padrinos',
			sectionSubtitle: 'Con amor y gratitud',
		},
		parents: {
			father: 'Jesus Eduardo Cota Perez',
			mother: 'Xiomara Karely Guillen García',
		},
		godparents: [
			{
				name: 'Sergio Pablo García Ramos',
				role: 'Padrino',
			},
			{
				name: 'Dunelin Valdez Pacheco',
				role: 'Madrina',
			},
			{
				name: 'Evelia Parra Torres',
				role: 'Madrina',
			},
			{
				name: 'Miguel Armando Valencia Ochoa',
				role: 'Padrino',
			},
		],
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: 'gallery01',
				caption: 'Un momento especial capturado en luz y cristal.',
			},
			{
				image: 'gallery02',
				caption: 'Detalles que reflejan mi gran noche.',
			},
			{
				image: 'gallery03',
				caption: 'Elegancia y brillo en tonos de cielo.',
			},
			{
				image: 'gallery04',
				caption: 'Recuerdos que guardaré para siempre.',
			},
			{
				image: 'gallery05',
				caption: 'Sonrisas y sueños cumplidos.',
			},
			{
				image: 'gallery06',
				caption: 'Un instante de magia.',
			},
			{
				image: 'gallery07',
				caption: 'La belleza de cada detalle azul.',
			},
			{
				image: 'gallery08',
				caption: 'Disfrutando este momento inolvidable.',
			},
			{
				image: 'gallery09',
				caption: 'Juventud y alegría en una noche perfecta.',
			},
			{
				image: 'gallery10',
				caption: 'Agradecida por hacer de mis XV un sueño.',
			},
		],
		title: 'Galería de Ana Sofía',
		subtitle: 'Un recuerdo en tonos de cielo, cristal y luz.',
		variant: 'index-choreography',
	},
	sharing: {
		ogImage: 'portrait',
		whatsappTemplate:
			'Hola {name}, te comparto tu invitación para los XV años de Ana Sofía: {inviteUrl}',
	},
	envelope: {
		disabled: false,
		sealIcon: 'flower',
		microcopy: 'Abre Tu Invitación',
		sealStyle: 'wax',
		sealInitials: 'A·S',
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
		indications: [
			{
				icon: 'dressCode',
				text: 'Código de vestimenta <strong>formal</strong>. El color <strong>azul cielo</strong> está reservado para la quinceañera.',
				iconName: 'DressCode',
				styleVariant: 'reserved',
			},
			{
				icon: 'calendar',
				text: 'Favor de confirmar asistencia <strong>antes del 19 de mayo</strong>.',
				iconName: 'Calendar',
				styleVariant: 'default',
			},
		],
		indicationsHeading: 'Indicaciones',
		venues: [
			{
				city: 'Los Mochis',
				date: '23 de mayo de 2026',
				time: '18:00',
				image: 'ceremony',
				mapUrl: 'https://maps.app.goo.gl/WkDJn3uyRxkaiPGJ6',
				address: 'Nuevo Horizonte, Los Mochis, Sin.',
				venueName: 'Nuestra Señora de Lourdes',
				venueEvent: 'Misa de Acción de Gracias',
				type: 'ceremony',
				isVisible: true,
			},
			{
				city: 'Los Mochis',
				date: '23 de mayo de 2026',
				time: '20:00',
				image: 'reception',
				mapUrl: 'https://maps.app.goo.gl/1Zap316H49aywawK7',
				address: 'Ejido Mochis, Los Mochis, Sin.',
				venueName: "Palapa Zavala's",
				venueEvent: 'Recepción',
				type: 'reception',
				isVisible: true,
			},
		],
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'editorial-back-cover',
		image: 'thankYouPortrait',
		message:
			'Gracias por ser parte de mis XV años. Tu cariño y compañía hacen que este día sea aún más especial.',
		focalPoint: '50% 30%',
		closingName: 'Ana Sofía Cota Guillen',
	},
	countdown: {
		variant: 'standard',
		title: 'La celebración comienza en',
		footerText: '23 de mayo de 2026, Los Mochis, Sinaloa',
	},
	eventType: 'xv',
	itinerary: {
		variant: 'timeline-paper',
		title: 'Programa',
		items: [
			{
				time: '18:00',
				label: 'Misa',
				iconName: 'Church',
				description: 'Ceremonia de Acción de Gracias.',
			},
			{
				time: '20:00',
				label: 'Recepción',
				iconName: 'Reception',
				description: "Bienvenida en Palapa Zavala's.",
			},
			{
				time: '21:30',
				label: 'Vals',
				iconName: 'Waltz',
				description: 'Un momento para recordar.',
			},
			{
				time: '22:30',
				label: 'Cena',
				iconName: 'Dinner',
				description: 'Compartiremos la mesa en familia.',
			},
			{
				time: '01:00',
				label: 'Cierre',
				iconName: 'Party',
				description: 'Gracias por celebrar con nosotros.',
			},
		],
	},
	_assetSlug: 'ana-sofia-cota-guillen',
	interludes: [
		{
			alt: 'Ana Sofía con vestido azul cielo y detalles plateados',
			image: 'interlude01',
			height: 'screen',
			lightX: '44%',
			lightY: '44%',
			focalPoint: '50% 35%',
			afterSection: 'location',
		},
		{
			alt: 'Retrato elegante de Ana Sofía con corona',
			image: 'interlude02',
			height: 'screen',
			lightX: '54%',
			lightY: '34%',
			focalPoint: '50% 25%',
			afterSection: 'family',
		},
		{
			alt: 'Detalle de pastel con listones azules',
			image: 'interlude03',
			height: 'screen',
			lightX: '68%',
			lightY: '44%',
			focalPoint: '54% 62%',
			afterSection: 'itinerary',
			overlayOpacity: '14%',
		},
		{
			alt: 'Retrato final de Ana Sofía en tonos plata y azul',
			image: 'interlude04',
			height: 'screen',
			lightX: '42%',
			lightY: '42%',
			focalPoint: '50% 34%',
			afterSection: 'rsvp',
		},
	],
	navigation: [
		{
			href: '#inicio',
			label: 'Inicio',
		},
		{
			href: '#event-location',
			label: 'Ubicación',
		},
		{
			href: '#galeria',
			label: 'Galería',
		},
		{
			href: '#regalos',
			label: 'Regalos',
		},
		{
			href: '#rsvp',
			label: 'Confirmar',
		},
	],
	description:
		'Acompáñanos a celebrar una noche llena de luz, elegancia y momentos inolvidables.',
} as Record<string, unknown>;

export const anaSofiaInvitation = defineCanonicalInvitation({
	slug: 'ana-sofia-cota-guillen',
	eventType: 'xv',
	title: 'XV Años de Ana Sofía',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'celestial-blue',
	visualProfileId: 'ana-sofia-cota-guillen',
	eventTiming: {
		localDateTime: '',
		timeZone: '',
		startsAtUtc: '',
	},
	content,
	managedIdentityId: 'cd404b9a-fc0a-40cf-ae21-d5c8d6f79dc7',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'ana_sofia_cota_guillen',
	assetDir: 'src/assets/images/events/ana-sofia-cota-guillen',
	assetFiles: {
		ceremony: 'ceremony.webp',
		family: 'family.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		gallery07: 'gallery-07.webp',
		gallery08: 'gallery-08.webp',
		gallery09: 'gallery-09.webp',
		gallery10: 'gallery-10.webp',
		hero: 'hero.webp',
		interlude01: 'interlude-01.webp',
		interlude02: 'interlude-02.webp',
		interlude03: 'interlude-03.webp',
		interlude04: 'interlude-04.webp',
		portrait: 'portrait.webp',
		reception: 'reception.webp',
		thankYouPortrait: 'thank-you-portrait.webp',
	},

	deliveryScope: 'content-and-assets',
});
