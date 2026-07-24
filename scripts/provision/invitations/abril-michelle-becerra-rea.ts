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
		key: 'hero',
		relativePath: 'hero.webp',
		displayName: 'Abril Michelle — portada',
		alt: 'Abril Michelle con vestido rosa palo y tiara en un entorno botánico',
		focalPoint: {
			default: '50% 40%',
			mobile: '50% 38%',
			tablet: '50% 40%',
			desktop: '50% 42%',
		},
	},
	{
		key: 'gallery01',
		relativePath: 'gallery-01.webp',
		displayName: 'Abril Michelle — retrato dorado',
		alt: 'Abril Michelle luciendo vestido y tiara entre follaje',
	},
	{
		key: 'gallery02',
		relativePath: 'gallery-02.webp',
		displayName: 'Abril Michelle — pérgola floral',
		alt: 'Abril Michelle con vestido rosa palo en una pérgola de jardín',
	},
	{
		key: 'gallery03',
		relativePath: 'gallery-03.webp',
		displayName: 'Abril Michelle — jardín editorial',
		alt: 'Retrato sonriente de Abril Michelle en un jardín',
	},
	{
		key: 'crownDetail',
		relativePath: 'crown-detail.webp',
		displayName: 'Abril Michelle — detalle de tiara',
		alt: 'Retrato cercano de Abril Michelle luciendo su tiara',
	},
	{
		key: 'closing',
		relativePath: 'closing.webp',
		displayName: 'Abril Michelle — cierre XV',
		alt: 'Abril Michelle en una composición de cierre de evento',
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
		description: 'Acompáñame a celebrar un día inolvidable en mis XV años.',
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
			label: 'MIS XV AÑOS',
			date: ABRIL_EVENT.startsAtUtc,
			backgroundImage: assets.hero,
			backgroundImageMobile: assets.hero,
			backgroundImageDesktop: assets.hero,
			focalPoint: '50% 40%',
			focalPointMobile: '50% 38%',
			focalPointTablet: '50% 40%',
			focalPointDesktop: '50% 42%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'MIS XV AÑOS',
			envelopeName: 'Abril Michelle Becerra Rea',
			cardName: 'Abril Michelle',
			cardTagline: '12 · 09 · 2026',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'AM',
			microcopy: 'Abra su invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Con la ilusión de comenzar una nueva etapa y el amor de quienes me acompañan, celebro la alegría de mis XV años.',
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
				sectionTitle: 'Con el amor de mis padres y el apoyo de mis padrinos',
				parentsTitle: 'Con la bendición de mis padres',
				godparentsTitle: 'Acompañada por mis padrinos',
				sectionMessage:
					'Gracias por guiarme con amor en cada instante. Su presencia y cariño hacen que este día sea infinitamente especial.',
			},
			featuredImage: assets.crownDetail,
			focalPoint: '50% 35%',
		},
		countdown: {
			title: 'LA CELEBRACIÓN COMIENZA EN',
			footerText: 'Misa · 3:00 p. m.',
		},
		location: {
			visibility: 'public',
			introEyebrow: 'SÁBADO · 12 DE SEPTIEMBRE DE 2026',
			introHeading: 'Ceremonia y recepción',
			ceremony: {
				venueEvent: 'Misa de acción de gracias',
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
				},
			},
			reception: {
				venueEvent: 'Recepción y fiesta',
				venueName: 'Garden Palace',
				address: receptionAddress,
				city: 'Lagos de Moreno, Jalisco',
				date: '12 de septiembre de 2026',
				time: '5:00 p. m.',
				mapUrl: 'https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6',
				googleMapsUrl: 'https://maps.app.goo.gl/EbgZsEcrjTSmD9wK6',
				appleMapsUrl:
					'https://maps.apple.com/?q=Garden+Palace+Lagos+de+Moreno',
				coordinates: {
					lat: 21.3206241,
					lng: -101.9328009,
					zoom: 14,
				},
			},
		},
		itinerary: {
			title: 'Programa del evento',
			items: [
				{ time: '3:00 p. m.', label: 'Misa', iconName: 'Church' },
				{ time: '5:00 p. m.', label: 'Recepción', iconName: 'Reception' },
				{ time: '6:00 p. m.', label: 'Cena', iconName: 'Dinner' },
				{ time: '7:00 p. m.', label: 'Vals', iconName: 'Waltz' },
				{ time: '12:00 a. m.', label: 'Cierre de evento', iconName: 'Sparkles' },
			],
		},
		gallery: {
			eyebrow: 'Galería',
			title: 'Abril Michelle',
			subtitle: 'Un recuerdo de elegancia, familia y momentos inolvidables',
			items: [
				{
					image: assets.gallery01,
					alt: 'Abril Michelle luciendo vestido y tiara entre follaje',
					focalPointMobile: '50% 30%',
					focalPointDesktop: '50% 25%',
				},
				{
					image: assets.crownDetail,
					alt: 'Retrato cercano de Abril Michelle luciendo su tiara',
					focalPoint: '50% 30%',
				},
				{
					image: assets.gallery02,
					alt: 'Abril Michelle con vestido rosa palo en una pérgola de jardín',
					focalPoint: '50% 35%',
				},
				{
					image: assets.gallery03,
					alt: 'Retrato sonriente de Abril Michelle en un jardín',
					focalPoint: '50% 32%',
				},
				{
					image: assets.closing,
					alt: 'Abril Michelle en una composición de cierre de evento',
					focalPoint: '50% 40%',
				},
			],
		},
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy:
				'Será un honor contar con su presencia. Por favor, confirme su asistencia para acompañarnos en esta celebración.',
			guestCap: 4,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage:
				'Gracias por confirmar su asistencia. Será un gusto compartir este día tan especial con usted.',
			personalizedAccess: {
				title: 'Pase de acceso',
				subtitle: 'Esta invitación ha sido preparada especialmente para:',
				footerText: 'Favor de confirmar su asistencia en el formulario.',
			},
		},
		thankYou: {
			message: 'Gracias por formar parte de este momento inolvidable.',
			closingName: 'Abril Michelle',
			date: '12 de septiembre de 2026',
			image: assets.closing,
			focalPoint: '50% 40%',
		},
		sharing: {
			ogImage: assets.hero,
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
