/**
 * leslie-perez.ts — Local draft invitation definition for Leslie XV
 *
 * The structural variants are reused from existing invitations. Cadence and
 * dark-surface rhythm tokens live in `invitation-profiles/leslie-perez.scss`.
 * Local-only music/PA preview switches live in
 * `src/lib/invitation/local-preview-config.ts` (not published content).
 */

import { deriveStartsAtUtc } from '../../../src/lib/time/event-time.ts';
import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

const EVENT_DATE_LONG = '26 de septiembre de 2026';
const EVENT_DATE_ISO = '2026-09-26T19:00:00.000Z';
const TIME_ZONE = 'America/Monterrey';
const RECEPTION_LOCAL = '2026-09-26T19:00';
const EVENT_TIME_DISPLAY = '7:00 p. m.';
const derivedStartsAtUtc = deriveStartsAtUtc(RECEPTION_LOCAL, TIME_ZONE);
if (!derivedStartsAtUtc) {
	throw new Error('Leslie eventTiming.startsAtUtc could not be derived from America/Monterrey.');
}

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
	localDateTime: RECEPTION_LOCAL,
	timeZone: TIME_ZONE,
	startsAtUtc: derivedStartsAtUtc,
	eventTimeDisplay: EVENT_TIME_DISPLAY,
} as const;

