/**
 * destenid-sofia.ts — Managed invitation definition for Destenid Sofía XV
 *
 * Content owner for xv/destenid-sofia. Editorial-magazine layout modeled on the
 * valentina-hernandez invitation, recolored to a black, beige, and gold palette in the
 * destenid-sofia visual profile. Reception only (no ceremony); parents and godparents are
 * intentionally omitted at the client's request, so the family section carries the
 * celebrant's prayer instead. Photographs are WhatsApp-class previews until originals arrive.
 */

import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import { deriveStartsAtUtc } from '../../../src/lib/time/event-time.ts';
import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

const TIME_ZONE = 'America/Mexico_City';
// Reception start confirmed by the client's program (Recepción 7 pm).
const RECEPTION_LOCAL = '2026-11-13T19:00';
const derivedStartsAtUtc = deriveStartsAtUtc(RECEPTION_LOCAL, TIME_ZONE);
if (!derivedStartsAtUtc) {
	throw new Error(
		'Destenid eventTiming.startsAtUtc could not be derived from America/Mexico_City.',
	);
}

export const DESTENID_EVENT = {
	eventType: 'xv',
	slug: 'destenid-sofia',
	assetSlug: 'destenid-sofia',
	baseDemoId: 'demo-xv-editorial-magazine',
	themeId: 'editorial-magazine',
	visualProfileId: 'destenid-sofia',
	title: 'XV Años — Destenid Sofía',
	localDateTime: RECEPTION_LOCAL,
	timeZone: TIME_ZONE,
	startsAtUtc: derivedStartsAtUtc,
	/**
	 * The editorial cover formats hero.date with timeZone: 'UTC', and 19:00 in Mexico City is
	 * already 14 November in UTC. Keep a wall-clock Z instant so the visible date stays
	 * 13 de noviembre; eventTiming owns the real instant.
	 */
	heroDate: '2026-11-13T19:00:00.000Z',
	eventDateLong: 'viernes 13 de noviembre de 2026',
} as const;

const CELEBRANT_NAME = 'Destenid Sofía';
const VENUE_NAME = 'Jardín Quinta Paraíso';
const VENUE_ADDRESS = 'Calle Rosa Violeta 8, C.P. 54765, Cuautitlán Izcalli, Estado de México';
const VENUE_CITY = 'Cuautitlán Izcalli, Estado de México';
const MAPS_URL =
	'https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Quinta+Para%C3%ADso+Calle+Rosa+Violeta+8+Cuautitl%C3%A1n+Izcalli';
const RSVP_WHATSAPP = '524611830851';
const MUSIC_URL =
	'https://res.cloudinary.com/dusxvauvj/video/upload/v1790740387/yo_soy_Rebelde_-_RBD_vnzffv.mp3';
// The client asked for the song "del segundo 39 en adelante"; the file is the full track.
const MUSIC_START_SECONDS = 39;

/**
 * Gift transfer: BBVA debit card supplied by the client (holder below). The owner pastes the
 * 16-digit card number here — it is intentionally not typed by tooling. The transfer card
 * appears only when this is filled; with a CLABE instead, set accountKind to 'clabe'.
 */
const GIFT_TRANSFER_CARD = '';
const GIFT_TRANSFER_HOLDER = 'Destenid Sofía Magaña Almaraz';

const PRAYER =
	'Gracias, Dios, por estos 15 años llenos de vida, amor y aprendizaje. Hoy pongo en tus manos esta nueva etapa que comienza; sé siempre la luz que guíe mis pasos y el refugio de mis sueños. Te doy gracias por el milagro de mi vida, por la infancia que con amor dejo atrás y por el futuro que hoy pongo en tus manos. Gracias por mi familia y por cada persona que ha sido un reflejo de tu amor en mi camino. Te pido que bendigas esta nueva etapa, ilumines mi corazón y me des la sabiduría para caminar siempre de tu mano. Amén.';

