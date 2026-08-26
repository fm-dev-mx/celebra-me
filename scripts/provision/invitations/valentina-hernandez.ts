/**
 * valentina-hernandez.ts — Managed invitation definition for Valentina Hernández Almaguer XV
 *
 * Content owner for xv/valentina-hernandez. Section variants are authored explicitly;
 * editorial-magazine is atmosphere only. deliveryScope is content-only for Preview and
 * Production (reuse hosted assets). First Local / corpus populate uses content-and-assets
 * when invitation_assets rows are missing. Draft WhatsApp JPEGs remain in the legacy
 * event asset folder until remastered.
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const VALENTINA_EVENT = {
	eventType: 'xv',
	slug: 'valentina-hernandez',
	assetSlug: 'xv-valentina-hernandez',
	baseDemoId: 'demo-xv-editorial-magazine',
	themeId: 'editorial-magazine',
	visualProfileId: 'valentina-hernandez',
	title: 'XV Años — Valentina Hernández Almaguer',
	localDateTime: '2026-08-29T15:45',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-08-29T21:45:00.000Z',
	eventDateLong: '29 de agosto de 2026',
} as const;

const VENUE_NAME = 'Finca Las Palmas';
const VENUE_ADDRESS = '4ta Cerrada de Palma s/n, San Luis Huexotla, Texcoco, México';
const VENUE_CITY = 'Texcoco, Estado de México';
const MAPS_URL =
	'https://www.google.com/maps/search/?api=1&query=Finca+Las+Palmas+San+Luis+Huexotla+Texcoco';
const MUSIC_URL =
	'https://res.cloudinary.com/dusxvauvj/video/upload/v1782619626/Justin_Timberlake_-_CAN_T_STOP_THE_FEELING_mscvhn.m4a';

export const VALENTINA_ASSET_SPECS = [
	{
		key: 'hero',
		relativePath: 'hero.jpg',
		displayName: 'Valentina — portada',
		alt: 'Valentina con vestido rosa y tiara en un salón con globos',
		focalPoint: { default: '50% 38%', mobile: '50% 32%' },
	},
	{
		key: 'portrait',
		relativePath: 'portrait.jpg',
		displayName: 'Valentina — retrato',
		alt: 'Retrato de Valentina con vestido rosa y tiara',
		focalPoint: { default: '50% 32%' },
	},
	{
		key: 'family',
		relativePath: 'family.jpg',
		displayName: 'Valentina — familia',
		alt: 'Valentina con su familia',
		focalPoint: { default: '50% 38%' },
	},
	{
		key: 'gallery01',
		relativePath: 'gallery-01.jpg',
		displayName: 'Valentina — galería 1',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery02',
		relativePath: 'gallery-02.jpg',
		displayName: 'Valentina — galería 2',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery03',
		relativePath: 'gallery-03.jpg',
		displayName: 'Valentina — galería 3',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery04',
		relativePath: 'gallery-04.jpg',
		displayName: 'Valentina — galería 4',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery05',
		relativePath: 'gallery-05.jpg',
		displayName: 'Valentina — galería 5',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery06',
		relativePath: 'gallery-06.jpg',
		displayName: 'Valentina — galería 6',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery07',
		relativePath: 'gallery-07.jpg',
		displayName: 'Valentina — galería 7',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'gallery08',
		relativePath: 'gallery-08.jpg',
		displayName: 'Valentina — galería 8',
		alt: 'Retrato editorial de Valentina',
	},
	{
		key: 'interlude01',
		relativePath: 'interlude-01.jpg',
		displayName: 'Valentina — interludio 1',
		alt: 'Detalle editorial rosa plata con brillo',
	},
	{
		key: 'interlude02',
		relativePath: 'interlude-02.jpg',
		displayName: 'Valentina — interludio 2',
		alt: 'Marco decorativo rosa palo con acentos plateados',
	},
	{
		key: 'interlude03',
		relativePath: 'interlude-03.jpg',
		displayName: 'Valentina — interludio 3',
		alt: 'Divisor decorativo con textura editorial',
	},
	{
		key: 'interlude04',
		relativePath: 'interlude-04.jpg',
		displayName: 'Valentina — interludio 4',
		alt: 'Fondo decorativo rosa con destellos plateados',
	},
	{
		key: 'thankYouPortrait',
		relativePath: 'thank-you-portrait.jpg',
		displayName: 'Valentina — cierre',
		alt: 'Retrato de cierre de Valentina',
		focalPoint: { default: '50% 36%' },
	},
] as const;

export type ValentinaAssetKey = (typeof VALENTINA_ASSET_SPECS)[number]['key'];
export type ValentinaAssetMap = Record<ValentinaAssetKey, UploadedAssetRef>;

function galleryItem(assets: ValentinaAssetMap, key: ValentinaAssetKey) {
	return { image: assets[key] };
}

export function buildValentinaPublishedContent(
	assets: UploadedAssetMap<ValentinaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: VALENTINA_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-editorial-magazine',
		visualProfileId: VALENTINA_EVENT.visualProfileId,
		title: VALENTINA_EVENT.title,
		description:
			'Invitación editorial para los XV años de Valentina Hernández Almaguer, con una estética inspirada en revista de moda en tonos rosa, blanco y plata.',
		_assetSlug: VALENTINA_EVENT.assetSlug,
		theme: {
			fontFamily: 'serif',
			preset: VALENTINA_EVENT.themeId,
		},
		music: {
			url: MUSIC_URL,
			title: "Can't Stop the Feeling!",
			autoPlay: true,
		},
		eventTiming: {
			localDateTime: VALENTINA_EVENT.localDateTime,
			timeZone: VALENTINA_EVENT.timeZone,
			startsAtUtc: VALENTINA_EVENT.startsAtUtc,
		},
		composition: { intersections: {} },
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
		hero: {
			name: 'Valentina Hernández Almaguer',
			label: 'XV Edition',
			date: VALENTINA_EVENT.startsAtUtc,
			backgroundImage: assets.hero,
			portrait: assets.portrait,
			variant: 'editorial-cover',
			focalPoint: '50% 38%',
			focalPointMobile: '50% 32%',
		},
		quote: {
			text: 'Dicen que la moda es temporal, pero los recuerdos son eternos. Acompáñame a escribir el primer capítulo de mi nueva historia...',
			author: 'Valentina Hernández Almaguer',
		},
		family: {
			variant: 'standard',
			featuredImage: assets.family,
			parents: {
				father: 'Juan Carlos Hernández Calixco',
				mother: 'María Estrella Almaguer Casarreal',
			},
			parentsOrder: 'mother-first',
			labels: {
				sectionTitle: 'Mi familia',
				sectionSubtitle: 'Con amor y gratitud',
				parentsTitle: 'Mis padres',
				godparentsTitle: 'Padrinos',
				sectionMessage:
					'Gracias por darme la vida y tanto amor. Gracias por guiar mis pasos. Con la bendición de mi familia y el cariño de quienes han acompañado mi historia, celebro este día con el corazón lleno de gratitud.',
			},
			godparents: [
				{ name: 'Nayeli Almaguer Casarreal', role: 'Madrina' },
				{ name: 'César A. Pérez Monroy', role: 'Padrino' },
			],
			focalPoint: '50% 38%',
		},
		countdown: {
			title: 'La celebración comienza en',
			footerText: '29 de agosto de 2026, Texcoco, Estado de México',
			variant: 'magazine-folio',
		},
		itinerary: {
			title: 'Programa',
			variant: 'editorial-program',
			items: [
				{
					iconName: 'Church',
					label: 'Ceremonia religiosa',
					time: '15:45',
					description: 'Inicio de la celebración con una ceremonia llena de gratitud.',
				},
				{
					iconName: 'Reception',
					label: 'Recepción',
					time: '16:30',
					description: 'Recepción y celebración en Finca Las Palmas.',
				},
			],
		},
		location: {
			variant: 'standard',

			mapStyle: 'dark',
			introEyebrow: 'Te esperamos en Texcoco',
			introHeading: 'Sábado, 29 de agosto de 2026',
			introLede: 'Será una alegría compartir contigo esta celebración.',
			indicationsHeading: 'Detalles para mis invitados',
			venues: [
				{
					type: 'ceremony',
					venueEvent: 'Ceremonia religiosa',
					venueName: VENUE_NAME,
					address: VENUE_ADDRESS,
					city: VENUE_CITY,
					date: VALENTINA_EVENT.eventDateLong,
					time: '3:45 p.m.',
					googleMapsUrl: MAPS_URL,
				},
				{
					type: 'reception',
					venueEvent: 'Recepción',
					venueName: VENUE_NAME,
					address: VENUE_ADDRESS,
					city: VENUE_CITY,
					date: VALENTINA_EVENT.eventDateLong,
					time: '4:30 p.m.',
					googleMapsUrl: MAPS_URL,
				},
			],
			indications: [
				{
					title: 'Código de vestimenta',
					iconName: 'DressCode',
					styleVariant: 'reserved',
					text: 'Código de vestimenta: <strong>formal</strong>. Quiero que te veas <strong>INCREÍBLE</strong>. Damas: Divinas (Reserva el color <strong>rosa y lila</strong> para la XV). Caballeros: Guapos.',
				},
				{
					title: 'Confirmación',
					iconName: 'Calendar',
					styleVariant: 'default',
					text: 'Agradecemos confirmar asistencia con anticipación para preparar cada detalle con cariño.',
				},
				{
					title: 'Puntualidad',
					iconName: 'Enveloped',
					styleVariant: 'default',
					text: 'Agradecemos tu puntualidad para disfrutar juntos cada momento mágico de esta noche.',
				},
				{
					title: 'Ambiente',
					iconName: 'Sparkles',
					styleVariant: 'default',
					text: 'Prepárate para una noche llena de magia, sueños y mucha diversión.',
				},
				{
					title: 'Recuerdos',
					iconName: 'Photo',
					styleVariant: 'default',
					text: 'Comparte tus mejores fotos y videos de la fiesta etiquetándome en <strong>@val27_0811</strong>. ¡Me encantará ver la celebración desde tu perspectiva!',
				},
			],
		},
		gallery: {
			variant: 'magazine-spread',
			presentationOptions: {
				mobileBrowse: 'rail',
			},
			eyebrow: 'Galería',
			title: 'Brillar es la actitud.',
			subtitle:
				'Prepárate para una noche llena de magia, sueños y mucha diversión. Un recorrido visual por los momentos que hacen de esta celebración algo único.',
			items: [
				galleryItem(assets, 'gallery01'),
				galleryItem(assets, 'gallery02'),
				galleryItem(assets, 'gallery03'),
				galleryItem(assets, 'gallery04'),
				galleryItem(assets, 'gallery05'),
				galleryItem(assets, 'gallery06'),
				galleryItem(assets, 'gallery07'),
				galleryItem(assets, 'gallery08'),
			],
		},
		gifts: {
			title: 'Regalos',
			subtitle:
				'Su presencia es mi mejor regalo, pero si desean tener un detalle conmigo, les comparto estas opciones.',
			variant: 'editorial-catalog',
			items: [
				{
					type: 'cash',
					title: 'Regalo Sorpresa',
					text: 'Un regalo con todo tu cariño para hacer de este día algo aún más especial.',
				},
				{
					type: 'cash',
					title: 'Lluvia de Sobres',
					text: 'Se proporcionará un sobre el día del evento.',
				},
				{
					type: 'store',
					title: 'Mesa en Liverpool',
					description: 'VALENS DREAM TEAM',
					tableNumber: '52020257',
					links: [
						{
							label: 'Ver lista',
							url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/52020257',
						},
					],
				},
			],
		},
		rsvp: {
			title: 'Confirma tu asistencia',
			subcopy:
				'Por favor, confirma tu asistencia enviándome un mensaje directo o desde esta invitación. ¡Me encantará saber que vienes!',
			guestCap: 4,
			accessMode: 'hybrid',
			confirmationMessage:
				'Gracias por confirmar. Me dará mucha alegría compartir esta noche contigo.',
			confirmationMode: 'both',
			variant: 'editorial-press-pass',
			personalizedAccess: {
				variant: 'editorial-pass',
			},
			whatsappConfig: {
				phone: '525518323934',
			},
		},
		thankYou: {
			message:
				'Que la alegría de este día sea el inicio de un futuro lleno de luz, magia y momentos inolvidables.',
			closingName: 'Valentina Hernández Almaguer',
			image: assets.thankYouPortrait,
			focalPoint: '50% 36%',
			variant: 'editorial-back-cover',
		},
		interludes: [
			{
				image: assets.interlude01,
				afterSection: 'location',
				alt: 'Detalle editorial rosa plata con brillo',
				height: 'screen',
				focalPoint: '50% 50%',
				lightX: '48%',
				lightY: '40%',
			},
			{
				image: assets.interlude02,
				afterSection: 'family',
				alt: 'Marco decorativo rosa palo con acentos plateados',
				height: 'screen',
				focalPoint: '50% 50%',
				lightX: '55%',
				lightY: '34%',
			},
			{
				image: assets.interlude03,
				afterSection: 'itinerary',
				alt: 'Divisor decorativo con textura editorial',
				height: 'medium',
				focalPoint: '50% 52%',
				lightX: '50%',
				lightY: '46%',
			},
			{
				image: assets.interlude04,
				afterSection: 'rsvp',
				alt: 'Fondo decorativo rosa con destellos plateados',
				height: 'screen',
				focalPoint: '50% 50%',
				lightX: '46%',
				lightY: '38%',
			},
		],
		envelope: {
			disabled: false,
			revealVariant: 'editorial-cover',
			coverEdition: 'XV',
			coverVolume: '1',
			coverIssue: '2026',
			sealStyle: 'wax',
			sealIcon: 'flower',
			sealInitials: 'V·H',
			sealVariant: 'premium-rose',
			microcopy: 'Abrir edición XV',
			documentLabel: 'Edición XV',
			cardLabel: 'Edición XV',
			cardTagline: 'Brillar es la actitud',
			stampText: 'Valentina',
			stampYear: '2026',
			closedPalette: {
				primary: 'surfaceDark',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		sharing: {
			whatsappTemplate:
				'Hola {name}, te comparto con mucha ilusión la invitación a mis XV años: {inviteUrl}',
			// Content-only Preview/Production preserve the hosted OG asset key (`portrait`).
			ogImage: assets.portrait,
			ogDescription:
				'Acompáñame en mis XV años el sábado, 29 de agosto de 2026, en Texcoco, Estado de México.',
		},
	};
}

export const valentinaInvitation: InvitationDefinition<ValentinaAssetKey> = defineInvitation({
	slug: VALENTINA_EVENT.slug,
	managedIdentityId: 'b1e9d4a7-6c28-4f3a-a815-9e2d70c4f6b8',
	createdAt: '2026-06-26T00:00:00.000Z',
	lifecycle: 'published',
	deliveryScope: 'content-only',
	eventType: VALENTINA_EVENT.eventType,
	title: VALENTINA_EVENT.title,
	clientName: 'Valentina Hernández Almaguer',
	hostLoginAlias: 'valentina_hernandez',
	clientEmail: '',
	clientWhatsapp: '525518323934',
	photosReceived: true,
	baseDemoId: VALENTINA_EVENT.baseDemoId,
	themeId: VALENTINA_EVENT.themeId,
	visualProfileId: VALENTINA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: VALENTINA_EVENT.localDateTime,
		timeZone: VALENTINA_EVENT.timeZone,
		startsAtUtc: VALENTINA_EVENT.startsAtUtc,
	},
	assetDir: 'src/assets/images/events/xv-valentina-hernandez',
	assets: VALENTINA_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildValentinaPublishedContent(assets);
	},
});
