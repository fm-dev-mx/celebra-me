import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-09-12T19:00:00.000Z',
		name: 'Xareni Iyarit',
		label: 'XV años de Xareni Iyarit',
		nickname: '',
		portrait: {
			key: 'portrait',
			type: 'internal',
		},
		secondaryName: '',
		backgroundImage: 'hero',
		backgroundImageMobile: 'heroMobile',
		backgroundImageDesktop: {
			key: 'heroDesktop',
			type: 'internal',
		},
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		subcopy: 'Tu respuesta nos ayuda a preparar cada detalle para recibirte con mucho cariño.',
		guestCap: 4,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'ornamented',
		},
		confirmationMessage:
			'Gracias por confirmar. Me dará mucha alegría compartir esta noche contigo.',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				type: 'store',
				links: [
					{
						url: 'https://www.amazon.com.mx/registries/gl/guest-view/9ZB19QOMLJ45',
						label: 'Amazon',
					},
					{
						url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/52015693',
						label: 'Liverpool',
					},
				],
				title: 'Mesa de regalos',
				description: 'Puedes consultar mis listas de regalos en Amazon y Liverpool.',
			},
			{
				text: 'También contaremos con un espacio especial durante la recepción.',
				type: 'cash',
				title: 'Lluvia de sobres',
			},
		],
		title: 'Regalos',
		subtitle:
			'Tu presencia es mi mejor regalo. Si deseas tener un detalle conmigo, te comparto estas opciones:',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1782061133/Laufey_-_Letter_To_My_13_Year_Old_Self_optimized_hehyzv.mp3',
		title: 'Bewitched - Laufey',
		autoPlay: true,
	},
	quote: {
		text: 'Mis quince años son el inicio de una nueva historia escrita con amor, fe y esperanza.',
		author: 'Xareni Iyarit',
	},
	theme: {
		preset: 'celestial-blue',
		fontFamily: 'serif',
	},
	title: 'XV años de Xareni Iyarit',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Mis primeros guías',
			sectionTitle: 'Junto a quienes amo',
			sectionMessage:
				'Gracias por acompañarme en este momento tan especial. Su cariño hace que mis XV años sean un recuerdo inolvidable.',
			godparentsTitle: 'Con gratitud especial',
			sectionSubtitle: 'Mis raíces',
		},
		parents: {
			father: 'Ignacio Sabino Sánchez Carrasco',
			mother: 'Nabil Hernández García',
		},
		parentsOrder: 'father-first',
		presentation: 'text-only',
		featuredImage: {
			key: 'family',
			type: 'internal',
		},
		godparentGroups: [
			{
				label: 'Padrino',
				godparents: [
					{
						name: 'José Rosendo Hernández Martínez',
					},
				],
				honoreeName: 'Xareni Iyarit',
			},
			{
				label: 'Madrina',
				godparents: [
					{
						name: 'Airemy Grisel Hernández García',
					},
				],
				honoreeName: 'Xareni Iyarit',
			},
		],
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: {
					key: 'gallery01',
					type: 'internal',
				},
				caption: 'Un sueño en rosa champagne.',
			},
			{
				image: {
					key: 'gallery02',
					type: 'internal',
				},
				caption: 'La ilusión de una noche inolvidable.',
			},
			{
				image: {
					key: 'gallery03',
					type: 'internal',
				},
				caption: 'Detalles que cuentan mi historia.',
			},
			{
				image: {
					key: 'gallery04',
					type: 'internal',
				},
				caption: 'Elegancia y gratitud en cada instante.',
			},
			{
				image: {
					key: 'gallery05',
					type: 'internal',
				},
				caption: 'Un recuerdo para llevar en el corazón.',
			},
			{
				image: {
					key: 'gallery06',
					type: 'internal',
				},
				caption: 'Celebrar rodeada de amor.',
			},
		],
		title: 'Instantes que guardan la magia de mis XV.',
		eyebrow: '',
		subtitle: 'Fotografías que capturan la magia, la emoción y la belleza de este día.',
		variant: 'index-choreography',
	},
	sharing: {
		ogDescription:
			'Acompáñame en mis XV años el sábado, 12 de septiembre de 2026, en Apizaco, Tlaxcala.',
		shareMessages: {
			reminder:
				'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
			invitation:
				'Hola {{invitado}}, te comparto tu invitación a los {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		},
	},
	envelope: {
		disabled: false,
		sealIcon: 'flower',
		cardLabel: 'Mis XV años',
		microcopy: 'Toca para abrir mi invitación',
		sealColor: 'deepMauve',
		sealStyle: 'wax',
		stampText: 'Xareni Iyarit',
		stampYear: '2026',
		cardTagline: 'Te espero en este día tan especial',
		sealVariant: 'premium-rose',
		sealInitials: 'X·I',
		closedPalette: {
			accent: 'actionAccent',
			primary: 'surfacePrimary',
			background: 'surfacePrimary',
		},
		documentLabel: 'Mis XV años',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		venues: [
			{
				id: 'venue_211',
				city: 'Apizaco, Tlaxcala',
				date: '2026-09-12',
				time: '19:00',
				type: 'ceremony',
				label: 'Ceremonia',
				mapUrl: 'https://maps.app.goo.gl/58uHVrMTA9GMtBtZ9',
				address: 'Av. Cuauhtémoc 101, Centro, 90300 Cdad. de Apizaco, Tlax.',
				isVisible: true,
				venueName: 'Basílica De Nuestra Señora Misericordia',
				venueEvent: 'Ceremonia',
				googleMapsUrl: 'https://maps.app.goo.gl/58uHVrMTA9GMtBtZ9',
			},
			{
				id: 'venue_212',
				city: 'Apizaco, Tlaxcala',
				date: '2026-09-12',
				time: '20:30',
				type: 'reception',
				label: 'Recepción',
				mapUrl: 'https://maps.app.goo.gl/jp7castySWNLjSBX7',
				address: 'C. José Aramburu 3, San Martín de Porres, Cdad. de Apizaco, Tlax.',
				isVisible: true,
				venueName: 'Las Camelinas',
				venueEvent: 'Recepción',
				googleMapsUrl: 'https://maps.app.goo.gl/jp7castySWNLjSBX7',
			},
		],
		introLede: 'Será una alegría compartir contigo esta celebración.',
		indications: [
			{
				text: 'Código de vestimenta: <strong>formal elegante</strong>.',
				iconName: 'DressCode',
				styleVariant: 'reserved',
			},
			{
				text: 'Confirma tu asistencia para ayudarnos a preparar cada detalle.',
				iconName: 'Calendar',
				styleVariant: 'default',
			},
		],
		introEyebrow: 'Nos vemos en Apizaco',
		introHeading: 'Sábado, 12 de septiembre de 2026',
		presentation: 'with-map',
		indicationsHeading: 'Detalles para mis invitados',
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'editorial-back-cover',
		image: {
			key: 'thankYouPortrait',
			type: 'internal',
		},
		message:
			'Gracias por acompañarme en mis XV años. Su presencia y cariño harán de esta noche un recuerdo que guardaré para siempre.',
		focalPoint: '50% 36%',
		closingName: 'Xareni Iyarit',
	},
	countdown: {
		variant: 'standard',
		title: 'La celebración comienza en',
		footerText: '-',
	},
	eventType: 'xv',
	itinerary: {
		variant: 'timeline-paper',
		title: 'Programa',
		items: [
			{
				time: '19:00',
				label: 'Ceremonia',
				iconName: 'Church',
				description:
					'Misa de Acción de Gracias en la Basílica De Nuestra Señora Misericordia.',
			},
			{
				time: '20:30',
				label: 'Recepción',
				iconName: 'Reception',
				description: 'Bienvenida en Las Camelinas.',
			},
			{
				time: '21:00',
				label: 'Cena',
				iconName: 'Dinner',
				description: 'Cena y convivencia con familia e invitados.',
			},
			{
				time: '22:00',
				label: 'Vals',
				iconName: 'Waltz',
				description: 'Un momento especial para celebrar mis XV años.',
			},
			{
				time: '03:30',
				label: 'Cierre',
				iconName: 'Party',
				description: 'Gracias por acompañarnos.',
			},
		],
	},
	_assetSlug: 'xv-xareni-iyarit',
	interludes: [
		{
			alt: 'Detalle decorativo de tul blush champagne y bordado rose gold',
			image: {
				key: 'interlude01',
				type: 'internal',
			},
			height: 'screen',
			lightX: '48%',
			lightY: '40%',
			focalPoint: '50% 50%',
			afterSection: 'location',
		},
		{
			alt: 'Marco ornamental ivory con sombras florales blush',
			image: {
				key: 'interlude02',
				type: 'internal',
			},
			height: 'screen',
			lightX: '55%',
			lightY: '34%',
			focalPoint: '50% 50%',
			afterSection: 'family',
		},
		{
			alt: 'Divisor decorativo ivory y blush con encaje sutil',
			image: {
				key: 'interlude03',
				type: 'internal',
			},
			height: 'medium',
			lightX: '50%',
			lightY: '46%',
			focalPoint: '50% 52%',
			afterSection: 'itinerary',
		},
		{
			alt: 'Fondo decorativo blush con tul y detalle rose gold',
			image: {
				key: 'interlude04',
				type: 'internal',
			},
			height: 'screen',
			lightX: '46%',
			lightY: '38%',
			focalPoint: '50% 50%',
			afterSection: 'rsvp',
		},
	],
	description:
		'Invitación para los XV años de Xareni Iyarit Sánchez Hernández, con una estética romántica en tonos blush, champagne, ivory, rose gold y mauve.',
	eventTiming: {
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-09-13T01:00:00.000Z',
		localDateTime: '2026-09-12T19:00',
	},
	sectionOrder: [
		'quote',
		'family',
		'countdown',
		'itinerary',
		'location',
		'gallery',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
};

export const xareniInvitation = defineCanonicalInvitation({
	slug: 'xareni-iyarit',
	eventType: 'xv',
	title: 'XV años de Xareni Iyarit',
	baseDemoId: 'demo-xv-celestial-blue',
	themeId: 'celestial-blue',
	visualProfileId: 'xareni-iyarit',
	eventTiming: {
		localDateTime: '2026-09-12T19:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-09-13T01:00:00.000Z',
	},
	content,
	managedIdentityId: '71c36786-da95-462f-a972-091fc1be8f48',
	managedIdentityProvenance: 'persisted',
	hostLoginAlias: 'xareni_iyarit',
	assetDir: 'src/assets/images/events/xv-xareni-iyarit',
	assetFiles: {
		hero: 'hero.webp',
		heroMobile: 'hero.webp',
		heroDesktop: 'hero-desktop.webp',
		family: 'family.webp',
		portrait: 'portrait.webp',
		thankYouPortrait: 'thank-you-portrait.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
		interlude01: 'interlude-01.webp',
		interlude02: 'interlude-02.webp',
		interlude03: 'interlude-03.webp',
		interlude04: 'interlude-04.webp',
	},
	deliveryScope: 'content-and-assets',
	lifecycle: 'published',
});