export const DESTENID_ASSET_SPECS = [
	{
		key: 'hero',
		relativePath: 'hero.jpg',
		displayName: 'Destenid — portada',
		alt: 'Destenid con corona dorada junto a hortensias y un portón de madera',
		focalPoint: { default: '45% 34%', mobile: '42% 30%' },
	},
	{
		// Same source as the cover: the client's chosen photograph also leads the desktop card,
		// under its own key so each delivery role keeps a single binding.
		key: 'heroPortrait',
		relativePath: 'hero.jpg',
		displayName: 'Destenid — portada (retrato)',
		alt: 'Destenid con corona dorada junto a hortensias y un portón de madera',
		focalPoint: { default: '45% 34%' },
	},
	{
		key: 'portrait',
		relativePath: 'portrait.jpg',
		displayName: 'Destenid — retrato',
		alt: 'Destenid asomada a una ventana con una torre antigua al fondo',
		focalPoint: { default: '52% 66%' },
	},
	{
		key: 'gallery01',
		relativePath: 'gallery-01.jpg',
		displayName: 'Destenid — galería 1',
		alt: 'Destenid con vestido beige recargada en un muro de piedra',
	},
	{
		key: 'gallery02',
		relativePath: 'gallery-02.jpg',
		displayName: 'Destenid — galería 2',
		alt: 'Destenid caminando por un sendero entre setos',
	},
	{
		key: 'gallery03',
		relativePath: 'gallery-03.jpg',
		displayName: 'Destenid — galería 3',
		alt: 'Destenid sentada con lentes blancos frente a un muro antiguo',
	},
	{
		key: 'gallery04',
		relativePath: 'gallery-04.jpg',
		displayName: 'Destenid — galería 4',
		alt: 'Destenid en cuclillas en un patio con cúpula al fondo',
	},
	{
		key: 'gallery05',
		relativePath: 'gallery-05.jpg',
		displayName: 'Destenid — galería 5',
		alt: 'Destenid de pie en una escalinata de piedra',
	},
	{
		key: 'gallery06',
		relativePath: 'gallery-06.jpg',
		displayName: 'Destenid — galería 6',
		alt: 'Destenid sentada sobre un tronco en el bosque',
	},
	{
		key: 'gallery07',
		relativePath: 'gallery-07.jpg',
		displayName: 'Destenid — galería 7',
		alt: 'Destenid posando junto a un muro de piedra oscuro',
	},
	{
		key: 'gallery08',
		relativePath: 'gallery-08.jpg',
		displayName: 'Destenid — galería 8',
		alt: 'Destenid vista desde arriba sobre piso de piedra',
	},
	{
		key: 'gallery09',
		relativePath: 'gallery-09.jpg',
		displayName: 'Destenid — galería 9',
		alt: 'Destenid sentada en un muro con vegetación',
	},
	{
		key: 'gallery10',
		relativePath: 'gallery-10.jpg',
		displayName: 'Destenid — galería 10',
		alt: 'Destenid sentada con lentes blancos en un jardín',
	},
	{
		key: 'prayerPortrait',
		relativePath: 'prayer-portrait.jpg',
		displayName: 'Destenid — oración',
		alt: 'Vista por una ventana de madera hacia un templo antiguo',
		focalPoint: { default: '50% 60%' },
	},
	{
		key: 'interlude01',
		relativePath: 'interlude-01.jpg',
		displayName: 'Destenid — interludio',
		alt: 'Destenid al fondo de un túnel de piedra',
		focalPoint: { default: '50% 52%' },
	},
	{
		key: 'thankYouPortrait',
		relativePath: 'thank-you-portrait.jpg',
		displayName: 'Destenid — cierre',
		alt: 'Destenid con vestido corto y guantes blancos, sentada en un muro de piedra',
		focalPoint: { default: '42% 90%' },
	},
] as const;

export type DestenidAssetKey = (typeof DESTENID_ASSET_SPECS)[number]['key'];
export type DestenidAssetMap = Record<DestenidAssetKey, UploadedAssetRef>;

const ASSET_ALT = Object.fromEntries(
	DESTENID_ASSET_SPECS.map((spec) => [spec.key, spec.alt]),
) as Record<DestenidAssetKey, string>;

function galleryItem(assets: DestenidAssetMap, key: DestenidAssetKey) {
	return { image: assets[key], alt: ASSET_ALT[key] };
}

