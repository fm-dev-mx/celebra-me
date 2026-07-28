/**
 * alba-rosa-quinones.ts — Managed invitation definition for Alba Rosa Quiñones López (70 años)
 *
 * Base: demo-cumple-luxury-hacienda / luxury-hacienda
 * Prep SoT: docs/invitations/alba-rosa-quinones.md
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const ALBA_EVENT = {
	eventType: 'cumple',
	slug: 'alba-rosa-quinones',
	assetSlug: 'alba-rosa-quinones',
	baseDemoId: 'demo-cumple-luxury-hacienda',
	themeId: 'luxury-hacienda',
	visualProfileId: 'alba-rosa-quinones',
	title: '70 años de Alba Rosa Quiñones López',
	localDateTime: '2026-09-11T20:00',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-09-12T02:00:00.000Z',
	// Hero dates are formatted as floating event-local values in UTC.
	heroDate: '2026-09-11T20:00:00.000Z',
} as const;

const venueAddress = 'Supermanzana km 6, Los Mochis, Sinaloa';
const mapsSearchUrl =
	'https://www.google.com/maps/search/?api=1&query=Canta+Luna+Campestre+Supermanzana+km+6+Los+Mochis+Sinaloa';

const giftsLegend =
	'Mi mejor regalo es tu presencia, pero si deseas tener un detalle conmigo, puedes hacerlo dentro de un sobre.';

export const ALBA_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-desktop.webp',
		displayName: 'Alba Rosa — portada desktop',
		alt: 'Alba Rosa sentada en un jardín con vestido azul',
		focalPoint: {
			default: '68% 42%',
			mobile: '50% 28%',
			tablet: '62% 40%',
			desktop: '72% 42%',
		},
	},
	{
		key: 'hero-mobile',
		relativePath: 'hero-mobile.webp',
		displayName: 'Alba Rosa — portada móvil',
		alt: 'Alba Rosa sentada en un jardín, retrato vertical',
		focalPoint: {
			default: '50% 26%',
			mobile: '50% 26%',
			tablet: '50% 28%',
			desktop: '50% 28%',
		},
	},
	{
		key: 'thank-you',
		relativePath: 'thank-you.webp',
		displayName: 'Alba Rosa — agradecimiento',
		alt: 'Alba Rosa en una terraza de café con una copa',
		focalPoint: {
			default: '48% 22%',
		},
	},
	{
		key: 'family',
		relativePath: 'family.webp',
		displayName: 'Alba Rosa — familia',
		alt: 'Alba Rosa junto a su familia bajo un arco',
		focalPoint: {
			default: '50% 58%',
		},
	},
	{
		key: 'gallery-01-paris',
		relativePath: 'gallery-01-paris.webp',
		displayName: 'Alba Rosa — París',
		alt: 'Alba Rosa frente a la Torre Eiffel',
		focalPoint: {
			default: '35% 40%',
		},
	},
	{
		key: 'gallery-02-london',
		relativePath: 'gallery-02-london.webp',
		displayName: 'Alba Rosa — Londres',
		alt: 'Alba Rosa junto a una cabina telefónica roja en Londres',
		focalPoint: {
			default: '42% 38%',
		},
	},
	{
		key: 'gallery-03-nyc-holiday',
		relativePath: 'gallery-03-nyc-holiday.webp',
		displayName: 'Alba Rosa — Nueva York',
		alt: 'Alba Rosa en una plaza iluminada de Nueva York',
		focalPoint: {
			default: '50% 32%',
		},
	},
	{
		key: 'gallery-05-albert',
		relativePath: 'gallery-05-albert.webp',
		displayName: 'Alba Rosa — Albert Memorial',
		alt: 'Alba Rosa frente al Albert Memorial en Londres',
		focalPoint: {
			default: '55% 55%',
		},
	},
] as const;

export type AlbaAssetKey = (typeof ALBA_ASSET_SPECS)[number]['key'];
export type AlbaAssetMap = Record<AlbaAssetKey, UploadedAssetRef>;

export function buildAlbaPublishedContent(
	assets: UploadedAssetMap<AlbaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: ALBA_EVENT.eventType,
		isDemo: false,
		templateId: 'cumple-luxury-hacienda',
		visualProfileId: ALBA_EVENT.visualProfileId,
		title: ALBA_EVENT.title,
		description:
			'Acompáñenos a celebrar los 70 años de Alba Rosa Quiñones López el 11 de septiembre de 2026 en Canta Luna Campestre, Los Mochis.',
		theme: { preset: ALBA_EVENT.themeId },
		eventTiming: {
			localDateTime: ALBA_EVENT.localDateTime,
			timeZone: ALBA_EVENT.timeZone,
			startsAtUtc: ALBA_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'location',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'family',
			'thankYou',
		],
		interludes: [
			{
				afterSection: 'location',
				image: assets['gallery-01-paris'],
				alt: 'Alba Rosa frente a la Torre Eiffel en París',
				height: 'tall',
				focalPoint: '35% 40%',
			},
		],
		sectionStyles: {
			location: {
				showFlourishes: false,
			},
			rsvp: {},
			thankYou: {
				variant: 'editorial-magazine',
			},
		},
		_assetSlug: ALBA_EVENT.assetSlug,
		hero: {
			name: 'Alba Rosa Quiñones López',
			label: '70 Años',
			// Occasion line only — time/venue live in Location (Hero stays person → occasion → date).
			nickname: 'Una noche para celebrar su vida',
			date: ALBA_EVENT.heroDate,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			focalPoint: '68% 42%',
			focalPointMobile: '50% 26%',
			focalPointTablet: '62% 40%',
			focalPointDesktop: '72% 42%',
		},
		envelope: {
			disabled: false,
			cardLabel: '70 AÑOS',
			envelopeName: 'Alba Rosa Quiñones López',
			cardName: 'Alba Rosa',
			sealStyle: 'monogram',
			sealIcon: 'monogram',
			sealInitials: 'A·R',
			microcopy: 'Toque el sello para abrir la invitación',
			tooltipText: 'Abrir la invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		// Required by eventContentSchema; intentionally omitted from sectionOrder for simplicity.
		quote: {
			text: 'La vida se celebra con gratitud, con los seres queridos y con el corazón en paz.',
			author: 'Alba Rosa',
		},
		location: {
			visibility: 'public',
			introEyebrow: 'VIERNES · 11 DE SEPTIEMBRE DE 2026',
			introHeading: 'Los esperamos',
			reception: {
				venueEvent: 'Celebración',
				venueName: 'Canta Luna Campestre',
				address: venueAddress,
				city: 'Los Mochis, Sinaloa',
				date: '11 de septiembre de 2026',
				time: '8:00 p. m.',
				mapUrl: mapsSearchUrl,
				googleMapsUrl: mapsSearchUrl,
				appleMapsUrl: 'https://maps.apple.com/?q=Canta+Luna+Campestre+Los+Mochis+Sinaloa',
			},
			indications: [
				{
					iconName: 'DressCode',
					styleVariant: 'default',
					text: 'Código de vestimenta: Formal',
				},
			],
		},
		gallery: {
			eyebrow: 'Recuerdos',
			title: 'Momentos',
			subtitle: 'Viajes, sonrisas y cariño',
			items: [
				{
					key: 'gallery-02-london',
					image: assets['gallery-02-london'],
					alt: 'Alba Rosa junto a una cabina telefónica roja en Londres',
					focalPoint: '42% 38%',
					layoutRole: 'feature',
					aspectRatio: '3 / 4',
				},
				{
					key: 'gallery-03-nyc-holiday',
					image: assets['gallery-03-nyc-holiday'],
					alt: 'Alba Rosa en una plaza iluminada de Nueva York',
					focalPoint: '50% 28%',
					layoutRole: 'standard',
					aspectRatio: '4 / 5',
				},
				{
					key: 'gallery-05-albert',
					image: assets['gallery-05-albert'],
					alt: 'Alba Rosa frente al Albert Memorial en Londres',
					focalPoint: '55% 55%',
					layoutRole: 'wide',
					aspectRatio: '5 / 4',
				},
			],
		},
		gifts: {
			title: 'Regalos',
			subtitle: giftsLegend,
			// Cash stub retained for schema stability; profile hides card UI (legend-only presentation).
			items: [
				{
					type: 'cash',
					title: 'Un detalle',
				},
			],
		},
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy: 'Su confirmación nos ayuda a recibirlo con cariño.',
			guestCap: 6,
			accessMode: 'hybrid',
			confirmationMode: 'api',
			confirmationMessage:
				'Su confirmación quedó registrada. Será un honor contar con su presencia.',
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
				title: '70 años de Alba Rosa',
				description:
					'Celebración de los 70 años de Alba Rosa Quiñones López. Canta Luna Campestre, Supermanzana km 6, Los Mochis, Sinaloa. Inicia a las 8:00 p. m.',
				startsAt: ALBA_EVENT.startsAtUtc,
			},
			personalizedAccess: {
				title: 'Su invitación personal',
				subtitle: 'Esta invitación ha sido preparada para:',
				footerText: 'Confirme su asistencia en el formulario.',
			},
		},
		family: {
			presentation: 'with-photo',
			featuredImage: assets.family,
			focalPoint: '50% 58%',
			labels: {
				sectionSubtitle: '',
				sectionTitle: '',
				sectionMessage: 'El corazón de esta celebración es mi familia.',
			},
		},
		thankYou: {
			message:
				'Gracias por acompañarme en esta celebración. Su presencia hará de esta noche un recuerdo inolvidable.',
			closingName: 'Alba Rosa',
			closingPhrase: 'Con cariño',
			date: '11 de septiembre de 2026',
			image: assets['thank-you'],
			// Tighter face-forward crop for intimate finale (not a second Hero).
			focalPoint: '48% 22%',
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a los 70 años de Alba Rosa Quiñones López',
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación para los 70 años de Alba Rosa: {inviteUrl}',
		},
	};
}

export const albaInvitation: InvitationDefinition<AlbaAssetKey> = defineInvitation({
	slug: ALBA_EVENT.slug,
	createdAt: '2026-07-28T12:00:00.000Z',
	eventType: ALBA_EVENT.eventType,
	title: ALBA_EVENT.title,
	clientName: 'Lucero Ramírez',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: ALBA_EVENT.baseDemoId,
	themeId: ALBA_EVENT.themeId,
	visualProfileId: ALBA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: ALBA_EVENT.localDateTime,
		timeZone: ALBA_EVENT.timeZone,
		startsAtUtc: ALBA_EVENT.startsAtUtc,
	},
	assets: ALBA_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildAlbaPublishedContent(assets);
	},
});
