import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-06-21T20:00:00.000Z',
		name: 'Leah Lexa',
		label: 'Baby Shower de Leah Lexa',
		nickname: '',
		secondaryName: '',
		backgroundImage: {
			key: 'hero',
			type: 'internal',
		},
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		subcopy:
			'Tu respuesta ayuda a mis papis a preparar cada detalle para recibirte con mucho cariño.',
		guestCap: 100,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		confirmationMessage:
			'Gracias por confirmar. Mis papis y yo estamos muy felices de saber que nos acompañarán.',
	},
	gifts: {
		variant: 'standard',
		items: [
			{
				url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/51975133',
				type: 'store',
				title: 'Un detalle con cariño',
				description: 'Mesa disponible en Liverpool',
			},
		],
		title: 'Mesa de regalos',
		subtitle:
			'Si desean tener un detalle para mí, mis papis prepararon una opción especial con mucho cariño.',
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1781508528/Phil_Collins_-_En_Mi_Corazon_Viviras_64kbps_z33zs2.mp3',
		title: 'Phil Collins - En Mi Corazon Viviras',
		autoPlay: true,
	},
	quote: {
		text: 'Los tiempos de Dios son perfectos, y les ha dado la dicha a mis papis de hacer crecer nuestra familia.',
		author: 'Leah Lexa',
	},
	theme: {
		preset: 'celestial-blue',
		fontFamily: 'serif',
	},
	title: 'Baby Shower de Leah Lexa',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Con mucho amor',
			sectionTitle: 'Mis papis',
			sectionMessage:
				'Quieren compartir contigo mi Baby Shower. Desde la pancita de mamá, ya siento el cariño con el que me esperan.',
			sectionSubtitle: 'Hugo y Fernanda',
		},
		parents: {
			father: 'Hugo',
			mother: 'Fernanda',
		},
		featuredImage: {
			key: 'family',
			type: 'internal',
		},
		sectionMessage:
			'Quieren compartir contigo mi Baby Shower. Desde la pancita de mamá, ya siento el cariño con el que me esperan.',
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: {
					key: 'gallery03',
					type: 'internal',
				},
			},
		],
		title: 'La manada también te espera',
		eyebrow: '-',
		variant: 'single-keepsake',
		subtitle: 'En casa ya hay patitas listas para recibirte con amor.',
		presentation: 'pet-keepsake',
	},
	sharing: {
		ogDescription:
			'Acompáñame en mi Baby Shower el domingo, 21 de junio de 2026, a las 2:00 PM.',
		shareMessages: {
			reminder:
				'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
			invitation:
				'Hola {{invitado}}, te comparto tu invitación al {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		},
		reminderSettings: {
			enabled: false,
			audience: 'unconfirmed',
			showWhenDaysBeforeEvent: 1,
		},
	},
	envelope: {
		disabled: false,
		sealIcon: 'monogram',
		cardLabel: 'Baby Shower',
		microcopy: 'Toca para abrir mi invitación',
		sealStyle: 'wax',
		stampText: 'Leah Lexa',
		stampYear: '2026',
		cardTagline: 'Un milagro viene en camino.',
		sealVariant: 'premium-rose',
		sealInitials: 'LL',
		closedPalette: {
			accent: 'actionAccent',
			primary: 'surfacePrimary',
			background: 'surfacePrimary',
		},
		documentLabel: 'Baby Shower',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		venues: [
			{
				id: 'baby-shower',
				city: 'Ciudad de México',
				date: '2026-06-21',
				time: '14:00',
				type: 'custom',
				label: '',
				mapUrl: 'https://maps.app.goo.gl/HGnDhFDHQaA4sZii8',
				address: 'Calle 22, Manzana 1, Lote 20, Col. Guadalupe Proletaria, C.P. 07670',
				isVisible: true,
				venueName: 'Nos vemos aquí',
				venueEvent: '',
				coordinates: {
					lat: 19.522222,
					lng: -99.152472,
				},
			},
		],
		introLede: 'Me hará muy feliz que me acompañes.',
		indications: [
			{
				text: 'Referencia: <strong>Casa color naranja al final de la calle, cerca de una capilla.</strong>',
				iconName: 'MapLocation',
				styleVariant: 'default',
			},
			{
				text: 'Código de vestimenta: <strong>Ropa casual en colores pastel.</strong>',
				iconName: 'DressCode',
				styleVariant: 'default',
			},
		],
		introEyebrow: 'Te espero para celebrar',
		introHeading: 'Domingo, 21 de junio de 2026',
		indicationsHeading: 'Detalles para mis invitados',
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'editorial-back-cover',
		image: {
			key: 'gallery02',
			type: 'internal',
		},
		message: 'Este primer recuerdo y cada muestra de cariño serán parte de mi historia.',
		closingName: 'Leah Lexa',
	},
	countdown: {
		variant: 'standard',
		title: '¡Falta muy poco!',
		footerText: '-',
	},
	eventType: 'baby-shower',
	itinerary: {
		variant: 'timeline-paper',
		title: 'Itinerario',
		items: [],
	},
	_assetSlug: 'leah-lexa-baby-shower',
	interludes: [
		{
			alt: 'Antes de conocerte, ya eras nuestro sueño más bonito.',
			image: {
				key: 'gallery01',
				type: 'internal',
			},
			height: 'medium',
			afterSection: 'quote',
		},
	],
	description:
		'Invitacion real para celebrar el Baby Shower de Leah Lexa. Los recursos visuales incluyen imagenes oficiales del cliente.',
	eventTiming: {
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-06-21T20:00:00.000Z',
		localDateTime: '2026-06-21T14:00',
	},
	sectionOrder: [
		'quote',
		'family',
		'location',
		'countdown',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'gallery',
		'thankYou',
	],
	navigation: [
		{
			label: 'Ubicación',
			href: '#event-location',
		},
		{
			label: 'Fecha',
			href: '#inicio',
		},
		{
			label: 'Regalos',
			href: '#regalos',
		},
		{
			label: 'Confirmar',
			href: '#rsvp',
		},
	],
};

export const leahInvitation = defineCanonicalInvitation({
	slug: 'leah-lexa',
	eventType: 'baby-shower',
	title: 'Baby Shower de Leah Lexa',
	baseDemoId: 'demo-baby-shower-celestial',
	themeId: 'celestial-blue',
	visualProfileId: 'leah-lexa',
	eventTiming: {
		localDateTime: '2026-06-21T14:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-06-21T20:00:00.000Z',
	},
	content,
	managedIdentityId: 'fa7ebb23-8b95-41f5-a7ba-f4762504ee16',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'leah_lexa',
	assetDir: 'src/assets/images/events/leah-lexa-baby-shower',
	assetFiles: {
		hero: 'hero.webp',
		family: 'family.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
	},

	deliveryScope: 'content-and-assets',
});
