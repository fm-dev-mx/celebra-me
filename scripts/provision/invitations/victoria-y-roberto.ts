/**
 * victoria-y-roberto.ts — Managed invitation for Victoria & Roberto
 *
 * Base: demo-boda-jewelry-box-wedding / jewelry-box-wedding
 * Prep SoT: docs/invitations/victoria-y-roberto.md
 * prepReadiness: READY_WITH_PLACEHOLDERS (non-blocking map/time tokens preserved)
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const VICTORIA_EVENT = {
	eventType: 'boda',
	slug: 'victoria-y-roberto',
	assetSlug: 'victoria-y-roberto',
	baseDemoId: 'demo-boda-jewelry-box-wedding',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'victoria-y-roberto',
	title: 'Boda de Victoria y Roberto',
	localDateTime: '2026-10-30T19:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-10-31T02:00:00.000Z',
	/** Wall-clock ceremony instant encoded as Z for hero schema (eventTiming owns true zone). */
	heroDate: '2026-10-30T19:00:00.000Z',
} as const;

/** Canonical unresolved preparation tokens — do not invent replacements. */
export const VICTORIA_PLACEHOLDERS = {
	ceremonyMapUrl: '[[PENDIENTE:CEREMONY_MAP_URL]]',
	receptionMapUrl: '[[PENDIENTE:RECEPTION_MAP_URL]]',
	dinnerTime: '[[PENDIENTE:DINNER_TIME]]',
	toastTime: '[[PENDIENTE:TOAST_TIME]]',
	closingTime: '[[PENDIENTE:CLOSING_TIME]]',
} as const;

const ceremonyAddress = 'Lic. Benito Juárez S/N, Mochicahui, 81257 Los Mochis, Sin.';
const receptionAddress = 'Carretera Mochis - Topo Km8';

const EVENT_DATE_LONG = '30 de octubre de 2026';
const EVENT_DATE_HEADING = 'Viernes, 30 de octubre de 2026';
const CEREMONY_TIME = '19:00';
const RECEPTION_TIME = '21:00';

const VICTORIA_INTERLUDE_01 = {
	alt: 'Victoria y Roberto en un momento íntimo sobre un puente de madera',
	// Narrow-safe default; responsive refinements live in the visual profile.
	focalPoint: '42% 34%',
} as const;

const VICTORIA_INTERLUDE_02 = {
	alt: 'Victoria y Roberto frente a frente en una terraza con luz suave',
	// Couple sits slightly right; keep faces readable under tall cover crops.
	focalPoint: '56% 38%',
} as const;

export const VICTORIA_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-desktop.webp',
		displayName: 'Victoria y Roberto — portada',
		alt: 'Victoria y Roberto en retrato de sesión al aire libre',
		focalPoint: {
			default: '50% 34%',
			mobile: '46% 32%',
			tablet: '50% 34%',
			desktop: '50% 36%',
		},
	},
	{
		key: 'hero-mobile',
		relativePath: 'hero-mobile.webp',
		displayName: 'Victoria y Roberto — portada móvil',
		alt: 'Victoria y Roberto en retrato de sesión al aire libre',
		focalPoint: {
			default: '46% 32%',
			mobile: '46% 32%',
			tablet: '50% 34%',
			desktop: '50% 36%',
		},
	},
	{
		key: 'gallery-01',
		relativePath: 'gallery-01.webp',
		displayName: 'Victoria y Roberto — galería',
		alt: 'Victoria y Roberto en un abrazo editorial en blanco y negro',
		focalPoint: {
			default: '50% 40%',
		},
	},
	{
		key: 'interlude-01',
		relativePath: 'interlude01.webp',
		displayName: 'Victoria y Roberto — interludio uno',
		alt: VICTORIA_INTERLUDE_01.alt,
		focalPoint: {
			default: VICTORIA_INTERLUDE_01.focalPoint,
		},
	},
	{
		key: 'interlude-02',
		relativePath: 'interlude02.webp',
		displayName: 'Victoria y Roberto — interludio dos',
		alt: VICTORIA_INTERLUDE_02.alt,
		focalPoint: {
			default: VICTORIA_INTERLUDE_02.focalPoint,
		},
	},
	{
		key: 'thank-you',
		relativePath: 'thank-you.webp',
		displayName: 'Victoria y Roberto — cierre',
		alt: 'Victoria y Roberto en un retrato arquitectónico de sesión',
		focalPoint: {
			default: '42% 38%',
		},
	},
] as const;

export type VictoriaAssetKey = (typeof VICTORIA_ASSET_SPECS)[number]['key'];
export type VictoriaAssetMap = Record<VictoriaAssetKey, UploadedAssetRef>;

