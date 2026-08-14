/**
 * renata.ts — Managed XV invitation for Renata
 *
 * Base: demo-xv-editorial / editorial
 * Prep SoT: docs/invitations/renata.md
 * prepReadiness: NOT_READY (RSVP mode and guest cap unresolved)
 */

import { deriveStartsAtUtc } from '../../../src/lib/time/event-time.ts';
import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

const TIME_ZONE = 'America/Mazatlan';
const RECEPTION_LOCAL = '2026-09-05T19:00';
const derivedStartsAtUtc = deriveStartsAtUtc(RECEPTION_LOCAL, TIME_ZONE);
if (!derivedStartsAtUtc) {
	throw new Error('Renata eventTiming.startsAtUtc could not be derived from America/Mazatlan.');
}

export const RENATA_EVENT = {
	eventType: 'xv',
	slug: 'renata',
	assetSlug: 'renata',
	baseDemoId: 'demo-xv-editorial',
	themeId: 'editorial',
	visualProfileId: 'renata',
	title: 'XV años de Renata',
	localDateTime: RECEPTION_LOCAL,
	timeZone: TIME_ZONE,
	startsAtUtc: derivedStartsAtUtc,
	/**
	 * Hero.astro formats hero.date with timeZone: 'UTC'. Keep a wall-clock Z
	 * instant so the visible date stays 5 de septiembre. eventTiming owns the
	 * real Mazatlán instant. Shared defect reported in the Goal 2 handoff.
	 */
	heroDate: '2026-09-05T19:00:00.000Z',
} as const;

const EVENT_DATE_LONG = '5 de septiembre de 2026';
const CEREMONY_ADDRESS = 'Blvd. Pedro Infante 2550, Los Álamos, Culiacán';
const RECEPTION_ADDRESS = 'Blvd. José Limón 910 Nte., Tres Ríos, Culiacán';
const CEREMONY_MAP_URL = 'https://maps.app.goo.gl/AS7ufXbUyZdyJJU4A';
const RECEPTION_MAP_URL = 'https://maps.app.goo.gl/yzDo1Azex7AfmyGX8';

export const RENATA_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-source.jpg',
		displayName: 'Renata — portada',
		alt: 'Renata de pie con vestido negro y lentes al pecho, frente a un muro verde',
		focalPoint: {
			default: '50% 40%',
			mobile: '50% 42%',
			tablet: '50% 40%',
			desktop: '50% 38%',
		},
	},
	{
		key: 'hero-mobile',
		relativePath: 'hero-source.jpg',
		displayName: 'Renata — portada móvil',
		alt: 'Renata de pie con vestido negro y lentes al pecho, frente a un muro verde',
		focalPoint: {
			default: '50% 42%',
			mobile: '50% 42%',
			tablet: '50% 40%',
			desktop: '50% 38%',
		},
	},
	{
		key: 'gallery-feature',
		relativePath: 'gallery-feature-source.jpg',
		displayName: 'Renata — galería principal',
		alt: 'Renata con vestido amarillo bajo un arco de flores',
		focalPoint: {
			default: '50% 28%',
			mobile: '50% 26%',
			desktop: '50% 30%',
		},
	},
	{
		key: 'gallery-01',
		relativePath: 'gallery-01-source.jpg',
		displayName: 'Renata — galería sofá',
		alt: 'Renata sentada en un sofá floral con vestido negro',
		focalPoint: {
			default: '48% 36%',
		},
	},
	{
		key: 'gallery-02',
		relativePath: 'gallery-02-source.jpg',
		displayName: 'Renata — galería sakura',
		alt: 'Renata de pie con vestido amarillo y ramo, frente a flores claras',
		focalPoint: {
			default: '50% 30%',
		},
	},
	{
		key: 'gallery-03',
		relativePath: 'gallery-03-source.jpg',
		displayName: 'Renata — galería editorial',
		alt: 'Renata en retrato editorial de vestido negro',
		focalPoint: {
			default: '50% 34%',
		},
	},
	{
		key: 'gallery-04',
		relativePath: 'gallery-04-source.jpg',
		displayName: 'Renata — galería estudio',
		alt: 'Renata en retrato de estudio con vestido amarillo',
		focalPoint: {
			default: '50% 32%',
		},
	},
	{
		key: 'interlude',
		relativePath: 'interlude-source.jpg',
		displayName: 'Renata — interludio',
		alt: 'Renata recostada con vestido amarillo en un estudio floral',
		focalPoint: {
			default: '32% 52%',
			mobile: '32% 52%',
			desktop: '38% 48%',
		},
	},
	{
		key: 'interlude-02',
		relativePath: 'interlude-02-source.jpg',
		displayName: 'Renata — segundo interludio',
		alt: 'Renata sentada con vestido amarillo entre arreglos florales',
		focalPoint: {
			default: '50% 30%',
			mobile: '50% 32%',
			desktop: '50% 28%',
		},
	},
	{
		key: 'thank-you',
		relativePath: 'thank-you-source.jpg',
		displayName: 'Renata — cierre',
		alt: 'Renata recostada en un sofá floral con vestido negro',
		focalPoint: {
			default: '46% 22%',
			mobile: '48% 36%',
			desktop: '46% 22%',
		},
	},
] as const;

