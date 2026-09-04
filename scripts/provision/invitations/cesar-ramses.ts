import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-06-20T22:00:00.000Z',
		name: 'César Ramses',
		label: 'Mi primer sacramento y un año de vida',
		nickname: '',
		secondaryName: '',
		backgroundImage: 'hero',
		backgroundImageMobile: 'heroMobile',
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		subcopy:
			'Tu confirmación nos ayuda a preparar cada detalle para compartir este día de bendición.',
		guestCap: 4,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		confirmationMessage: 'Gracias por acompañarnos en el bautizo y primer año de César Ramses.',
	},
	gifts: {
		variant: 'standard',
		items: [],
	},
	music: {
		url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1778891103/Here_Comes_The_Sun_Instrumental_-web_ae1kzg.m4a',
		title: 'Música de fondo',
		autoPlay: true,
	},
	quote: {
		text: 'Instruye al niño en su camino, Y aun cuando fuere viejo no se apartará de él.',
		author: 'Proverbios 22:6',
	},
	theme: {
		preset: 'sacred-keepsake',
		fontFamily: 'serif',
	},
	title: 'Mi Bautizo y 1er Año • César Ramses',
	family: {
		variant: 'standard',
		labels: {
			parentsTitle: 'Papás',
			sectionTitle: 'El amor que rodea este momento',
			sectionMessage: 'Acompañado por el amor de su familia y la bendición de sus padrinos.',
			godparentsTitle: 'Padrinos',
			sectionSubtitle: 'Familia',
		},
		parents: {
			father: 'César Ramses Torres',
			mother: 'Sandra Heredia',
		},
		godparents: [
			{
				name: 'Claudia Torres',
				role: 'Madrina',
			},
			{
				name: 'Miguel Rodríguez',
				role: 'Padrino',
			},
		],
		featuredImage: {
			key: 'family',
			type: 'internal',
		},
	},
	isDemo: false,
	gallery: {
		items: [
			{
				image: {
					key: 'gallery01',
					type: 'internal',
				},
				caption: 'Pureza y ternura',
				focalPoint: '50% 45%',
			},
			{
				image: {
					key: 'gallery02',
					type: 'internal',
				},
				caption: 'La luz del sacramento',
				focalPoint: '50% 56%',
			},
			{
				image: {
					key: 'gallery03',
					type: 'internal',
				},
				caption: 'Bendición en familia',
				focalPoint: '52% 42%',
			},
			{
				image: {
					key: 'gallery04',
					type: 'internal',
				},
				caption: 'Felicidad que nos llena',
				focalPoint: '50% 41%',
			},
			{
				image: {
					key: 'gallery05',
					type: 'internal',
				},
				caption: 'Inocencia y pureza',
				focalPoint: '49% 45%',
			},
			{
				image: {
					key: 'gallery06',
					type: 'internal',
				},
				caption: 'Un año de bendiciones',
				focalPoint: '50% 44%',
			},
		],
		title: 'Instantes de luz',
		eyebrow: 'Galería',
		subtitle: 'Una memoria serena de este día sagrado',
		variant: 'uniform-grid',
	},
	sharing: {
		shareMessages: {
			reminder:
				'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
			invitation:
				'Hola {{invitado}}, te comparto tu invitación a {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		},
		reminderSettings: {
			enabled: true,
			audience: 'all-shared',
			showWhenDaysBeforeEvent: 10,
		},
	},
	envelope: {
		disabled: false,
		microcopy: 'Toca para abrir mi invitación',
		sealStyle: 'wax',
		sealInitials: 'C·R',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		venues: [
			{
				id: 'venue_1781248383354',
				city: 'Guadalajara, Jalisco',
				date: '2026-06-20',
				time: '16:00',
				type: 'reception',
				image: {
					key: 'reception',
					type: 'internal',
				},
				label: 'Recepción',
				mapUrl: 'https://www.google.com/maps/search/?api=1&query=Levanto%20Jardin%20de%20Eventos%20La%20Tijera%20Guadalajara',
				address: '24 de Diciembre 45, La Tijera, 45645 Guadalajara, Jal.',
				isVisible: true,
				venueName: 'Levanto Jardín de Eventos',
				venueEvent: 'Recepción',
			},
		],
		indications: [
			{
				text: '<strong>El menú</strong> será servido por tiempos. Les pedimos llegar puntualmente.',
				iconName: 'Calendar',
				styleVariant: 'default',
			},
			{
				text: '<strong>Vestimenta</strong> Tonos claros, formales y suaves.',
				iconName: 'DressCode',
				styleVariant: 'default',
			},
		],
		indicationsHeading: 'Indicaciones',
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'standard',
		image: 'thankYouPortrait',
		message:
			'Gracias por acompañarnos en el bautizo y primer año de César Ramses. Su presencia, sus oraciones y su cariño quedan guardados en esta memoria de fe, familia y bendición.',
		focalPoint: '50% 42%',
		closingName: 'César Ramses',
		overlayAnchor: 'left',
		overlaySafeArea: {
			x: 0.5,
			y: 0.31,
			width: 0.21,
			height: 0.24,
		},
	},
	countdown: {
		variant: 'standard',
		title: 'Nos acercamos con alegría',
		footerText: 'Para celebrar el Bautizo y Primer Año de César Ramses',
	},
	eventType: 'bautizo',
	itinerary: {
		variant: 'standard',
		title: 'Programa',
		subtitle: 'Bautizo y 1er Año de César Ramses',
		items: [
			{
				time: '12:30',
				label: 'Santa Misa',
				iconName: 'Church',
				description:
					'Nos reuniremos en familia para preparar el corazón antes de la celebración.',
			},
			{
				time: '16:00',
				label: 'Recepción',
				iconName: 'MapLocation',
				description:
					'Nos reuniremos para celebrar con cariño la vida y el bautizo de César Ramses.',
			},
			{
				time: '17:30',
				label: 'Comida',
				iconName: 'Dinner',
				description:
					'Compartiremos la mesa en familia, con gratitud y alegría por este primer año.',
			},
			{
				time: '23:00',
				label: 'Cierre',
				iconName: 'Sparkles',
				description:
					'Gracias por ser parte de este recuerdo que guardaremos con mucho amor.',
			},
		],
	},
	_assetSlug: 'cesar-ramses',
	description:
		'Acompáñanos al bautizo y primer año de César Ramses en una tarde de fe, familia y bendición en Guadalajara.',
	eventTiming: {
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-06-20T18:30:00.000Z',
		localDateTime: '2026-06-20T12:30',
	},
	sectionOrder: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'thankYou',
	],
};

export const cesarInvitation = defineCanonicalInvitation({
	slug: 'cesar-ramses',
	eventType: 'bautizo',
	title: 'Mi Bautizo y 1er Año • César Ramses',
	baseDemoId: 'demo-bautismo-sacred-keepsake',
	themeId: 'sacred-keepsake',
	visualProfileId: 'cesar-ramses',
	eventTiming: {
		localDateTime: '2026-06-20T12:30',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-06-20T18:30:00.000Z',
	},
	content,
	managedIdentityId: '36c1e8d6-3c31-4e98-a293-bf5a4bd4784b',
	managedIdentityProvenance: 'persisted',
	hostLoginAlias: 'cesar_ramses',
	assetDir: 'src/assets/images/events/cesar-ramses',
	assetFiles: {
		hero: 'hero.webp',
		heroMobile: 'hero.webp',
		thankYouPortrait: 'thank-you.webp',
		family: 'family.webp',
		reception: 'reception.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		gallery06: 'gallery-06.webp',
	},
	deliveryScope: 'content-and-assets',
	lifecycle: 'published',
});
