/**
 * daniela-y-martin.ts — Managed invitation for Perla Daniela Medina Carrillo
 * & Carlos Martín Ochoa Felipe
 *
 * Base: demo-boda-jewelry-box-wedding / jewelry-box-wedding
 * Prep SoT: docs/invitations/daniela-y-martin.md
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const DANIELA_EVENT = {
	eventType: 'boda',
	slug: 'daniela-y-martin',
	assetSlug: 'daniela-y-martin',
	baseDemoId: 'demo-boda-jewelry-box-wedding',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'daniela-y-martin',
	title: 'Boda de Daniela y Martín',
	localDateTime: '2026-11-28T17:30',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-11-28T23:30:00.000Z',
	heroDate: '2026-11-28T17:30:00.000Z',
} as const;

/** Session: first Maps link = iglesia; second = salón. */
const CHURCH_MAPS_URL = 'https://maps.app.goo.gl/tFWKx2UKMoKcvxth8';
const SALON_MAPS_URL = 'https://maps.app.goo.gl/AzBTTezpCmPdUb136';

const ceremonyAddress = 'Sta. Irene, Centro, 43000 Huejutla de Reyes, Hgo.';
const receptionAddress =
	'Avenida Parque Industrial, Col. Tepoztequito s/n, Huejutla de Reyes, Hgo.';

const EVENT_DATE_LONG = '28 de noviembre de 2026';
const EVENT_DATE_HEADING = 'Sábado, 28 de noviembre de 2026';
const CEREMONY_TIME = '5:30 p. m.';
const RECEPTION_TIME = '7:30 p. m.';
const CIVIL_TIME = '8:15 p. m.';

const DANIELA_INTERLUDE_01 = {
	alt: 'Arco de piedra con flores blancas al atardecer',
	focalPoint: '50% 50%',
} as const;

const DANIELA_INTERLUDE_02 = {
	alt: 'Mesa de recepción con flores blancas y luces cálidas',
	focalPoint: '50% 58%',
} as const;

export const DANIELA_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-source.jpg',
		displayName: 'Daniela y Martín — portada',
		alt: 'Daniela y Martín en retrato de sesión',
		focalPoint: {
			default: '50% 32%',
			mobile: '50% 28%',
			tablet: '50% 30%',
			desktop: '50% 32%',
		},
	},
	{
		key: 'hero-mobile',
		// Same physical source as desktop; focals differ per breakpoint.
		relativePath: 'hero-source.jpg',
		displayName: 'Daniela y Martín — portada móvil',
		alt: 'Daniela y Martín en retrato de sesión',
		focalPoint: {
			default: '50% 28%',
			mobile: '50% 26%',
			tablet: '50% 28%',
			desktop: '50% 28%',
		},
	},
	{
		key: 'gallery-01',
		relativePath: 'gallery-01-source.jpg',
		displayName: 'Daniela y Martín — galería',
		alt: 'Daniela y Martín en retrato de sesión',
		focalPoint: {
			default: '50% 38%',
		},
	},
	{
		key: 'interlude-01',
		relativePath: 'interlude-01.png',
		displayName: 'Daniela y Martín — interludio de arquitectura',
		alt: DANIELA_INTERLUDE_01.alt,
		focalPoint: {
			default: DANIELA_INTERLUDE_01.focalPoint,
		},
	},
	{
		key: 'interlude-02',
		relativePath: 'interlude-02.png',
		displayName: 'Daniela y Martín — interludio de recepción',
		alt: DANIELA_INTERLUDE_02.alt,
		focalPoint: {
			default: DANIELA_INTERLUDE_02.focalPoint,
		},
	},
] as const;

export type DanielaAssetKey = (typeof DANIELA_ASSET_SPECS)[number]['key'];
export type DanielaAssetMap = Record<DanielaAssetKey, UploadedAssetRef>;

