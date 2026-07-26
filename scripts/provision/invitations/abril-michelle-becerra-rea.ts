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
		theme: { preset: ABRIL_EVENT.themeId },
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
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		_assetSlug: ABRIL_EVENT.assetSlug,
		hero: {
			name: 'Abril Michelle',
			label: 'CELEBRO MIS XV',
			date: ABRIL_EVENT.startsAtUtc,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
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
			sealInitials: 'AM',
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
			title: 'Momentos de la celebración',
			items: [
				{ time: '3:00 p. m.', label: 'Acción de gracias', iconName: 'Church' },
				{ time: '5:00 p. m.', label: 'Bienvenida', iconName: 'Reception' },
				{ time: '6:00 p. m.', label: 'Cena de gala', iconName: 'Dinner' },
				{ time: '7:00 p. m.', label: 'Vals de honor', iconName: 'Waltz' },
				{ time: '12:00 a. m.', label: 'Último baile', iconName: 'Sparkles' },
			],
		},
		gallery: {
			eyebrow: 'Recuerdos',
			title: 'Abril Michelle',
			subtitle: 'Luz, elegancia y la emoción de sus XV',
			variant: 'premiere-floral',
			items: [
				{
					image: assets['gallery-01-candles'],
					alt: 'Abril Michelle con velas encendidas en forma de 15',
					focalPoint: '50% 42%',
					focalPointMobile: '50% 40%',
					focalPointDesktop: '50% 42%',
				},
				{
					image: assets['family-portrait'],
					alt: 'Abril Michelle luciendo tiara y guantes',
					focalPoint: '50% 28%',
					focalPointMobile: '50% 26%',
					focalPointDesktop: '50% 30%',
				},
				{
					image: assets['gallery-03-seated-balloons'],
					alt: 'Abril Michelle sentada con globos dorados y pastel',
					focalPoint: '42% 38%',
					focalPointMobile: '40% 36%',
					focalPointDesktop: '44% 38%',
				},
				{
					image: assets['gallery-04-white-suit'],
					alt: 'Abril Michelle con traje blanco y globos 15',
					focalPoint: '50% 28%',
					focalPointMobile: '50% 26%',
					focalPointDesktop: '50% 30%',
				},
			],
		},
		rsvp: {
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
				title: 'Su invitación personal',
				subtitle: 'Esta invitación ha sido preparada para:',
				footerText: 'Confirme su asistencia en el formulario.',
			},
		},
		thankYou: {
			message: 'Gracias por hacer más luminosa esta celebración.',
			closingName: 'Abril Michelle',
			closingPhrase: 'Con gratitud',
			date: '12 de septiembre de 2026',
			image: assets['gallery-05-white-dress'],
			focalPoint: '50% 28%',
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a los XV años de Abril Michelle Becerra Rea',
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación para los XV años de Abril Michelle: {inviteUrl}',
		},
	};
}

export const abrilInvitation: InvitationDefinition<AbrilAssetKey> = defineInvitation({
	slug: ABRIL_EVENT.slug,
	createdAt: '2026-07-24T00:00:00.000Z',
	eventType: ABRIL_EVENT.eventType,
	title: ABRIL_EVENT.title,
	clientName: 'Abril Michelle Becerra Rea',
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