export type RenataAssetKey = (typeof RENATA_ASSET_SPECS)[number]['key'];
export type RenataAssetMap = Record<RenataAssetKey, UploadedAssetRef>;

export function buildRenataPublishedContent(
	assets: UploadedAssetMap<RenataAssetKey>,
): Record<string, unknown> {
	return {
		eventType: RENATA_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-editorial',
		visualProfileId: RENATA_EVENT.visualProfileId,
		title: RENATA_EVENT.title,
		description: 'Invitación a los XV años de Renata el 5 de septiembre de 2026 en Culiacán.',
		theme: { preset: RENATA_EVENT.themeId },
		eventTiming: {
			localDateTime: RENATA_EVENT.localDateTime,
			timeZone: RENATA_EVENT.timeZone,
			startsAtUtc: RENATA_EVENT.startsAtUtc,
		},
		sectionOrder: [
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
				family: { family: 'atmospheric-blend', source: 'hero' },
				'interlude-after-location': { family: 'overlap', source: 'location' },
			},
		},
		_assetSlug: RENATA_EVENT.assetSlug,
		hero: {
			name: 'Renata',
			label: 'CELEBRO MIS XV',
			date: RENATA_EVENT.heroDate,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			variant: 'standard',
			presentation: { portraitEnabled: false },
			focalPoint: '50% 40%',
			focalPointMobile: '50% 42%',
			focalPointTablet: '50% 40%',
			focalPointDesktop: '50% 38%',
		},
		envelope: {
			disabled: false,
			variant: 'premiere-floral',
			cardLabel: 'MIS XV',
			envelopeName: 'Renata',
			cardName: 'Renata',
			cardTagline: '05 · 09 · 2026',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'R',
			microcopy: 'Abra su invitación',
		},
		family: {
			variant: 'asymmetric-groups',
			presentation: 'text-only',
			parents: {
				father: 'Ramón Arturo Sainz Quevedo',
				mother: 'Dulce Patricia Echevarria Espinoza',
			},
			parentsOrder: 'father-first',
			godparents: [
				{ name: 'Saul Chaidez García' },
				{ name: 'Yuliana Argelia González Beltrán' },
			],
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Quienes acompañan este día',
				parentsTitle: 'Con el amor de mis padres',
				godparentsTitle: 'Mis padrinos',
				sectionMessage: 'Su presencia sostiene cada instante de esta celebración.',
			},
		},
		countdown: {
			title: 'El día se acerca',
			footerText: 'Misa a las 5:00 p. m. · Recepción a las 7:00 p. m.',
		},
		location: {
			variant: 'stacked-venue-plates',
			visibility: 'public',
			presentation: 'simple',
			presentationOptions: {
				showFlourishes: false,
				showNavigationButtons: false,
			},
			indicationsHeading: 'Indicaciones',
			introEyebrow: 'SÁBADO · 5 DE SEPTIEMBRE DE 2026',
			introHeading: 'Misa y recepción',
			ceremony: {
				venueEvent: 'Misa',
				venueName: 'Parroquia Santa Inés',
				address: CEREMONY_ADDRESS,
				city: 'Culiacán, Sinaloa',
				date: EVENT_DATE_LONG,
				time: '5:00 p. m.',
				mapUrl: CEREMONY_MAP_URL,
				googleMapsUrl: CEREMONY_MAP_URL,
			},
			reception: {
				venueEvent: 'Recepción',
				venueName: 'InHouse Select · Hacienda Tres Ríos',
				address: RECEPTION_ADDRESS,
				city: 'Culiacán, Sinaloa',
				date: EVENT_DATE_LONG,
				time: '7:00 p. m.',
				mapUrl: RECEPTION_MAP_URL,
				googleMapsUrl: RECEPTION_MAP_URL,
			},
			indications: [
				{
					text: 'Código de vestimenta: formal.',
					iconName: 'DressCode',
					styleVariant: 'default',
				},
				{
					text: 'Se pide no vestir de color rosa.',
					iconName: 'Crown',
					styleVariant: 'default',
				},
			],
		},
		interludes: [
			{
				image: assets.interlude,
				afterSection: 'location',
				alt: 'Renata recostada con vestido amarillo en un estudio floral',
				height: 'tall',
				focalPoint: '32% 52%',
				focalPointDesktop: '38% 48%',
			},
			{
				image: assets['interlude-02'],
				afterSection: 'gallery',
				alt: 'Renata sentada con vestido amarillo entre arreglos florales',
				height: 'tall',
				focalPoint: '50% 32%',
				focalPointDesktop: '50% 28%',
			},
		],
		itinerary: {
			variant: 'editorial-program',
			title: 'Momentos',
			items: [
				{
					time: '5:00 p. m.',
					label: 'Misa',
					description: 'Nos reunimos para dar gracias al inicio de esta fecha.',
					iconName: 'Church',
				},
				{
					time: '7:00 p. m.',
					label: 'Recepción',
					description: 'Continuamos la celebración en Hacienda Tres Ríos.',
					iconName: 'Reception',
				},
				{
					time: 'Por confirmar',
					label: 'Vals',
					description: 'El primer baile de esta noche.',
					iconName: 'Waltz',
				},
				{
					time: 'Por confirmar',
					label: 'Cena',
					description: 'Compartimos la mesa para continuar la celebración.',
					iconName: 'Dinner',
				},
				{
					time: 'Por confirmar',
					label: 'Cierre',
					description: 'Cerramos la fiesta con los últimos momentos juntos.',
					iconName: 'Party',
				},
			],
		},
		gifts: {
			variant: 'standard',
			title: 'Lluvia de sobres',
			subtitle:
				'Su compañía es el centro de esta noche. Si desea tener un detalle, la celebración recibirá una lluvia de sobres.',
			items: [
				{
					type: 'cash',
					title: 'Lluvia de sobres',
					text: 'El detalle se recibirá en efectivo durante la recepción.',
				},
			],
		},
		gallery: {
			eyebrow: 'Sesión',
			title: 'Renata',
			subtitle: 'Una noche que ya comenzó a escribirse',
			variant: 'paired-feature-band',
			items: [
				{
					key: 'gallery-01',
					image: assets['gallery-01'],
					alt: 'Renata sentada en un sofá floral con vestido negro',
					focalPoint: '48% 36%',
				},
				{
					key: 'gallery-02',
					image: assets['gallery-02'],
					alt: 'Renata de pie con vestido amarillo y ramo, frente a flores claras',
					focalPoint: '50% 30%',
				},
				{
					key: 'gallery-feature',
					layoutRole: 'feature',
					image: assets['gallery-feature'],
					alt: 'Renata con vestido amarillo bajo un arco de flores',
					focalPoint: '50% 28%',
					focalPointMobile: '50% 26%',
					focalPointDesktop: '50% 30%',
				},
				{
					key: 'gallery-03',
					image: assets['gallery-03'],
					alt: 'Renata en retrato editorial de vestido negro',
					focalPoint: '50% 34%',
				},
				{
					key: 'gallery-04',
					image: assets['gallery-04'],
					alt: 'Renata en retrato de estudio con vestido amarillo',
					focalPoint: '50% 32%',
				},
			],
		},
		rsvp: {
			variant: 'standard',
			title: 'Confirme su asistencia',
			subcopy: 'Pronto podrá reservar su lugar para el 5 de septiembre.',
			personalizedAccess: {
				variant: 'standard',
				title: 'Su invitación personal',
				subtitle: 'Esta invitación ha sido preparada para:',
				footerText: 'La confirmación se habilitará cuando el anfitrión complete los datos.',
			},
			responseMessages: {
				confirmed: {
					title: 'Gracias por confirmar, {guestName}.',
					subtitle: 'Su asistencia ha quedado registrada.',
				},
				declined: {
					title: 'Lamentamos que no pueda acompañarnos, {guestName}.',
					subtitle: 'Gracias por avisarnos.',
				},
			},
			calendar: {
				title: 'XV de Renata',
				description:
					'Recepción de los XV años de Renata. InHouse Select Hacienda Tres Ríos, Culiacán. Inicia a las 7:00 p. m.',
				startsAt: RENATA_EVENT.startsAtUtc,
			},
		},
		thankYou: {
			variant: 'full-bleed-photo',
			message: 'Gracias por acompañar este día.',
			closingName: 'Renata',
			date: EVENT_DATE_LONG,
			image: assets['thank-you'],
			focalPoint: '46% 22%',
			overlayAnchor: 'left',
			overlaySafeArea: {
				x: 0.36,
				y: 0.16,
				width: 0.5,
				height: 0.58,
			},
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a los XV años de Renata',
			shareMessages: {
				invitation:
					'Hola. Le compartimos la invitación a los XV años de Renata.\n\nÁbrala para ver los detalles.',
				reminder:
					'Hola. Le recordamos la invitación a los XV años de Renata el 5 de septiembre.',
			},
		},
	};
}

export const renataInvitation: InvitationDefinition<RenataAssetKey> = defineInvitation({
	slug: RENATA_EVENT.slug,
	managedIdentityId: '0d10598f-5007-486f-a36e-4e0acabfe640',
	createdAt: '2026-08-14T00:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: RENATA_EVENT.eventType,
	title: RENATA_EVENT.title,
	clientName: 'Renata',
	hostLoginAlias: 'renata',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: RENATA_EVENT.baseDemoId,
	themeId: RENATA_EVENT.themeId,
	visualProfileId: RENATA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: RENATA_EVENT.localDateTime,
		timeZone: RENATA_EVENT.timeZone,
		startsAtUtc: RENATA_EVENT.startsAtUtc,
	},
	assets: RENATA_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildRenataPublishedContent(assets);
	},
});
