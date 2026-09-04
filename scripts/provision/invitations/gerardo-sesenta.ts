import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	sectionOrder: [
		'quote',
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
		date: '2026-02-22T03:00:00.000Z',
		name: 'Gerardo Mendoza',
		label: '60 Años',
		nickname: 'Jefe Botas',
		portrait: 'portrait',
		backgroundImage: 'hero',
	},
	rsvp: {
		variant: 'standard',
		labels: {
			name: 'Nombre del invitado *',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
		},
		title: 'Confirma tu asistencia',
		subcopy:
			'Tu confirmación nos ayuda a preparar cada detalle para celebrar esta noche especial.',
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		confirmationMessage: 'Gracias por acompañar a Gerardo en esta noche tan especial.',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				text: 'Gracias por acompañarnos en esta celebración tan especial.',
				type: 'cash',
				title: 'Lluvia de Sobres',
			},
		],
		title: 'Tu Presencia es lo Más Importante',
		subtitle: 'Si deseas tener un detalle adicional, habrá buzón para sobres en recepción.',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1771003968/el-rey_sptxkp.mp3',
		title: 'Música de fondo',
		autoPlay: false,
	},
	quote: {
		text: 'La vida se celebra mejor cuando la mesa está llena, la música suena fuerte y la familia está cerca.',
		author: 'Gerardo Mendoza',
	},
	theme: {
		preset: 'luxury-hacienda',
	},
	title: 'Gerardo Mendoza | 60 Años',
	isDemo: false,
	gallery: {
		items: [
			{
				image: 'gallery01',
				caption: 'Una entrada con carácter.',
			},
			{
				image: 'gallery02',
				caption: 'El ambiente listo para recibir a la familia.',
			},
			{
				image: 'gallery03',
				caption: 'Detalles que enmarcan la celebración.',
			},
			{
				image: 'gallery04',
				caption: 'La noche toma forma.',
			},
			{
				image: 'gallery05',
				caption: 'Brindis, conversación y buenos recuerdos.',
			},
			{
				image: 'gallery06',
				caption: 'Un cierre con sabor a fiesta.',
			},
		],
		title: 'Memorias del Festejo',
		subtitle: 'Instantes, detalles y la esencia de una noche para recordar.',
		variant: 'feature-stack',
	},
	sharing: {
		whatsappTemplate:
			'Hola {name}, te comparto la invitación para celebrar los 60 años de Gerardo Mendoza. Aquí puedes ver los detalles y confirmar tu asistencia: {inviteUrl}',
	},
	envelope: {
		disabled: false,
		sealIcon: 'boot',
		microcopy: 'Abre el sobre para descubrir los detalles',
		sealStyle: 'wax',
		stampText: 'EST. 1966',
		stampYear: '2026',
		tooltipText: 'Acceder a la invitación',
		sealInitials: 'G·M',
		closedPalette: {
			primary: 'surfacePrimary',
			background: 'surfaceDark',
		},
		documentLabel: 'INVITACIÓN PRIVADA',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		indications: [
			{
				text: 'Código de vestimenta: <strong>casual elegante</strong>',
				iconName: 'Gift',
				styleVariant: 'default',
			},
			{
				text: 'Favor de confirmar tu asistencia antes del <strong>14 de febrero</strong>',
				iconName: 'Enveloped',
				styleVariant: 'reserved',
			},
		],
		venues: [
			{
				city: 'Los Mochis',
				date: '21 de febrero de 2026',
				time: '20:00',
				image: 'jardin',
				address: 'Ignacio Ramírez 460, Fátima, 81220 Los Mochis, Sin.',
				venueName: 'Jardín De Eventos Cuatro 60',
				venueEvent: 'Gran Festejo',
				googleMapsUrl: 'https://maps.app.goo.gl/KuRk4L96VD5T2GfR9',
				type: 'reception',
				isVisible: true,
			},
		],
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'standard',
		image: 'portrait',
		message:
			'Gracias por ser parte de esta historia y por acompañarnos a celebrar una noche tan significativa.',
		closingName: 'Gerardo Mendoza',
	},
	countdown: {
		variant: 'standard',
		title: 'La celebración comienza en',
		footerText: 'Jardín De Eventos Cuatro 60, Los Mochis, Sinaloa',
	},
	eventType: 'cumple',
	itinerary: {
		variant: 'standard',
		title: 'Programa de la Noche',
		items: [
			{
				time: '20:00',
				label: 'Recepción',
				iconName: 'Reception',
				description: 'Bienvenida y acceso al jardín.',
			},
			{
				time: '21:00',
				label: 'Brindis',
				iconName: 'Toast',
				description: 'Palabras y buenos deseos para el festejado.',
			},
			{
				time: '21:30',
				label: 'Cena',
				iconName: 'Dinner',
				description: 'Una mesa servida para celebrar en grande.',
			},
			{
				time: '23:00',
				label: 'Música en Vivo',
				iconName: 'Tuba',
				description: 'La noche sube de nivel.',
			},
			{
				time: '00:00',
				label: 'Baile',
				iconName: 'Party',
				description: 'Porque los 60 también se bailan.',
			},
		],
	},
	_assetSlug: 'gerardo-sesenta',
	interludes: [
		{
			alt: 'Memorias del festejo Gerardo Mendoza',
			image: 'interlude01',
			height: 'screen',
			afterSection: 'itinerary',
		},
		{
			alt: 'Detalles de la celebración',
			image: 'interlude02',
			height: 'screen',
			afterSection: 'gifts',
		},
	],
	navigation: [
		{
			href: '#inicio',
			label: 'Inicio',
		},
		{
			href: '#galeria',
			label: 'Galería',
		},
		{
			href: '#event-location',
			label: 'Ubicación',
		},
		{
			href: '#rsvp',
			label: 'Confirmar',
		},
		{
			href: '#regalos',
			label: 'Regalos',
		},
	],
	eventTiming: {
		localDateTime: '2026-02-21T20:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-02-22T03:00:00.000Z',
	},
	description:
		'Una noche para celebrar el legado, la familia y los 60 años de Gerardo Mendoza en Los Mochis.',
};

export const gerardoInvitation = defineCanonicalInvitation({
	slug: 'gerardo-sesenta',
	eventType: 'cumple',
	title: 'Gerardo Mendoza | 60 Años',
	baseDemoId: 'demo-cumple-luxury-hacienda',
	themeId: 'luxury-hacienda',
	visualProfileId: 'gerardo-sesenta',
	eventTiming: {
		localDateTime: '2026-02-21T20:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-02-22T03:00:00.000Z',
	},
	content,
	managedIdentityId: 'b081843b-b75a-423d-ae78-23a3ca9fe777',
	managedIdentityProvenance: 'persisted',
	hostLoginAlias: 'gerardo_sesenta',
	assetDir: 'src/assets/images/events/gerardo-sesenta',
	assetFiles: {
		hero: 'hero.webp',
		portrait: 'portrait.webp',
		jardin: 'jardin.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		interlude01: 'gallery-01.webp',
		interlude02: 'gallery-02.webp',
	},

	deliveryScope: 'content-and-assets',
	lifecycle: 'published',
});