export function buildDestenidPublishedContent(
	assets: UploadedAssetMap<DestenidAssetKey>,
): Record<string, unknown> {
	const hasTransfer = GIFT_TRANSFER_CARD.replace(/\s+/g, '').length > 0;
	return {
		eventType: DESTENID_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-editorial-magazine',
		visualProfileId: DESTENID_EVENT.visualProfileId,
		title: DESTENID_EVENT.title,
		description:
			'Invitación editorial para los XV años de Destenid Sofía, en tonos negro, beige y dorado.',
		_assetSlug: DESTENID_EVENT.assetSlug,
		theme: {
			fontFamily: 'serif',
			preset: DESTENID_EVENT.themeId,
		},
		eventTiming: {
			localDateTime: DESTENID_EVENT.localDateTime,
			timeZone: DESTENID_EVENT.timeZone,
			startsAtUtc: DESTENID_EVENT.startsAtUtc,
		},
		composition: { intersections: {} },
		music: {
			url: MUSIC_URL,
			title: 'Rebelde · RBD',
			autoPlay: true,
			startAt: MUSIC_START_SECONDS,
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
		hero: {
			name: CELEBRANT_NAME,
			label: 'Mis XV',
			date: DESTENID_EVENT.heroDate,
			backgroundImage: assets.hero,
			// The client chose WA0029 as the main photograph, so it also leads the desktop cover.
			portrait: assets.heroPortrait,
			variant: 'editorial-cover',
			focalPoint: '45% 34%',
			focalPointMobile: '42% 30%',
			tagline: 'Mis XV, un nuevo capítulo.',
		},
		quote: {
			// Client phrase; only the three dots became a typographic ellipsis.
			text: 'Un día me dijeron que la vida se mide en momentos inolvidables… hoy empieza uno de los más grandes. Acompáñame a escribir este capítulo.',
			author: CELEBRANT_NAME,
		},
		family: {
			variant: 'standard',
			featuredImage: assets.prayerPortrait,
			labels: {
				sectionTitle: 'Gracias, Dios',
				sectionSubtitle: 'Mi oración',
				sectionMessage: PRAYER,
			},
			focalPoint: '53% 74%',
		},
		countdown: {
			title: 'La cuenta regresiva',
			footerText: 'Jardín Quinta Paraíso, Cuautitlán Izcalli',
			variant: 'magazine-folio',
		},
		itinerary: {
			title: 'Programa',
			subtitle: 'Cinco momentos, una sola noche.',
			variant: 'editorial-program',
			items: [
				{ iconName: 'Reception', label: 'Recepción', time: '19:00' },
				{ iconName: 'Crown', label: 'Presentación de la quinceañera', time: '20:00' },
				{ iconName: 'Dinner', label: 'Cena', time: '20:30' },
				{ iconName: 'Waltz', label: 'Vals', time: '22:00' },
				// The client wrote "Cierre 2,pm"; read as 2:00 a.m. after the 10 p.m. waltz.
				{ iconName: 'Party', label: 'Cierre', time: '02:00' },
			],
		},
		location: {
			accessPolicy: { visibility: 'public' },
			variant: 'standard',
			mapStyle: 'dark',
			introEyebrow: 'Le espero en Cuautitlán Izcalli',
			introHeading: 'Viernes 13 de noviembre',
			introLede: 'Una noche para celebrar juntos este nuevo capítulo.',
			indicationsHeading: 'Detalles para mis invitados',
			venues: [
				{
					type: 'reception',
					venueEvent: 'Recepción',
					venueName: VENUE_NAME,
					address: VENUE_ADDRESS,
					city: VENUE_CITY,
					date: DESTENID_EVENT.eventDateLong,
					time: '7:00 p. m.',
					googleMapsUrl: MAPS_URL,
				},
			],
			indications: [
				{
					title: 'Confirmación',
					iconName: 'Enveloped',
					styleVariant: 'default',
					text: 'Agradezco que confirme su asistencia con anticipación para preparar cada detalle con cariño.',
				},
				{
					title: 'Puntualidad',
					iconName: 'Calendar',
					styleVariant: 'default',
					text: 'Su puntualidad me ayudará a disfrutar juntos cada momento de esta noche.',
				},
				{
					title: 'Recuerdos',
					iconName: 'Photo',
					styleVariant: 'default',
					text: 'Comparta sus mejores fotos y videos de la fiesta etiquetándome en <a href="https://www.instagram.com/desteny_ts/"><strong>@desteny_ts</strong></a>.',
				},
			],
		},
		gallery: {
			variant: 'magazine-spread',
			variantOptions: {
				mobileBrowse: 'rail',
			},
			eyebrow: 'Galería',
			title: 'Momentos icónicos.',
			subtitle:
				// Client phrase; "Lit" is an interjection, so it gets its exclamation marks.
				'¡Lit! Mi fiesta no sería lo mismo sin ti. Gracias por acompañarme en los momentos más icónicos.',
			items: [
				galleryItem(assets, 'gallery01'),
				galleryItem(assets, 'gallery02'),
				galleryItem(assets, 'gallery03'),
				galleryItem(assets, 'gallery04'),
				galleryItem(assets, 'gallery05'),
				galleryItem(assets, 'gallery06'),
				galleryItem(assets, 'gallery07'),
				galleryItem(assets, 'gallery08'),
				galleryItem(assets, 'gallery09'),
				galleryItem(assets, 'gallery10'),
			],
		},
		gifts: {
			// The client's own words: "lo de la lluvia de sobres o transferencia".
			title: hasTransfer ? 'Lluvia de sobres o transferencia' : 'Lluvia de sobres',
			folioMark: 'D·S',
			subtitle: hasTransfer
				? 'Su presencia es mi mejor regalo, pero si desea tener un detalle conmigo, le comparto estas opciones.'
				: 'Su presencia es mi mejor regalo, pero si desea tener un detalle conmigo, le comparto esta opción.',
			variant: 'editorial-catalog',
			items: [
				{
					type: 'cash',
					title: 'En sobre, el día del evento',
					// The icon replaces the visible card heading so the title is not printed twice.
					iconName: 'Enveloped',
					text: 'Si desea obsequiarme un detalle, podrá hacerlo en sobre el día del evento.',
				},
				...(hasTransfer
					? [
							{
								type: 'bank',
								title: 'Transferencia',
								bankName: 'BBVA',
								accountHolder: GIFT_TRANSFER_HOLDER,
								clabe: GIFT_TRANSFER_CARD,
								accountKind: 'card',
							},
						]
					: []),
			],
		},
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy:
				'Por favor, confirme su asistencia desde esta invitación o enviando un mensaje. ¡Me encantará saber que viene!',
			guestCap: 4,
			accessMode: 'hybrid',
			confirmationMessage:
				'Gracias por confirmar. Me dará mucha alegría compartir esta noche con usted.',
			confirmationMode: 'both',
			variant: 'editorial-press-pass',
			personalizedAccess: {
				variant: 'editorial-pass',
				title: 'Su pase',
				subtitle: 'Hemos reservado estos lugares para usted.',
				footerText: 'Confirme su asistencia en la sección siguiente.',
			},
			labels: {
				name: 'Su nombre',
				notesPlaceholder: 'Escriba unas palabras para Destenid…',
			},
			whatsappConfig: {
				phone: RSVP_WHATSAPP,
			},
		},
		thankYou: {
			message:
				'Gracias por acompañarme a cerrar esta etapa e iniciar la más top de todas. Your presence is the best gift!',
			closingName: CELEBRANT_NAME,
			date: '13 · XI · 2026',
			image: assets.thankYouPortrait,
			focalPoint: '42% 90%',
			variant: 'editorial-back-cover',
		},
		interludes: [
			{
				image: assets.interlude01,
				afterSection: 'family',
				alt: ASSET_ALT.interlude01,
				height: 'medium',
				focalPoint: '50% 52%',
				lightX: '50%',
				lightY: '46%',
			},
		],
		envelope: {
			disabled: false,
			revealVariant: 'editorial-cover',
			// Magazine cover uses its own photograph (WA0034) so the reveal reads differently from the hero.
			backdropImage: assets.portrait,
			// Collector edition: the guest drags the cover open and the page bends.
			coverExperience: 'collector',
			coverEdition: 'XV',
			coverVolume: '1',
			coverIssue: '2026',
			sealStyle: 'wax',
			sealIcon: 'flower',
			sealInitials: 'D·S',
			sealVariant: 'wax-medallion',
			microcopy: 'Abrir invitación',
			documentLabel: 'Edición XV',
			cardLabel: 'Edición XV',
			cardTagline: 'Un nuevo capítulo',
			stampText: 'Destenid',
			stampYear: '2026',
			closedPalette: {
				primary: 'surfaceDark',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		sharing: {
			shareMessages: createShareMessages(
				'Hola {name}, le comparto con mucha ilusión la invitación a mis XV años: {inviteUrl}',
			),
			ogImage: assets.portrait,
			ogDescription:
				'Acompáñeme en mis XV años el viernes 13 de noviembre de 2026, en Cuautitlán Izcalli, Estado de México.',
		},
	};
}

export const destenidInvitation: InvitationDefinition<DestenidAssetKey> = defineInvitation({
	slug: DESTENID_EVENT.slug,
	managedIdentityId: '3389bb9b-c24b-4264-9cd2-fd75327d2d74',
	managedIdentityProvenance: 'persisted',
	createdAt: '2026-09-29T00:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: DESTENID_EVENT.eventType,
	title: DESTENID_EVENT.title,
	clientName: CELEBRANT_NAME,
	hostLoginAlias: 'destenid_sofia',
	clientEmail: '',
	clientWhatsapp: RSVP_WHATSAPP,
	photosReceived: true,
	baseDemoId: DESTENID_EVENT.baseDemoId,
	themeId: DESTENID_EVENT.themeId,
	visualProfileId: DESTENID_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: DESTENID_EVENT.localDateTime,
		timeZone: DESTENID_EVENT.timeZone,
		startsAtUtc: DESTENID_EVENT.startsAtUtc,
	},
	assets: DESTENID_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildDestenidPublishedContent(assets);
	},
});
