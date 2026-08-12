/**
 * romina-rios-chaparro.ts — Single-File Invitation Definition for Romina Ríos Chaparro XV
 *
 * Standardized single-file invitation definition for Romina Ríos Chaparro.
 * Encapsulates event metadata, timing, asset specifications, focal points,
 * locations, map URLs, section order, and content structure in one location.
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const ROMINA_EVENT = {
	eventType: 'xv',
	slug: 'romina-rios-chaparro',
	assetSlug: 'romina-rios-chaparro',
	baseDemoId: 'demo-xv-premiere-floral',
	themeId: 'premiere-floral',
	visualProfileId: 'romina-rios-chaparro',
	title: 'XV años de Romina Ríos Chaparro',
	localDateTime: '2026-08-14T17:00',
	timeZone: 'America/Chihuahua',
	startsAtUtc: '2026-08-14T23:00:00.000Z',
} as const;

export const ROMINA_ASSET_SPECS = [
	{
		key: 'hero',
		relativePath: 'IMG_3263.jpeg',
		displayName: 'Romina — portada',
		alt: 'Romina con vestido verde salvia vista de espaldas entre follaje',
	},
	{
		key: 'portrait',
		relativePath: 'IMG_3462.jpeg',
		displayName: 'Romina — retrato de presentación',
		alt: 'Retrato sonriente de Romina entre flores',
	},
	{
		key: 'family',
		relativePath: 'IMG_3405.jpeg',
		displayName: 'Romina — familia',
		alt: 'Romina acompañada por su familia y sus mascotas',
	},
	{
		key: 'sageLandscape',
		relativePath: 'IMG_3191.jpeg',
		displayName: 'Romina — vestido salvia horizontal',
		alt: 'Romina con vestido verde salvia en un jardín botánico',
	},
	{
		key: 'social',
		relativePath: 'IMG_3201.jpeg',
		displayName: 'Romina — vista previa social',
		alt: 'Romina con vestido verde salvia en una composición horizontal',
	},
	{
		key: 'petPortrait',
		relativePath: 'IMG_3308.jpeg',
		displayName: 'Romina — retrato con mascota',
		alt: 'Romina posa con una de sus mascotas',
	},
	{
		key: 'petLandscape',
		relativePath: 'IMG_3324.jpeg',
		displayName: 'Romina — mascotas',
		alt: 'Romina comparte un momento con sus mascotas en el jardín',
	},
	{
		key: 'whitePortrait',
		relativePath: 'IMG_3331.jpeg',
		displayName: 'Romina — capítulo blanco',
		alt: 'Romina con vestido blanco en un entorno botánico',
	},
	{
		key: 'whiteBotanical',
		relativePath: 'IMG_3386.jpeg',
		displayName: 'Romina — retrato botánico',
		alt: 'Romina con vestido blanco entre vegetación y cactus',
	},
	{
		key: 'pinkFloral',
		relativePath: 'IMG_3449.jpeg',
		displayName: 'Romina — capítulo floral',
		alt: 'Romina con vestido rosa junto a una estructura floral',
	},
	{
		key: 'closing',
		relativePath: 'IMG_3442.jpeg',
		displayName: 'Romina — cierre XV',
		alt: 'Romina junto a globos con el número quince',
	},
] as const;

export type RominaAssetKey = (typeof ROMINA_ASSET_SPECS)[number]['key'];
export type RominaAssetMap = Record<RominaAssetKey, UploadedAssetRef>;

const ceremonyAddress =
	'Boulevard Benito Juárez #200, Col. Centro, C.P. 31700, Nuevo Casas Grandes, Chihuahua';
const receptionAddress = 'Libramiento Gómez Morín, C.P. 31805, Nuevo Casas Grandes, Chihuahua';

function googleMapsSearch(query: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function appleMapsSearch(query: string): string {
	return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

export function buildRominaPublishedContent(
	assets: UploadedAssetMap<RominaAssetKey>,
): Record<string, unknown> {
	const ceremonyQuery = `Catedral de Nuestra Señora de la Medalla Milagrosa, ${ceremonyAddress}`;
	const receptionQuery = `Gabro Jardín de Eventos, ${receptionAddress}`;

	return {
		eventType: ROMINA_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-premiere-floral',
		visualProfileId: ROMINA_EVENT.visualProfileId,
		title: ROMINA_EVENT.title,
		description: 'Acompáñeme a celebrar este momento tan especial.',
		theme: { preset: ROMINA_EVENT.themeId, fontFamily: 'serif' },
		music: {
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1784908430/Perfect_opt_vkkh87.mp3',
			title: 'Perfect',
			autoPlay: true,
		},
		eventTiming: {
			localDateTime: ROMINA_EVENT.localDateTime,
			timeZone: ROMINA_EVENT.timeZone,
			startsAtUtc: ROMINA_EVENT.startsAtUtc,
		},
		composition: { intersections: {} },
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
		_assetSlug: ROMINA_EVENT.assetSlug,
		hero: {
			name: 'Romina Ríos Chaparro',
			label: 'MIS XV',
			date: ROMINA_EVENT.startsAtUtc,
			backgroundImage: assets.hero,
			backgroundImageMobile: assets.hero,
			backgroundImageDesktop: assets.hero,
			variant: 'split-cover',
			focalPoint: '50% 42%',
			focalPointMobile: '50% 42%',
			focalPointTablet: '50% 40%',
			focalPointDesktop: '58% 46%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'MIS XV',
			envelopeName: 'Romina Ríos Chaparro',
			cardName: 'Romina Ríos Chaparro',
			cardTagline: '14 · 08 · 2026',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'RC',
			microcopy: 'Abra su invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hay momentos que se sueñan toda la vida. Me hará muy feliz compartir con usted la celebración de mis XV años.',
			author: 'Romina',
		},
		family: {
			variant: 'standard',
			parents: {
				mother: 'Claudia Chaparro Juárez',
				father: 'Christian Miguel Ríos',
			},
			parentsOrder: 'mother-first',
			godparents: [{ name: 'Fernando Nájera' }, { name: 'Esmeralda Carbajal' }],
			labels: {
				sectionSubtitle: 'Círculo cercano',
				sectionTitle: 'Con el amor de mis padres y la compañía de mi familia',
				parentsTitle: 'Con la bendición de',
				godparentsTitle: 'Acompañada por mis padrinos',
				sectionMessage:
					'Su cariño ha acompañado cada paso de mi vida. Gracias por estar a mi lado y ser parte de un día que guardaré siempre en mi corazón.',
			},
			featuredImage: assets.family,
			focalPoint: '50% 35%',
		},
		countdown: {
			title: 'LA CELEBRACIÓN COMIENZA EN',
			footerText: 'Ceremonia Religiosa · 5:00 p. m.',
		},
		location: {
			variant: 'standard',
			visibility: 'public',
			introEyebrow: 'VIERNES · 14 DE AGOSTO DE 2026',
			introHeading: 'Ceremonia y recepción',
			ceremony: {
				venueEvent: 'Ceremonia',
				venueName: 'Catedral de Nuestra Señora de la Medalla Milagrosa',
				address: ceremonyAddress,
				city: 'Nuevo Casas Grandes, Chihuahua',
				date: '14 de agosto de 2026',
				time: '5:00 p. m.',
				mapUrl: googleMapsSearch(ceremonyQuery),
				googleMapsUrl: googleMapsSearch(ceremonyQuery),
				appleMapsUrl: appleMapsSearch(ceremonyQuery),
				coordinates: {
					lat: 30.4162552,
					lng: -107.9141371,
				},
			},
			reception: {
				venueEvent: 'Recepción',
				venueName: 'Gabro Jardín de Eventos',
				address: receptionAddress,
				city: 'Nuevo Casas Grandes, Chihuahua',
				date: '14 de agosto de 2026',
				time: '8:30 p. m.',
				mapUrl: googleMapsSearch(receptionQuery),
				googleMapsUrl: googleMapsSearch(receptionQuery),
				appleMapsUrl: appleMapsSearch(receptionQuery),
				coordinates: {
					lat: 30.4207812,
					lng: -107.8944895,
				},
			},
			indications: [
				{
					text: 'Código de vestimenta: Formal',
					iconName: 'DressCode',
					styleVariant: 'default',
				},
				{
					text: 'Favor de evitar los colores verde sage y beige, reservados para la quinceañera y sus damas.',
					iconName: 'FlowerSeal',
					styleVariant: 'default',
				},
			],
		},
		interludes: [
			{
				image: assets.sageLandscape,
				afterSection: 'location',
				alt: 'Romina con vestido verde salvia en un jardín botánico',
				height: 'tall',
				focalPoint: '50% 42%',
			},
		],
		itinerary: {
			variant: 'standard',
			title: 'Programa',
			items: [
				{ time: '5:00 p. m.', label: 'Ceremonia', iconName: 'Church' },
				{ time: '8:30 p. m.', label: 'Cena', iconName: 'Dinner' },
				{ time: '9:30 p. m.', label: 'Celebración', iconName: 'Party' },
			],
		},
		gallery: {
			variant: 'editorial-mosaic',
			eyebrow: 'Recuerdos',
			title: 'Romina',
			subtitle: 'Una historia entre naturaleza, familia y sueños',
			items: [
				{
					image: assets.portrait,
					alt: 'Retrato sonriente de Romina entre flores',
					focalPointMobile: '50% 28%',
					focalPointDesktop: '50% 24%',
				},
				{
					image: assets.petPortrait,
					alt: 'Romina posa con una de sus mascotas',
					focalPoint: '50% 30%',
				},
				{
					image: assets.whitePortrait,
					alt: 'Romina con vestido blanco en un entorno botánico',
					focalPoint: '50% 30%',
				},
				{
					image: assets.petLandscape,
					alt: 'Romina comparte un momento con sus mascotas en el jardín',
					focalPoint: '50% 48%',
				},
				{
					image: assets.whiteBotanical,
					alt: 'Romina con vestido blanco entre vegetación y cactus',
					focalPoint: '50% 32%',
				},
				{
					image: assets.pinkFloral,
					alt: 'Romina con vestido rosa junto a una estructura floral',
					focalPoint: '50% 28%',
				},
				{
					image: assets.social,
					alt: 'Romina con vestido verde salvia en una composición horizontal',
					focalPoint: '50% 44%',
				},
			],
		},
		rsvp: {
			variant: 'standard',
			title: 'Confirme su asistencia',
			subcopy:
				'Nos dará mucho gusto contar con su presencia. Por favor, confirme su asistencia para ayudarnos a preparar cada detalle.',
			guestCap: 4,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage:
				'Gracias por confirmar. Será un gusto compartir este día con usted.',
			personalizedAccess: {
				variant: 'ornamented',
				title: 'Pase de acceso',
				subtitle: 'Esta invitación ha sido preparada especialmente para:',
				footerText: 'Favor de confirmar su asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			variant: 'standard',
			message: 'Gracias por ser parte de este momento tan especial.',
			closingName: 'Romina',
			date: '14 de agosto de 2026',
			image: assets.closing,
			focalPoint: '50% 42%',
		},
		sharing: {
			ogImage: assets.social,
			ogDescription: 'Invitación a los XV años de Romina Ríos Chaparro',
			shareMessages: {
				reminder:
					'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
				invitation:
					'Hola {name}, le compartimos su invitación para los XV años de Romina: {inviteUrl}',
			},
			reminderSettings: {
				enabled: true,
				audience: 'unconfirmed',
				showWhenDaysBeforeEvent: 7,
			},
			whatsappTemplate:
				'Hola {name}, le compartimos su invitación para los XV años de Romina: {inviteUrl}',
		},
	};
}

export const rominaInvitation: InvitationDefinition<RominaAssetKey> = defineInvitation({
	slug: ROMINA_EVENT.slug,
	managedIdentityId: '3c4d5e6f-7081-42a3-b4c5-d6e7f8091a2b',
	createdAt: '2026-07-20T00:00:00.000Z',
	lifecycle: 'published',
	deliveryScope: 'content-and-assets',
	eventType: ROMINA_EVENT.eventType,
	title: ROMINA_EVENT.title,
	clientName: 'Romina Ríos Chaparro',
	hostLoginAlias: 'romina_rios_chaparro',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: ROMINA_EVENT.baseDemoId,
	themeId: ROMINA_EVENT.themeId,
	visualProfileId: ROMINA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: ROMINA_EVENT.localDateTime,
		timeZone: ROMINA_EVENT.timeZone,
		startsAtUtc: ROMINA_EVENT.startsAtUtc,
	},
	assets: ROMINA_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildRominaPublishedContent(assets);
	},
});