export function buildVictoriaPublishedContent(
	assets: UploadedAssetMap<VictoriaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: VICTORIA_EVENT.eventType,
		isDemo: false,
		templateId: 'boda-jewelry-box-wedding',
		visualProfileId: VICTORIA_EVENT.visualProfileId,
		title: VICTORIA_EVENT.title,
		description:
			'Invitación a la boda de Victoria y Roberto el 30 de octubre de 2026 en Los Mochis, Sinaloa.',
		theme: { preset: VICTORIA_EVENT.themeId },
		eventTiming: {
			localDateTime: VICTORIA_EVENT.localDateTime,
			timeZone: VICTORIA_EVENT.timeZone,
			startsAtUtc: VICTORIA_EVENT.startsAtUtc,
		},
		sectionStyles: {
			gifts: { structuralVariant: 'standard' },
			rsvp: { structuralVariant: 'standard' },
			thankYou: { structuralVariant: 'standard' },
		},
		sectionOrder: [
			'quote',
			'countdown',
			'location',
			'itinerary',
			'family',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		_assetSlug: VICTORIA_EVENT.assetSlug,
		hero: {
			name: 'Victoria',
			secondaryName: 'Roberto',
			label: 'Nuestra boda',
			date: VICTORIA_EVENT.heroDate,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			structuralVariant: 'standard',
			focalPoint: '50% 34%',
			focalPointMobile: '46% 32%',
			focalPointTablet: '50% 34%',
			focalPointDesktop: '50% 36%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'BODA',
			envelopeName: 'Victoria & Roberto',
			teaserDetails: '30 · OCT · 2026 · LOS MOCHIS',
			cardName: 'Victoria',
			cardSecondaryName: 'Roberto',
			guestPlacement: 'outside-envelope',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'V·R',
			documentLabel: 'V & R',
			stampText: 'BODA',
			stampYear: '2026',
			microcopy: '',
			tooltipText: 'Abrir invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Mejores son dos que uno, porque tienen mejor paga de su trabajo. Porque si cayeren, el uno levantará a su compañero.',
			author: 'Eclesiastés 4:9–12',
		},
		countdown: {
			title: 'Falta poco',
			footerText: 'Los Mochis, Sinaloa',
		},
		location: {
			visibility: 'public',
			presentationOptions: {
				showFlourishes: true,
				showNavigationButtons: false,
			},
			introEyebrow: 'Los Mochis, Sinaloa',
			introHeading: EVENT_DATE_HEADING,
			introLede:
				'Los esperamos para unir dos momentos: la ceremonia en Mochicahui y la recepción en Eventos Platinum LM.',
			venues: [
				{
					type: 'ceremony',
					id: 'ceremony-santo-nino',
					venueEvent: 'Ceremonia religiosa',
					venueName: 'Parroquia Santo Niño',
					address: ceremonyAddress,
					city: 'Los Mochis, Sinaloa',
					date: EVENT_DATE_LONG,
					time: CEREMONY_TIME,
					googleMapsUrl: VICTORIA_PLACEHOLDERS.ceremonyMapUrl,
				},
				{
					type: 'reception',
					id: 'reception-platinum',
					venueEvent: 'Recepción',
					venueName: 'Eventos Platinum LM',
					address: receptionAddress,
					city: 'Los Mochis, Sinaloa',
					date: EVENT_DATE_LONG,
					time: RECEPTION_TIME,
					googleMapsUrl: VICTORIA_PLACEHOLDERS.receptionMapUrl,
				},
			],
			indicationsHeading: 'Indicaciones',
			indications: [
				{
					iconName: 'DressCode',
					styleVariant: 'default',
					text: 'Código de vestimenta: formal.',
				},
			],
		},
		itinerary: {
			title: 'Orden del día',
			subtitle: 'Una secuencia sencilla para orientar la tarde y la noche.',
			presentation: {
				behavior: 'standard',
			},
			items: [
				{
					iconName: 'Church',
					label: 'Ceremonia religiosa',
					time: CEREMONY_TIME,
					description: 'Parroquia Santo Niño.',
				},
				{
					iconName: 'Reception',
					label: 'Recepción',
					time: RECEPTION_TIME,
					description: 'Eventos Platinum LM.',
				},
				{
					iconName: 'Dinner',
					label: 'Cena',
					time: VICTORIA_PLACEHOLDERS.dinnerTime,
				},
				{
					iconName: 'Toast',
					label: 'Brindis',
					time: VICTORIA_PLACEHOLDERS.toastTime,
				},
				{
					iconName: 'Party',
					label: 'Cierre de celebración',
					time: VICTORIA_PLACEHOLDERS.closingTime,
				},
			],
		},
		family: {
			presentation: 'text-only',
			structuralVariant: 'split-groups',
			groups: [
				{
					title: 'Padres de Victoria',
					items: [
						{ name: 'Argelia Valdez', role: 'Madre' },
						{ name: 'Victor Armenta', role: 'Padre' },
					],
				},
				{
					title: 'Padres de Roberto',
					items: [
						{ name: 'Socorro Palomares', role: 'Madre' },
						{ name: 'Nicolas Luviano', role: 'Padre' },
					],
				},
			],
			godparents: [
				{ name: 'Eric Montes', role: 'Padrino' },
				{ name: 'Rosario Soto', role: 'Madrina' },
			],
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Con la bendición de nuestros padres y padrinos',
				godparentsTitle: 'Padrinos',
			},
		},
		gallery: {
			variant: 'single-keepsake',
			eyebrow: 'Retrato',
			title: '',
			items: [
				{
					key: 'gallery-01',
					image: assets['gallery-01'],
					alt: 'Victoria y Roberto en un abrazo editorial en blanco y negro',
					focalPoint: '50% 40%',
					layoutRole: 'feature',
					aspectRatio: '2 / 3',
				},
			],
		},
		gifts: {
			title: 'Detalle de invitados',
			subtitle:
				'Su presencia llena la mesa. Si desean tener un gesto adicional, habrá un espacio para lluvia de sobres durante la recepción.',
			items: [
				{
					type: 'cash',
					title: 'Lluvia de sobres',
					text: 'Pueden depositar su obsequio en sobre el día de la recepción.',
				},
			],
		},
		interludes: [
			{
				image: assets['interlude-01'],
				afterSection: 'countdown',
				alt: VICTORIA_INTERLUDE_01.alt,
				// Editorial pause — not a full-viewport chapter break.
				// Responsive focals live in the visual profile (omit content
				// focalPoint so the motion coordinator does not pin a single
				// inline --interlude-focal-point).
				height: 'tall',
			},
			{
				image: assets['interlude-02'],
				afterSection: 'gifts',
				alt: VICTORIA_INTERLUDE_02.alt,
				// Quieter second beat; profile CSS calibrates coverage + crop.
				height: 'medium',
			},
		],
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy:
				'Les pedimos registrar su respuesta desde esta invitación para preparar cada lugar con cuidado.',
			accessMode: 'hybrid',
			confirmationMode: 'api',
			confirmationMessage: 'Su respuesta quedó registrada. Los esperamos.',
			responseMessages: {
				confirmed: {
					title: 'Confirmación recibida, {guestName}.',
					subtitle: 'Quedó registrado su lugar en la celebración.',
				},
				declined: {
					title: 'Registramos su aviso, {guestName}.',
					subtitle: 'Agradecemos que nos lo haya hecho saber.',
				},
			},
			calendar: {
				title: 'Boda de Victoria y Roberto',
				description: `Ceremonia religiosa en Parroquia Santo Niño (${CEREMONY_TIME}) y recepción en Eventos Platinum LM (${RECEPTION_TIME}). Los Mochis, Sinaloa.`,
				startsAt: VICTORIA_EVENT.startsAtUtc,
			},
			personalizedAccess: {
				structuralVariant: 'standard',
				title: 'Su invitación personal',
				noteText:
					'Esta invitación es válida para {count} {personWord}. Por organización del evento, no será posible admitir personas adicionales.',
				footerText: 'Confirme su asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			message:
				'Guardaremos con cariño el gesto de haber estado presentes en el comienzo de esta etapa juntos.',
			closingName: 'Victoria & Roberto',
			date: EVENT_DATE_LONG,
			image: assets['thank-you'],
			focalPoint: '42% 38%',
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a la boda de Victoria y Roberto',
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación a la boda de Victoria y Roberto: {inviteUrl}',
		},
	};
}

export const victoriaInvitation: InvitationDefinition<VictoriaAssetKey> = defineInvitation({
	slug: VICTORIA_EVENT.slug,
	managedIdentityId: 'c4e8a1d2-7f3b-4a9e-8b2c-1d5e6f7a8b9c',
	createdAt: '2026-08-08T04:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: VICTORIA_EVENT.eventType,
	title: VICTORIA_EVENT.title,
	clientName: 'Victoria Armenta',
	hostLoginAlias: 'victoria_armenta',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: VICTORIA_EVENT.baseDemoId,
	themeId: VICTORIA_EVENT.themeId,
	visualProfileId: VICTORIA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: VICTORIA_EVENT.localDateTime,
		timeZone: VICTORIA_EVENT.timeZone,
		startsAtUtc: VICTORIA_EVENT.startsAtUtc,
	},
	assets: VICTORIA_ASSET_SPECS,
	buildPublishedContent: buildVictoriaPublishedContent,
});