export const LESLIE_ASSET_SPECS = [
	{
		key: 'photo-01',
		relativePath: 'delivery/01.webp',
		optimizationRole: 'hero-desktop',
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
		optimizationRole: 'gallery',
		displayName: 'Leslie — calendario de septiembre',
		alt: 'Leslie posa junto a un calendario de septiembre de 2026',
		focalPoint: { default: '50% 38%' },
	},
	{
		key: 'photo-03',
		relativePath: 'delivery/03.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — retrato al aire libre',
		alt: 'Leslie posa al aire libre bajo un cielo azul',
		focalPoint: { default: '50% 44%' },
	},
	{
		key: 'photo-04',
		relativePath: 'delivery/04.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — retrato editorial',
		alt: 'Retrato cercano de Leslie frente a un fondo de luces circulares',
		focalPoint: { default: '50% 50%' },
	},
	{
		key: 'photo-05',
		relativePath: 'delivery/05.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — globos y septiembre',
		alt: 'Leslie posa junto a globos y un calendario de septiembre de 2026',
		focalPoint: { default: '50% 38%' },
	},
	{
		key: 'photo-06',
		relativePath: 'delivery/06.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — carrusel',
		alt: 'Leslie posa frente a una estructura de carrusel bajo el cielo azul',
		focalPoint: { default: '50% 65%' },
	},
	{
		key: 'photo-07',
		relativePath: 'delivery/07.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — flores',
		alt: 'Leslie posa entre flores en un retrato vertical',
		focalPoint: { default: '55% 34%' },
	},
	{
		key: 'photo-08',
		relativePath: 'delivery/08.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — retrato con humo',
		alt: 'Retrato cercano de Leslie junto a una composición con humo',
		focalPoint: { default: '50% 45%' },
	},
	{
		key: 'photo-09',
		relativePath: 'delivery/09.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — silla y esferas',
		alt: 'Leslie posa junto a una silla roja y esferas disco',
		focalPoint: { default: '50% 50%' },
	},
	{
		key: 'photo-10',
		relativePath: 'delivery/10.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — columpio',
		alt: 'Leslie posa en un columpio al aire libre',
		focalPoint: { default: '50% 40%' },
	},
	{
		key: 'photo-11',
		relativePath: 'delivery/11.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — caballo',
		alt: 'Leslie posa a caballo bajo un follaje verde',
		focalPoint: { default: '50% 44%' },
	},
	{
		key: 'photo-12',
		relativePath: 'delivery/12.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — humo azul y rosa',
		alt: 'Leslie sostiene un dispositivo de humo frente al cielo azul',
		focalPoint: { default: '50% 55%' },
	},
	{
		key: 'photo-13',
		relativePath: 'delivery/13.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — caballo en el establo',
		alt: 'Leslie posa junto a un caballo en un establo',
		focalPoint: { default: '65% 50%' },
	},
	{
		key: 'photo-14',
		relativePath: 'delivery/14.webp',
		optimizationRole: 'gallery',
		displayName: 'Leslie — retrato ecuestre',
		alt: 'Leslie posa junto a un caballo en un espacio ecuestre',
		focalPoint: { default: '40% 50%' },
	},
	{
		key: 'photo-15',
		relativePath: 'delivery/15.webp',
		optimizationRole: 'editorial-featured',
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
		eventTiming: {
			localDateTime: LESLIE_EVENT.localDateTime,
			timeZone: LESLIE_EVENT.timeZone,
			startsAtUtc: LESLIE_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'family',
			'countdown',
			'quote',
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
				// Hero → Family → Countdown: paired opposite shallow diagonals (paper sheet / navy cut).
				family: { family: 'overlap', source: 'hero' },
				countdown: { family: 'overlap', source: 'family' },
				'interlude-after-location': { family: 'overlap', source: 'location' },
				itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
				'interlude-after-gallery': { family: 'overlap', source: 'gallery' },
				gifts: { family: 'atmospheric-blend', source: 'interlude-after-gallery' },
				'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
				thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
			},
		},
		_assetSlug: LESLIE_EVENT.assetSlug,
		hero: {
			name: 'Leslie',
			label: 'MIS XV',
			date: LESLIE_EVENT.eventDateIso,
			backgroundImage: assets['photo-01'],
			backgroundImageMobile: assets['photo-01'],
			backgroundImageDesktop: assets['photo-01'],
			variant: 'split-cover',
			focalPoint: '55% 45%',
			focalPointMobile: '40% 44%',
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
			microcopy: 'Abrir mi invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hoy celebro el regalo de la vida, la belleza del presente y la promesa de un nuevo amanecer.',
			author: 'Leslie',
		},
		family: {
			variant: 'asymmetric-groups',
			presentation: 'text-only',
			parents: {
				father: 'Luis Enrique Zacarias Oviedo',
				mother: 'Leticia Perez Moreno',
			},
			parentsOrder: 'father-first',
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Con la guía y el amor de mis padres',
				parentsTitle: 'Mis Padres',
				sectionMessage:
					'Gracias a su entrega, ejemplo y cariño incondicional, hoy inicio este nuevo camino con profunda gratitud.',
			},
		},
		countdown: {
			variant: 'editorial-folio',
			title: 'La cuenta regresiva hacia el gran día',
			footerText: `Sábado, 26 de septiembre · ${EVENT_TIME_DISPLAY}`,
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
				time: EVENT_TIME_DISPLAY,
				mapUrl: VENUE_MAP_URL,
				googleMapsUrl: VENUE_MAP_URL,
				coordinates: { lat: 25.7444444, lng: -100.1725 },
			},
			indications: [
				{
					text: 'Código de vestimenta: formal.',
					iconName: 'DressCode',
				},
				{
					text: 'El color azul marino está reservado exclusivamente para la quinceañera.',
					iconName: 'FlowerSeal',
					styleVariant: 'reserved',
				},
			],
		},
		itinerary: {
			variant: 'standard',
			title: 'Programa',
			subtitle: 'Itinerario de la celebración',
			items: [
				{
					time: '19:00',
					label: 'Recepción',
					description: 'Llegada de invitados y cóctel de bienvenida.',
					iconName: 'Diamond',
				},
				{
					time: '21:45',
					label: 'Vals',
					description: 'Tradicional vals familiar.',
					iconName: 'Crown',
				},
				{
					time: '22:30',
					label: 'Cena',
					description: 'Servicio de banquete en honor a la festejada.',
					iconName: 'Dinner',
				},
				{
					time: '02:00',
					label: 'Cierre',
					description: 'Muchas gracias por acompañarnos.',
					iconName: 'Sparkles',
				},
			],
		},
		interludes: [
			{
				image: assets['photo-04'],
				afterSection: 'location',
				alt: 'Retrato cercano de Leslie frente a un fondo de luces circulares',
				height: 'tall',
				focalPoint: '50% 36%',
			},
			{
				image: assets['photo-08'],
				afterSection: 'gallery',
				alt: 'Retrato cercano de Leslie junto a una composición con humo',
				height: 'tall',
				focalPoint: '34% 40%',
			},
		],
		gallery: {
			variant: 'index-choreography',
			eyebrow: 'Sesión Fotográfica',
			title: 'Leslie',
			subtitle: 'Postales de una etapa llena de luz y juventud',
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
		gifts: {
			variant: 'standard',
			title: 'Lluvia de Sobres',
			subtitle:
				'Su presencia en esta fecha tan significativa es nuestra mayor alegría. Si desea tener una muestra de aprecio con Leslie, dispondremos de un buzón en el salón.',
			items: [
				{
					type: 'cash',
					title: 'Lluvia de Sobres',
					text: 'Habrá un espacio destinado para sobres durante la recepción en San Carlos Eventos.',
				},
			],
		},
		rsvp: {
			variant: 'formal-register',
			title: 'Confirme su asistencia',
			subcopy: 'Agradeceremos confirmar su asistencia antes del 15 de septiembre.',
			guestCap: 1,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage:
				'¡Confirmación registrada con éxito! Será un verdadero honor recibirle.',
			responseMessages: {
				confirmed: { title: '¡Asistencia confirmada, {guestName}!' },
				declined: { title: 'Agradecemos su gentil notificación, {guestName}.' },
			},
			personalizedAccess: {
				variant: 'formal-pass',
				title: 'Pase de acceso',
				subtitle: 'Extendemos una cordial invitación a:',
				noteText: 'Presentar digitalmente al ingresar a San Carlos Eventos.',
				footerText: 'Confirme su asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			variant: 'full-bleed-photo',
			message: 'Gracias por formar parte de este momento.',
			closingName: 'Leslie',
			image: assets['photo-15'],
			focalPoint: '50% 38%',
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
		localDateTime: LESLIE_EVENT.localDateTime,
		timeZone: LESLIE_EVENT.timeZone,
		startsAtUtc: LESLIE_EVENT.startsAtUtc,
	},
	assets: LESLIE_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildLesliePublishedContent(assets);
	},
});
