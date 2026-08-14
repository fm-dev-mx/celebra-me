/**
 * leslie-perez.ts — Local draft invitation definition for Leslie XV
 *
 * The structural variants are reused from existing invitations. No
 * invitation-specific component or stylesheet is introduced here.
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

const EVENT_DATE_LONG = '26 de septiembre de 2026';
const EVENT_DATE_ISO = '2026-09-26T00:00:00.000Z';
const TIME_ZONE = 'America/Monterrey';
const VENUE_ADDRESS =
	'Blvd. Julián Treviño Elizondo #500, Col. Huinalá, Apodaca, Nuevo León, 66645';
const VENUE_MAP_URL =
	'https://www.google.com/maps/place/San+Carlos+Eventos/@25.7444444,-100.1750749,17z/data=!3m1!4b1!4m6!3m5!1s0x8662ebd82f7d4185:0xabccee64fcb414df!8m2!3d25.7444444!4d-100.1725!16s%2Fg%2F11bx2lcrr3?entry=ttu&g_ep=EgoyMDI2MDgwNS4xIKXMDSoASAFQAw%3D%3D';

export const LESLIE_EVENT = {
	eventType: 'xv',
	slug: 'leslie-perez',
	assetSlug: 'leslie-perez',
	baseDemoId: 'demo-xv-celestial-blue',
	themeId: 'celestial-blue',
	visualProfileId: 'leslie-perez',
	title: 'XV años de Leslie',
	eventDateLong: EVENT_DATE_LONG,
	eventDateIso: EVENT_DATE_ISO,
	timeZone: TIME_ZONE,
} as const;

export const LESLIE_ASSET_SPECS = [
	{
		key: 'photo-01',
		relativePath: 'delivery/01.webp',
		displayName: 'Leslie — portada con Save the Date',
		alt: 'Leslie sostiene un letrero de Save the Date con la fecha 26.09.26',
		focalPoint: {
			default: '55% 45%',
			mobile: '60% 44%',
			tablet: '56% 44%',
			desktop: '54% 45%',
		},
	},
	{
		key: 'photo-02',
		relativePath: 'delivery/02.webp',
		displayName: 'Leslie — calendario de septiembre',
		alt: 'Leslie posa junto a un calendario de septiembre de 2026',
		focalPoint: { default: '50% 38%' },
	},
	{
		key: 'photo-03',
		relativePath: 'delivery/03.webp',
		displayName: 'Leslie — retrato al aire libre',
		alt: 'Leslie posa al aire libre bajo un cielo azul',
		focalPoint: { default: '50% 44%' },
	},
	{
		key: 'photo-04',
		relativePath: 'delivery/04.webp',
		displayName: 'Leslie — retrato editorial',
		alt: 'Retrato cercano de Leslie frente a un fondo de luces circulares',
		focalPoint: { default: '50% 50%' },
	},
	{
		key: 'photo-05',
		relativePath: 'delivery/05.webp',
		displayName: 'Leslie — globos y septiembre',
		alt: 'Leslie posa junto a globos y un calendario de septiembre de 2026',
		focalPoint: { default: '50% 38%' },
	},
	{
		key: 'photo-06',
		relativePath: 'delivery/06.webp',
		displayName: 'Leslie — carrusel',
		alt: 'Leslie posa frente a una estructura de carrusel bajo el cielo azul',
		focalPoint: { default: '50% 65%' },
	},
	{
		key: 'photo-07',
		relativePath: 'delivery/07.webp',
		displayName: 'Leslie — flores',
		alt: 'Leslie posa entre flores en un retrato vertical',
		focalPoint: { default: '55% 34%' },
	},
	{
		key: 'photo-08',
		relativePath: 'delivery/08.webp',
		displayName: 'Leslie — retrato con humo',
		alt: 'Retrato cercano de Leslie junto a una composición con humo',
		focalPoint: { default: '50% 45%' },
	},
	{
		key: 'photo-09',
		relativePath: 'delivery/09.webp',
		displayName: 'Leslie — silla y esferas',
		alt: 'Leslie posa junto a una silla roja y esferas disco',
		focalPoint: { default: '50% 50%' },
	},
	{
		key: 'photo-10',
		relativePath: 'delivery/10.webp',
		displayName: 'Leslie — columpio',
		alt: 'Leslie posa en un columpio al aire libre',
		focalPoint: { default: '50% 40%' },
	},
	{
		key: 'photo-11',
		relativePath: 'delivery/11.webp',
		displayName: 'Leslie — caballo',
		alt: 'Leslie posa a caballo bajo un follaje verde',
		focalPoint: { default: '50% 44%' },
	},
	{
		key: 'photo-12',
		relativePath: 'delivery/12.webp',
		displayName: 'Leslie — humo azul y rosa',
		alt: 'Leslie sostiene un dispositivo de humo frente al cielo azul',
		focalPoint: { default: '50% 55%' },
	},
	{
		key: 'photo-13',
		relativePath: 'delivery/13.webp',
		displayName: 'Leslie — caballo en el establo',
		alt: 'Leslie posa junto a un caballo en un establo',
		focalPoint: { default: '65% 50%' },
	},
	{
		key: 'photo-14',
		relativePath: 'delivery/14.webp',
		displayName: 'Leslie — retrato ecuestre',
		alt: 'Leslie posa junto a un caballo en un espacio ecuestre',
		focalPoint: { default: '40% 50%' },
	},
	{
		key: 'photo-15',
		relativePath: 'delivery/15.webp',
		displayName: 'Leslie — cierre Save the Date',
		alt: 'Leslie aparece de espaldas junto a globos y un letrero de Save the Date',
		focalPoint: { default: '50% 48%' },
	},
] as const;

export type LeslieAssetKey = (typeof LESLIE_ASSET_SPECS)[number]['key'];
export type LeslieAssetMap = Record<LeslieAssetKey, UploadedAssetRef>;

function galleryItem(
	assets: UploadedAssetMap<LeslieAssetKey>,
	key: LeslieAssetKey,
	alt: string,
	focalPoint: string,
) {
	return { key, image: assets[key], alt, focalPoint };
}

export function buildLesliePublishedContent(
	assets: UploadedAssetMap<LeslieAssetKey>,
): Record<string, unknown> {
	return {
		eventType: LESLIE_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-celestial-blue',
		visualProfileId: LESLIE_EVENT.visualProfileId,
		title: LESLIE_EVENT.title,
		description: 'Invitación a los XV años de Leslie en San Carlos Eventos.',
		theme: { preset: LESLIE_EVENT.themeId },
		// Date is confirmed; time remains intentionally unresolved until owner handoff.
		eventTiming: { timeZone: LESLIE_EVENT.timeZone },
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
		composition: { intersections: {} },
		_assetSlug: LESLIE_EVENT.assetSlug,
		hero: {
			name: 'Leslie',
			label: 'MIS XV',
			date: LESLIE_EVENT.eventDateIso,
			backgroundImage: assets['photo-01'],
			variant: 'split-cover',
			focalPoint: '55% 45%',
			focalPointMobile: '60% 44%',
			focalPointTablet: '56% 44%',
			focalPointDesktop: '54% 45%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'MIS XV',
			envelopeName: 'Leslie',
			cardName: 'Leslie',
			cardTagline: '26 · 09 · 2026',
			sealStyle: 'wax',
			sealIcon: 'wax-monogram',
			microcopy: 'Abre mi invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: '[[PENDIENTE:TEXTO_INVITACION]]',
			author: 'Leslie',
		},
		family: {
			variant: 'asymmetric-groups',
			presentation: 'text-only',
			parents: {
				mother: 'Leticia Perez Moreno',
				father: 'Luis Enrique Zacarias Oviedo',
			},
			parentsOrder: 'mother-first',
			labels: {
				sectionSubtitle: 'Con el amor de mi familia',
				sectionTitle: 'Mis XV años',
				parentsTitle: 'Mis padres',
				sectionMessage: 'Gracias por acompañarme en este día tan especial.',
			},
		},
		countdown: {
			title: 'LA CELEBRACIÓN COMIENZA EN',
			footerText: 'Hora del evento: [[PENDIENTE:HORA_EVENTO]]',
			presentationOptions: { visibleUnits: ['days'] },
		},
		location: {
			variant: 'split-map',
			visibility: 'public',
			introEyebrow: 'SÁBADO · 26 DE SEPTIEMBRE DE 2026',
			introHeading: 'Recepción',
			reception: {
				venueEvent: 'Recepción',
				venueName: 'San Carlos Eventos',
				address: VENUE_ADDRESS,
				city: 'Apodaca, Nuevo León',
				date: EVENT_DATE_LONG,
				time: '[[PENDIENTE:HORA_EVENTO]]',
				mapUrl: VENUE_MAP_URL,
				googleMapsUrl: VENUE_MAP_URL,
				coordinates: { lat: 25.7444444, lng: -100.1725 },
			},
			indications: [
				{
					text: 'El azul marino está reservado para Leslie.',
					iconName: 'FlowerSeal',
					styleVariant: 'reserved',
				},
			],
		},
		itinerary: {
			variant: 'timeline-paper',
			title: 'Momentos de la celebración',
			items: [
				{ time: '[[PENDIENTE:HORA_RECEPCION]]', label: 'Recepción', iconName: 'Reception' },
				{ time: '[[PENDIENTE:HORA_CENA]]', label: 'Cena', iconName: 'Dinner' },
				{ time: '[[PENDIENTE:HORA_VALS]]', label: 'Vals', iconName: 'Waltz' },
				{ time: '[[PENDIENTE:HORA_BRINDIS]]', label: 'Brindis', iconName: 'Toast' },
				{ time: '[[PENDIENTE:HORA_BAILE]]', label: 'Baile', iconName: 'Party' },
				{ time: '[[PENDIENTE:HORA_CIERRE]]', label: 'Cierre', iconName: 'Sparkles' },
			],
		},
		gallery: {
			variant: 'index-choreography',
			eyebrow: 'Recuerdos',
			title: 'Leslie',
			subtitle: 'Quince momentos para celebrar esta nueva etapa',
			items: [
				galleryItem(
					assets,
					'photo-02',
					'Leslie posa junto al calendario de septiembre de 2026',
					'50% 38%',
				),
				galleryItem(
					assets,
					'photo-03',
					'Leslie posa al aire libre bajo un cielo azul',
					'50% 44%',
				),
				galleryItem(
					assets,
					'photo-04',
					'Retrato cercano de Leslie frente a luces circulares',
					'50% 50%',
				),
				galleryItem(
					assets,
					'photo-05',
					'Leslie posa junto a globos y un calendario de septiembre',
					'50% 38%',
				),
				galleryItem(
					assets,
					'photo-06',
					'Leslie posa frente a una estructura de carrusel',
					'50% 65%',
				),
				galleryItem(assets, 'photo-07', 'Leslie posa entre flores', '55% 34%'),
				galleryItem(
					assets,
					'photo-08',
					'Retrato editorial de Leslie junto a humo',
					'50% 45%',
				),
				galleryItem(
					assets,
					'photo-09',
					'Leslie posa junto a una silla roja y esferas disco',
					'50% 50%',
				),
				galleryItem(
					assets,
					'photo-10',
					'Leslie posa en un columpio al aire libre',
					'50% 40%',
				),
				galleryItem(
					assets,
					'photo-11',
					'Leslie posa a caballo bajo un follaje verde',
					'50% 44%',
				),
				galleryItem(
					assets,
					'photo-12',
					'Leslie sostiene un dispositivo de humo frente al cielo',
					'50% 55%',
				),
				galleryItem(
					assets,
					'photo-13',
					'Leslie posa junto a un caballo en un establo',
					'65% 50%',
				),
				galleryItem(
					assets,
					'photo-14',
					'Leslie posa junto a un caballo en un espacio ecuestre',
					'40% 50%',
				),
			],
		},
		rsvp: {
			variant: 'standard',
			title: 'Confirma tu asistencia',
			subcopy:
				'Agradeceremos confirmar tu asistencia antes de [[PENDIENTE:FECHA_LIMITE_RSVP]].',
			guestCap: 1,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage: 'Gracias por confirmar. Será un gusto celebrar contigo.',
			responseMessages: {
				confirmed: { title: '¡Gracias por confirmar, {guestName}!' },
				declined: { title: 'Gracias por avisarnos, {guestName}.' },
			},
			personalizedAccess: {
				variant: 'formal-pass',
				title: 'Tu invitación personal',
				subtitle: 'Esta invitación ha sido preparada especialmente para:',
				footerText: 'Confirma tu asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			variant: 'full-bleed-photo',
			message: 'Gracias por ser parte de este momento tan especial.',
			closingName: 'Leslie',
			date: EVENT_DATE_LONG,
			image: assets['photo-15'],
			focalPoint: '50% 48%',
		},
	};
}

export const leslieInvitation: InvitationDefinition<LeslieAssetKey> = defineInvitation({
	slug: LESLIE_EVENT.slug,
	managedIdentityId: '7f0d1c2a-6b4e-4e8d-9a31-5c7b2d0f4e66',
	createdAt: '2026-08-14T00:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: LESLIE_EVENT.eventType,
	title: LESLIE_EVENT.title,
	clientName: 'Leslie',
	hostLoginAlias: 'leslie_perez',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: LESLIE_EVENT.baseDemoId,
	themeId: LESLIE_EVENT.themeId,
	visualProfileId: LESLIE_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: '',
		timeZone: LESLIE_EVENT.timeZone,
		startsAtUtc: '',
	},
	assets: LESLIE_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildLesliePublishedContent(assets);
	},
});
