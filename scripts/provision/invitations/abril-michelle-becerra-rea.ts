/**
 * abril-michelle-becerra-rea.ts — Single-File Invitation Definition for Abril Michelle Becerra Rea XV
 *
 * Standardized single-file invitation definition for Abril Michelle Becerra Rea.
 * Encapsulates event metadata, timing, asset specifications, focal points,
 * locations, map URLs, section order, and content structure in one location.
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const ABRIL_EVENT = {
	eventType: 'xv',
	slug: 'abril-michelle-becerra-rea',
	assetSlug: 'abril-michelle-becerra-rea',
	baseDemoId: 'demo-xv-premiere-floral',
	themeId: 'premiere-floral',
	visualProfileId: 'abril-michelle-becerra-rea',
	title: 'XV años de Abril Michelle Becerra Rea',
	localDateTime: '2026-09-12T15:00',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-09-12T21:00:00.000Z',
} as const;

export const ABRIL_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-desktop.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — portada desktop',
		alt: 'Abril Michelle con vestido rosa palo y tiara',
		focalPoint: {
			default: '50% 40%',
			mobile: '50% 38%',
			tablet: '50% 40%',
			desktop: '50% 42%',
		},
		ogTransformation: 'c_fill,g_auto,w_1200,h_630,q_auto,f_auto',
	},
	{
		key: 'hero-mobile',
		relativePath: 'hero-mobile.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — portada móvil',
		alt: 'Abril Michelle con vestido rosa palo retrato vertical',
		focalPoint: {
			default: '50% 38%',
			mobile: '50% 38%',
			tablet: '50% 40%',
			desktop: '50% 42%',
		},
	},
	{
		key: 'family-portrait',
		relativePath: 'family-portrait.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — familia y tiara',
		alt: 'Abril Michelle luciendo tiara y guantes',
		focalPoint: {
			default: '50% 28%',
		},
	},
	{
		key: 'interlude-crown',
		relativePath: 'interlude-crown.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — interludio corona',
		alt: 'Corona sobre tela satinada',
		focalPoint: {
			default: '50% 50%',
		},
	},
	{
		key: 'interlude-palace',
		relativePath: 'interlude-palace.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — interludio palacio oriental',
		alt: 'Palacio oriental y lámpara de época',
		focalPoint: {
			default: '50% 50%',
		},
	},
	{
		key: 'thank-you-confetti',
		relativePath: 'thank-you-confetti.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — agradecimiento confeti',
		alt: 'Abril Michelle con vestido rosa y confeti',
		focalPoint: {
			default: '50% 40%',
		},
	},
	{
		key: 'gallery-01-candles',
		relativePath: 'gallery-01-candles.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — velas 15',
		alt: 'Primer plano oscuro con velas 1 y 5',
	},
	{
		key: 'gallery-02-bw-cake',
		relativePath: 'gallery-02-bw-cake.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — retrato blanco y negro pastel',
		alt: 'Retrato en blanco y negro con el pastel',
		focalPoint: {
			default: '48% 32%',
			mobile: '48% 30%',
			tablet: '48% 32%',
			desktop: '48% 34%',
		},
	},
	{
		key: 'gallery-03-seated-balloons',
		relativePath: 'gallery-03-seated-balloons.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — globos dorados y pastel',
		alt: 'Abril Michelle sentada con globos dorados y pastel',
	},
	{
		key: 'gallery-04-white-suit',
		relativePath: 'gallery-04-white-suit.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — traje blanco globos 15',
		alt: 'Abril Michelle con traje blanco y globos 15',
	},
	{
		key: 'gallery-05-white-dress',
		relativePath: 'gallery-05-white-dress.webp',
		provider: 'cloudinary',
		displayName: 'Abril Michelle — vestido blanco y pastel',
		alt: 'Abril Michelle con vestido blanco, pastel y globos',
		focalPoint: {
			default: '50% 28%',
		},
	},
] as const;

export type AbrilAssetKey = (typeof ABRIL_ASSET_SPECS)[number]['key'];
export type AbrilAssetMap = Record<AbrilAssetKey, UploadedAssetRef>;

const ceremonyAddress =
	'Agustín Rivera 433-C, Colonia Centro, C.P. 47400, Lagos de Moreno, Jalisco';
const receptionAddress =
	'Macedio Ayala núm. 70, Colonia Plan de los Rodríguez, C.P. 47480, Lagos de Moreno, Jalisco';

export function buildAbrilPublishedContent(
	assets: UploadedAssetMap<AbrilAssetKey>,
): Record<string, unknown> {
	return {
		eventType: ABRIL_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-premiere-floral',
		visualProfileId: ABRIL_EVENT.visualProfileId,
		title: ABRIL_EVENT.title,
		description:
			'Acompáñenos a celebrar los XV años de Abril Michelle Becerra Rea el 12 de septiembre de 2026 en Lagos de Moreno.',
		theme: { preset: ABRIL_EVENT.themeId, fontFamily: 'serif' },
		music: {
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1785250298/Bruno_Mars_-_Talking_To_The_Moon_Optimized_fbmxzl.mp3',
			title: 'Talking to the moon',
			autoPlay: true,
		},
		eventTiming: {
			localDateTime: ABRIL_EVENT.localDateTime,
			timeZone: ABRIL_EVENT.timeZone,
			startsAtUtc: ABRIL_EVENT.startsAtUtc,
		},
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
			intersections: {
				quote: { family: 'atmospheric-blend', source: 'hero' },
				'interlude-after-quote': { family: 'overlap', source: 'quote' },
				family: { family: 'atmospheric-blend', source: 'interlude-after-quote' },
				countdown: { family: 'atmospheric-blend', source: 'family' },
				location: { family: 'atmospheric-blend', source: 'countdown' },
				'interlude-after-location': { family: 'overlap', source: 'location' },
				itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
				rsvp: { family: 'arch', source: 'gallery' },
				thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
			},
		},
		_assetSlug: ABRIL_EVENT.assetSlug,
		hero: {
			name: 'Abril Michelle',
			label: 'CELEBRO MIS XV',
			date: ABRIL_EVENT.startsAtUtc,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			variant: 'standard',
			focalPoint: '50% 40%',
			focalPointMobile: '50% 38%',
			focalPointTablet: '50% 40%',
			focalPointDesktop: '50% 42%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'CELEBRO MIS XV',
			envelopeName: 'Abril Michelle Becerra Rea',
			cardName: 'Abril Michelle',
			sealStyle: 'wax',
			sealIcon: 'wax-monogram',
			sealInitials: 'A·M',
			microcopy: 'Descubra su invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hoy, rodeada del amor que me ha formado, abro una nueva etapa y celebro mis XV años.',
			author: 'Abril Michelle',
		},
		family: {
			variant: 'standard',
			parents: {
				mother: 'Sandy Guadalupe Rea Mendoza',
				father: 'José Luis Becerra Ornelas',
			},
			parentsOrder: 'mother-first',
			godparents: [
				{ name: 'María del Carmen Becerra Ornelas' },
				{ name: 'Ramiro Contreras Bermejo' },
			],
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Guiada por mis padres y bendecida por mis padrinos',
				parentsTitle: 'Con el amor de',
				godparentsTitle: 'Mis padrinos de honor',
				sectionMessage: 'Su ejemplo y su ternura sostienen cada instante de esta noche.',
			},
			featuredImage: assets['gallery-02-bw-cake'],
			focalPoint: '48% 32%',
		},
		countdown: {
			title: 'EL GRAN DÍA SE ACERCA',
			footerText: 'Ceremonia en La Merced · 3:00 p. m.',
		},
		location: {
			variant: 'standard',
			visibility: 'public',
			introEyebrow: 'SÁBADO · 12 DE SEPTIEMBRE DE 2026',
			introHeading: 'De la fe al brindis',
			ceremony: {
				venueEvent: 'Ceremonia de acción de gracias',
				venueName: 'Templo y Ex Convento de Nuestra Señora de la Merced',
				address: ceremonyAddress,
				city: 'Lagos de Moreno, Jalisco',
				date: '12 de septiembre de 2026',
				time: '3:00 p. m.',
				mapUrl: 'https://maps.app.goo.gl/PKbLyRbrjiLfcc4C6',
				googleMapsUrl: 'https://maps.app.goo.gl/PKbLyRbrjiLfcc4C6',
				appleMapsUrl:
					'https://maps.apple.com/?q=Templo+y+Ex+Convento+de+Nuestra+Senora+de+la+Merced+Lagos+de+Moreno',
				coordinates: {
					lat: 21.3542979,
					lng: -101.9320163,
					zoom: 16,
				},
			},
			reception: {
				venueEvent: 'Recepción y celebración',
				venueName: 'Garden Palace',
				address: receptionAddress,
				city: 'Lagos de Moreno, Jalisco',
				date: '12 de septiembre de 2026',
				time: '5:00 p. m.',
				mapUrl: 'https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6',
				googleMapsUrl: 'https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6',
				appleMapsUrl: 'https://maps.apple.com/?q=Garden+Palace+Lagos+de+Moreno',
				coordinates: {
					lat: 21.3206241,
					lng: -101.9328009,
					zoom: 16,
				},
			},
			indications: [
				{
					text: 'El <strong>color rosa palo</strong> está reservado para la quinceañera.',
					iconName: 'Crown',
					styleVariant: 'default',
				},
				{
					text: 'Código de vestimenta: <strong>formal</strong>',
					iconName: 'DressCode',
					styleVariant: 'default',
				},
			],
		},
		interludes: [
			{
				image: assets['interlude-crown'],
				afterSection: 'quote',
				alt: 'Corona sobre tela satinada',
				height: 'tall',
				focalPoint: '50% 50%',
			},
			{
				image: assets['interlude-palace'],
				afterSection: 'location',
				alt: 'Palacio oriental y lámpara de época',
				height: 'tall',
				focalPoint: '50% 50%',
			},
		],
		itinerary: {
			variant: 'timeline-paper',
			title: 'Momentos de la celebración',
			items: [
				{
					time: '3:00 p. m.',
					label: 'Acción de gracias',
					description: 'Un momento de gratitud para iniciar esta fecha tan especial.',
					iconName: 'Church',
				},
				{
					time: '5:00 p. m.',
					label: 'Bienvenida',
					description: 'Nos reunimos con alegría para compartir una tarde inolvidable.',
					iconName: 'Reception',
				},
				{
					time: '6:00 p. m.',
					label: 'Cena de gala',
					description: 'Brindaremos por los sueños que comienzan a florecer.',
					iconName: 'Dinner',
				},
				{
					time: '7:00 p. m.',
					label: 'Vals de honor',
					description: 'Una tradición llena de emoción, música y recuerdos.',
					iconName: 'Waltz',
				},
				{
					time: '12:00 a. m.',
					label: 'Cierre',
					description: 'Despedimos la noche celebrando cada instante compartido.',
					iconName: 'Sparkles',
				},
			],
		},
		gifts: {
			variant: 'standard',
			title: 'Lluvia de Sobres',
			subtitle:
				'Su presencia es nuestro mayor regalo. Si desea tener un detalle, contaremos con un buzón durante la recepción.',
			items: [
				{
					type: 'cash',
					title: 'Lluvia de Sobres',
					text: 'Contaremos con un buzón durante la recepción.',
				},
			],
		},
		gallery: {
			eyebrow: 'Recuerdos',
			title: 'Abril Michelle',
			subtitle: 'Luz, elegancia y la emoción de sus XV',
			variant: 'paired-feature-band',
			items: [
				{
					key: 'gallery-01-candles',
					image: assets['gallery-01-candles'],
					alt: 'Abril Michelle con velas encendidas en forma de 15',
					focalPoint: '50% 42%',
					focalPointMobile: '50% 40%',
					focalPointDesktop: '50% 42%',
				},
				{
					key: 'family-portrait',
					image: assets['family-portrait'],
					alt: 'Abril Michelle luciendo tiara y guantes',
					focalPoint: '50% 28%',
					focalPointMobile: '50% 26%',
					focalPointDesktop: '50% 30%',
				},
				{
					key: 'thank-you-confetti',
					layoutRole: 'feature',
					aspectRatio: '8 / 5',
					image: assets['thank-you-confetti'],
					alt: 'Abril Michelle con vestido rosa y confeti',
					focalPoint: '72% 36%',
					focalPointMobile: '72% 34%',
					focalPointDesktop: '70% 36%',
				},
				{
					key: 'gallery-03-seated-balloons',
					image: assets['gallery-03-seated-balloons'],
					alt: 'Abril Michelle sentada con globos dorados y pastel',
					focalPoint: '42% 38%',
					focalPointMobile: '40% 36%',
					focalPointDesktop: '44% 38%',
				},
				{
					key: 'gallery-04-white-suit',
					image: assets['gallery-04-white-suit'],
					alt: 'Abril Michelle con traje blanco y globos 15',
					focalPoint: '50% 28%',
					focalPointMobile: '50% 26%',
					focalPointDesktop: '50% 30%',
				},
			],
		},
		rsvp: {
			variant: 'standard',
			title: 'Reserve su lugar en la celebración',
			subcopy: 'Reserve su lugar para acompañarnos el 12 de septiembre.',
			guestCap: 4,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage:
				'Su confirmación quedó registrada. Nos alegra saber que celebrará con nosotros.',
			responseMessages: {
				confirmed: {
					title: '¡Gracias por confirmar, {guestName}!',
					subtitle: 'Su asistencia ha quedado registrada.',
				},
				declined: {
					title: 'Lamentamos que no pueda acompañarnos, {guestName}.',
					subtitle: 'Gracias por avisarnos.',
				},
			},
			calendar: {
				title: 'XV de Abril Michelle',
				description:
					'Recepción de los XV años de Abril Michelle Becerra Rea. Garden Palace, Macedio Ayala núm. 70, Lagos de Moreno, Jalisco. Inicia a las 5:00 p. m.',
				startsAt: '2026-09-12T23:00:00.000Z',
			},
			personalizedAccess: {
				variant: 'ornamented',
				title: 'Su invitación personal',
				subtitle: 'Esta invitación ha sido preparada para:',
				footerText: 'Confirme su asistencia en el formulario.',
			},
		},
		thankYou: {
			variant: 'standard',
			message: 'Gracias por hacer más luminosa esta celebración.',
			closingName: 'Abril Michelle',
			date: '12 de septiembre de 2026',
			image: assets['gallery-05-white-dress'],
			focalPoint: '50% 28%',
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a los XV años de Abril Michelle Becerra Rea',
			shareMessages: {
				reminder:
					'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
				invitation:
					'Hola! Estamos muy felices y emocionados de poderte compartir tu invitación \n\nÁbrela para ver los detalles y confirmar tu asistencia.',
			},
			reminderSettings: {
				enabled: true,
				audience: 'unconfirmed',
				showWhenDaysBeforeEvent: 70,
			},
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación para los XV años de Abril Michelle: {inviteUrl}',
		},
	};
}

export const abrilInvitation: InvitationDefinition<AbrilAssetKey> = defineInvitation({
	slug: ABRIL_EVENT.slug,
	managedIdentityId: '1a2b3c4d-5e6f-4a81-92a3-b4c5d6e7f809',
	createdAt: '2026-07-24T00:00:00.000Z',
	lifecycle: 'published',
	deliveryScope: 'content-and-assets',
	eventType: ABRIL_EVENT.eventType,
	title: ABRIL_EVENT.title,
	clientName: 'Abril Michelle Becerra Rea',
	hostLoginAlias: 'abril_becerra',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: ABRIL_EVENT.baseDemoId,
	themeId: ABRIL_EVENT.themeId,
	visualProfileId: ABRIL_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: ABRIL_EVENT.localDateTime,
		timeZone: ABRIL_EVENT.timeZone,
		startsAtUtc: ABRIL_EVENT.startsAtUtc,
	},
	assets: ABRIL_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildAbrilPublishedContent(assets);
	},
});