export function buildDanielaPublishedContent(
	assets: UploadedAssetMap<DanielaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: DANIELA_EVENT.eventType,
		isDemo: false,
		templateId: 'boda-jewelry-box-wedding',
		visualProfileId: DANIELA_EVENT.visualProfileId,
		title: DANIELA_EVENT.title,
		description:
			'Acompáñennos a celebrar la boda de Daniela y Martín el 28 de noviembre de 2026 en Huejutla de Reyes, Hidalgo.',
		theme: { preset: DANIELA_EVENT.themeId },
		eventTiming: {
			localDateTime: DANIELA_EVENT.localDateTime,
			timeZone: DANIELA_EVENT.timeZone,
			startsAtUtc: DANIELA_EVENT.startsAtUtc,
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
			'personalizedAccess',
			'family',
			'gallery',
			'gifts',
			'rsvp',
			'thankYou',
		],
		_assetSlug: DANIELA_EVENT.assetSlug,
		hero: {
			name: 'Daniela',
			secondaryName: 'Martín',
			label: 'Nuestra boda',
			date: DANIELA_EVENT.heroDate,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			structuralVariant: 'standard',
			focalPoint: '50% 32%',
			focalPointMobile: '50% 26%',
			focalPointTablet: '50% 30%',
			focalPointDesktop: '50% 32%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'BODA',
			envelopeName: 'Daniela & Martín',
			teaserDetails: '28 · NOV · 2026 · HUEJUTLA',
			cardName: 'Daniela',
			cardSecondaryName: 'Martín',
			guestPlacement: 'outside-envelope',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'D·M',
			documentLabel: 'D & M',
			stampText: 'BODA',
			stampYear: '2026',
			// Seal is the sole [data-envelope-open] control; empty microcopy suppresses the external button.
			microcopy: '',
			tooltipText: 'Abrir invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hoy elegimos caminar juntos, con gratitud por lo vivido y emoción por todo lo que está por venir.',
			author: 'Daniela & Martín',
		},
		countdown: {
			title: 'Falta poco',
			footerText: 'Huejutla de Reyes, Hidalgo',
		},
		location: {
			visibility: 'public',
			// No coords/image → mediaMode none. With showNavigationButtons=false,
			// VenueCard uses the canonical linked map-preview surface (not a new
			// structural variant or parallel presentation enum).
			presentation: 'simple',
			presentationOptions: {
				showFlourishes: true,
				// Map preview is the sole primary map link; the duplicated
				// Apple/Google/Waze/“Cómo llegar” row is suppressed so each
				// venue card exposes exactly two actions.
				showNavigationButtons: false,
			},
			introEyebrow: 'Huejutla de Reyes, Hidalgo',
			introHeading: EVENT_DATE_HEADING,
			introLede: 'Nos alegrará compartir con ustedes cada momento de esta celebración.',
			// venues[0] drives hero venue/time via page-data (ceremony-first without shared picker changes).
			venues: [
				{
					type: 'ceremony',
					id: 'ceremony-religiosa',
					venueEvent: 'Ceremonia religiosa',
					venueName: 'Catedral de Cristo Rey',
					address: ceremonyAddress,
					city: 'Huejutla de Reyes, Hidalgo',
					date: EVENT_DATE_LONG,
					time: CEREMONY_TIME,
					mapUrl: CHURCH_MAPS_URL,
					googleMapsUrl: CHURCH_MAPS_URL,
				},
				{
					type: 'reception',
					id: 'reception-pedregal',
					venueEvent: 'Recepción',
					venueName: 'Salón El Pedregal',
					address: receptionAddress,
					city: 'Huejutla de Reyes, Hidalgo',
					date: EVENT_DATE_LONG,
					time: RECEPTION_TIME,
					mapUrl: SALON_MAPS_URL,
					googleMapsUrl: SALON_MAPS_URL,
				},
			],
			indicationsHeading: 'Indicaciones',
			indications: [
				{
					iconName: 'DressCode',
					styleVariant: 'default',
					text: 'Etiqueta formal. Mujeres: vestido largo de noche. Evitar blanco, beige y tonos claros. Hombres: traje.',
				},
				{
					iconName: 'Church',
					styleVariant: 'default',
					text: `Se celebrará durante la recepción a las ${CIVIL_TIME}`,
				},
			],
		},
		family: {
			presentation: 'text-only',
			structuralVariant: 'split-groups',
			groups: [
				{
					title: 'De la Novia',
					items: [
						{ name: 'Laura Carrillo Morales', role: 'Madre' },
						{ name: 'Pilar Medina Martínez', role: 'Padre' },
					],
				},
				{
					title: 'Del Novio',
					items: [{ name: 'María de Jesús Felipe Redondo', role: 'Madre' }],
				},
			],
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Con la bendición de quienes nos han acompañado siempre',
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
					alt: 'Daniela y Martín en retrato de sesión',
					focalPoint: '50% 38%',
					aspectRatio: '2 / 3',
				},
			],
		},
		gifts: {
			title: 'Mesa de regalos',
			subtitle:
				'Su presencia es nuestro mejor regalo. Para quienes deseen tener un detalle con nosotros, hemos preparado las siguientes opciones.',
			items: [
				{
					type: 'store',
					title: 'Amazon',
					url: 'https://www.amazon.com.mx/wedding/guest-view/30EX58RGSIPUM',
					description: 'Mesa de regalos de Daniela Medina y Martín Ochoa',
				},
				{
					type: 'cash',
					title: 'Lluvia de sobres',
					text: 'Durante la recepción habrá un buzón disponible para quienes prefieran acompañarnos con un obsequio en sobre.',
				},
			],
		},
		interludes: [
			{
				image: assets['interlude-01'],
				afterSection: 'countdown',
				alt: DANIELA_INTERLUDE_01.alt,
				height: 'screen',
				focalPoint: DANIELA_INTERLUDE_01.focalPoint,
			},
			{
				image: assets['interlude-02'],
				afterSection: 'gifts',
				alt: DANIELA_INTERLUDE_02.alt,
				height: 'screen',
				focalPoint: DANIELA_INTERLUDE_02.focalPoint,
			},
		],
		rsvp: {
			title: '¿Podrán acompañarnos?',
			subcopy:
				'Será un gusto celebrar con ustedes. Les pedimos confirmar su asistencia desde esta invitación.',
			guestCap: 8,
			accessMode: 'hybrid',
			confirmationMode: 'api',
			confirmationMessage: 'Gracias por acompañarnos. Su confirmación quedó registrada.',
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
				title: 'Boda de Daniela y Martín',
				description: `Ceremonia religiosa en Catedral de Cristo Rey (${CEREMONY_TIME}), recepción en Salón El Pedregal (${RECEPTION_TIME}) y ceremonia civil en la recepción (${CIVIL_TIME}). Huejutla de Reyes, Hidalgo.`,
				startsAt: DANIELA_EVENT.startsAtUtc,
			},
			personalizedAccess: {
				structuralVariant: 'ornamented',
				title: 'Su invitación personal',
				noteText:
					'Esta invitación es válida para {count} {personWord}. Por motivos de logística y capacidad, no será posible admitir acompañantes o invitados adicionales.',
				footerText: 'Confirme su asistencia desde esta invitación.',
			},
		},
		thankYou: {
			message:
				'Gracias por compartir con nosotros un día que permanecerá siempre en nuestra memoria.',
			closingName: 'Daniela & Martín',
			date: EVENT_DATE_LONG,
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a la boda de Daniela y Martín',
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación a la boda de Daniela y Martín: {inviteUrl}',
		},
	};
}

export const danielaInvitation: InvitationDefinition<DanielaAssetKey> = defineInvitation({
	slug: DANIELA_EVENT.slug,
	managedIdentityId: '8e4f2a1b-6c3d-4e9f-a0b1-2c3d4e5f6a7b',
	previousSlugs: ['boda-daniela-y-martin'],
	createdAt: '2026-07-31T12:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: DANIELA_EVENT.eventType,
	title: DANIELA_EVENT.title,
	clientName: 'Daniela Medina',
	hostLoginAlias: 'daniela_medina',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: DANIELA_EVENT.baseDemoId,
	themeId: DANIELA_EVENT.themeId,
	visualProfileId: DANIELA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: DANIELA_EVENT.localDateTime,
		timeZone: DANIELA_EVENT.timeZone,
		startsAtUtc: DANIELA_EVENT.startsAtUtc,
	},
	assets: DANIELA_ASSET_SPECS,
	buildPublishedContent: buildDanielaPublishedContent,
});
