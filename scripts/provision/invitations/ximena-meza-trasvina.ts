import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	sectionOrder: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'personalizedAccess',
		'rsvp',
		'gifts',
		'thankYou',
	],
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-04-12T03:00:00.000Z',
		name: 'Ximena Meza Trasviña',
		label: 'Mis XV Años',
		portrait: 'portrait',
		backgroundImage: 'hero',
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		labels: {
			name: 'Tu nombre',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
		},
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		confirmationMessage: '¡Nos vemos en la fiesta!',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				text: 'Agradecemos su generosidad en el área de recepción.',
				type: 'cash',
				title: 'Lluvia de Sobres',
			},
		],
		title: 'Detalles para Celebrar',
		subtitle: 'Gracias por acompañarnos en este momento tan especial.',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1775084991/mi-nina-hermosa_zqi8ry.m4a',
		title: 'Música de fondo: Edición Premiere',
		autoPlay: true,
	},
	quote: {
		text: 'Entre flores y sueños, llega el momento más esperado.',
		author: 'Ximena',
	},
	theme: {
		preset: 'premiere-floral',
	},
	title: 'XV Años de Ximena',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Con la bendición de',
			sectionTitle: 'Mi Familia',
			sectionSubtitle: 'Círculo Íntimo',
		},
		parents: {
			father: 'Bladimir Meza Briceño',
			mother: 'Christian Jasiela Trasviña Valenzuela',
		},
		godparents: [
			{
				name: 'Abigail Limón Villalobos',
				role: 'Madrina de honor',
			},
			{
				name: 'Eduardo Arredondo Valenzuela',
				role: 'Padrino de honor',
			},
			{
				name: 'Karla Gabriela Montoya Valenzuela',
				role: 'Madrina de honor',
			},
		],
		featuredImage: 'family',
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: 'gallery01',
				caption: 'Mi Gran Día.',
			},
			{
				image: 'gallery02',
				caption: 'Preparada para Brillar.',
			},
			{
				image: 'gallery03',
				caption: 'Elegancia en Cada Detalle.',
			},
			{
				image: 'gallery04',
				caption: 'Brillo Natural.',
			},
			{
				image: 'gallery05',
				caption: 'Sueños en Seda.',
			},
			{
				image: 'gallery07',
				caption: 'Reflejo de Alegría.',
			},
			{
				image: 'gallery09',
				caption: 'Movimiento y Luz.',
			},
			{
				image: 'gallery10',
				caption: 'Actitud y Confianza.',
			},
		],
		title: 'Editorial de Ximena',
		subtitle: 'Un recorrido visual por la esencia, el brillo y la elegancia.',
		variant: 'uniform-grid',
	},
	sharing: {
		ogImage: 'portrait',
		whatsappTemplate:
			'Hola {name}, te comparto tu invitación para los XV años de Ximena: {inviteUrl}',
	},
	envelope: {
		disabled: false,
		sealIcon: 'flower',
		microcopy: 'Abre Tu Invitación',
		sealStyle: 'wax',
		sealInitials: 'X·M',
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
				text: 'Dress Code <strong>El color rosa es exclusivo para la quinceañera</strong>',
				iconName: 'Crown',
				styleVariant: 'reserved',
			},
			{
				text: '<strong>Favor de confirmar antes del 8 de abril</strong>',
				iconName: 'Enveloped',
				styleVariant: 'default',
			},
		],
		venues: [
			{
				city: 'Los Mochis',
				date: '11 de abril de 2026',
				time: '20:00',
				image: 'jardin',
				mapUrl: 'https://www.google.com/maps/search/?api=1&query=D%27Galaz+Alberca+y+Eventos+Los+Mochis',
				address: 'Av Chihuahua 2979, Los Mochis, Sin.',
				venueName: "D'Galaz Alberca y Eventos",
				venueEvent: 'Ubicación del evento',
				appleMapsUrl: 'https://maps.apple.com/?q=D%27Galaz+Alberca+y+Eventos+Los+Mochis',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=D%27Galaz+Alberca+y+Eventos+Los+Mochis',
				type: 'reception',
				isVisible: true,
			},
		],
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'standard',
		image: 'thankYouPortrait',
		message: 'Gracias por ser parte de mis XV. Su cariño hace que este sueño brille aún más.',
		closingName: 'Ximena Meza Trasviña',
	},
	countdown: {
		variant: 'standard',
		title: 'La gran noche comienza en',
		footerText: "D'Galaz Alberca y Eventos, Los Mochis, Sinaloa",
	},
	eventType: 'xv',
	itinerary: {
		variant: 'standard',
		title: 'Programa de la Noche',
		items: [
			{
				time: '20:00',
				label: 'Recepción',
				iconName: 'Reception',
				description: 'Los primeros en llegar.',
			},
			{
				time: '22:00',
				label: 'Vals',
				iconName: 'Waltz',
				description: 'Un baile que marca esta noche.',
			},
			{
				time: '22:30',
				label: 'Brindis',
				iconName: 'Toast',
				description: 'Para celebrar esta nueva etapa.',
			},
			{
				time: '23:00',
				label: 'Cena',
				iconName: 'Dinner',
				description: 'Acompañados de buena mesa.',
			},
			{
				time: '23:30',
				label: 'Pastel',
				iconName: 'Cake',
				description: 'El momento más dulce.',
			},
		],
	},
	_assetSlug: 'ximena-meza-trasvina',
	interludes: [
		{
			alt: 'Jardín privado iluminado para la gala',
			image: 'interlude01',
			height: 'screen',
			afterSection: 'family',
		},
		{
			alt: 'Brillo rose metal cinematográfico',
			image: 'interlude02',
			height: 'screen',
			afterSection: 'gallery',
		},
		{
			alt: 'Explosión artística de destellos en el jardín',
			image: 'interlude03',
			height: 'screen',
			afterSection: 'countdown',
		},
		{
			alt: 'Rosas en tonos rosados y rose gold fluyendo editorialmente',
			image: 'interlude04',
			height: 'screen',
			focalPoint: 'center 15%',
			afterSection: 'location',
		},
		{
			alt: 'Detalle editorial de texturas y perlas',
			image: 'interlude05',
			height: 'screen',
			afterSection: 'itinerary',
		},
		{
			alt: 'Retrato editorial final',
			image: 'interlude06',
			height: 'screen',
			focalPoint: 'center 20%',
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
	eventTiming: {
		localDateTime: '2026-04-11T20:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-04-12T03:00:00.000Z',
	},
	description: 'Acompáñame a celebrar este momento tan especial.',
};

export const ximenaInvitation = defineCanonicalInvitation({
	slug: 'ximena-meza-trasvina',
	eventType: 'xv',
	title: 'XV años de Ximena',
	baseDemoId: 'demo-xv-premiere-floral',
	themeId: 'premiere-floral',
	visualProfileId: 'ximena-meza-trasvina',
	eventTiming: {
		localDateTime: '2026-04-11T20:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-04-12T03:00:00.000Z',
	},
	content,
	managedIdentityId: '8fc66849-5145-412b-a610-cf717177ef70',
	managedIdentityProvenance: 'persisted',
	hostLoginAlias: 'ximena_meza_trasvina',
	assetDir: 'src/assets/images/events/ximena-meza-trasvina',
	assetFiles: {
		hero: 'hero.webp',
		portrait: 'portrait.webp',
		family: 'family.webp',
		jardin: 'gallery-03.webp',
		gallery01: 'portrait.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery07: 'ai/gallery-07.webp',
		gallery09: 'ai/gallery-09.webp',
		gallery10: 'gallery-10.webp',
		interlude01: 'gallery-12.webp',
		interlude02: 'ai/gallery-09.webp',
		interlude03: 'gallery-10.webp',
		interlude04: 'gallery-04.webp',
		interlude05: 'ai/interlude-01.webp',
		interlude06: 'interlude-04.webp',
		thankYouPortrait: 'thank-you-portrait.webp',
	},

	deliveryScope: 'content-and-assets',
	lifecycle: 'published',
});
