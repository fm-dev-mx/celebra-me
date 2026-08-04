/**
 * boda-perla-y-carlos.ts — Managed invitation for Perla Daniela Medina Carrillo
 * & Carlos Martín Ochoa Felipe
 *
 * Base: demo-boda-jewelry-box-wedding / jewelry-box-wedding
 * Prep SoT: docs/invitations/boda-perla-y-carlos.md
 */

import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const PERLA_EVENT = {
	eventType: 'boda',
	slug: 'boda-perla-y-carlos',
	assetSlug: 'boda-perla-y-carlos',
	baseDemoId: 'demo-boda-jewelry-box-wedding',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'boda-perla-y-carlos',
	title: 'Boda de Perla y Carlos',
	localDateTime: '2026-11-28T17:30',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-11-28T23:30:00.000Z',
	heroDate: '2026-11-28T17:30:00.000Z',
} as const;

/** Session: first Maps link = salón; second = iglesia. */
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

const PERLA_INTERLUDE_01 = {
	alt: 'Arco de piedra con flores blancas al atardecer',
	focalPoint: '50% 50%',
} as const;

const PERLA_INTERLUDE_02 = {
	alt: 'Mesa de recepción con flores blancas y luces cálidas',
	focalPoint: '50% 58%',
} as const;

export const PERLA_ASSET_SPECS = [
	{
		key: 'hero-desktop',
		relativePath: 'hero-source.jpg',
		displayName: 'Perla y Carlos — portada',
		alt: 'Perla y Carlos en retrato de sesión',
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
		displayName: 'Perla y Carlos — portada móvil',
		alt: 'Perla y Carlos en retrato de sesión',
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
		displayName: 'Perla y Carlos — galería',
		alt: 'Perla y Carlos en retrato de sesión',
		focalPoint: {
			default: '50% 38%',
		},
	},
	{
		key: 'interlude-01',
		relativePath: 'interlude-01.png',
		displayName: 'Perla y Carlos — interludio de arquitectura',
		alt: PERLA_INTERLUDE_01.alt,
		focalPoint: {
			default: PERLA_INTERLUDE_01.focalPoint,
		},
	},
	{
		key: 'interlude-02',
		relativePath: 'interlude-02.png',
		displayName: 'Perla y Carlos — interludio de recepción',
		alt: PERLA_INTERLUDE_02.alt,
		focalPoint: {
			default: PERLA_INTERLUDE_02.focalPoint,
		},
	},
] as const;

export type PerlaAssetKey = (typeof PERLA_ASSET_SPECS)[number]['key'];
export type PerlaAssetMap = Record<PerlaAssetKey, UploadedAssetRef>;

export function buildPerlaPublishedContent(
	assets: UploadedAssetMap<PerlaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: PERLA_EVENT.eventType,
		isDemo: false,
		templateId: 'boda-jewelry-box-wedding',
		visualProfileId: PERLA_EVENT.visualProfileId,
		title: PERLA_EVENT.title,
		description:
			'Acompáñennos a celebrar la boda de Perla Daniela Medina Carrillo y Carlos Martín Ochoa Felipe el 28 de noviembre de 2026 en Huejutla de Reyes, Hidalgo.',
		theme: { preset: PERLA_EVENT.themeId },
		eventTiming: {
			localDateTime: PERLA_EVENT.localDateTime,
			timeZone: PERLA_EVENT.timeZone,
			startsAtUtc: PERLA_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'quote',
			'countdown',
			'location',
			'family',
			'gallery',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		sectionStyles: {
			location: {
				showFlourishes: true,
				// Map preview is the sole primary map link; the duplicated
				// Apple/Google/Waze/“Cómo llegar” row is suppressed so each
				// venue card exposes exactly two actions.
				showNavigationButtons: false,
			},
		},
		_assetSlug: PERLA_EVENT.assetSlug,
		hero: {
			name: 'Perla',
			secondaryName: 'Carlos',
			label: 'Nuestra boda',
			date: PERLA_EVENT.heroDate,
			backgroundImage: assets['hero-desktop'],
			backgroundImageMobile: assets['hero-mobile'],
			backgroundImageDesktop: assets['hero-desktop'],
			focalPoint: '50% 32%',
			focalPointMobile: '50% 26%',
			focalPointTablet: '50% 30%',
			focalPointDesktop: '50% 32%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'BODA',
			envelopeName: 'Perla & Carlos',
			teaserDetails: '28 · NOV · 2026 · HUEJUTLA',
			cardName: 'Perla',
			cardSecondaryName: 'Carlos',
			guestPlacement: 'outside-envelope',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'P·C',
			documentLabel: 'P & C',
			stampText: 'BODA',
			stampYear: '2026',
			// Seal is the sole [data-envelope-open] control; empty microcopy suppresses the external button.
			microcopy: '',
			tooltipText: 'Toque el sello',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hoy unimos nuestros caminos con gratitud y con la certeza de caminar juntos el resto de la vida.',
			author: 'Perla & Carlos',
		},
		countdown: {
			title: 'Nuestra boda comienza en',
			footerText: 'Huejutla de Reyes, Hidalgo',
		},
		location: {
			visibility: 'public',
			introEyebrow: 'Huejutla de Reyes, Hidalgo',
			introHeading: EVENT_DATE_HEADING,
			introLede:
				'Perla y Carlos celebrarán su enlace con ceremonia religiosa, recepción y ceremonia civil. Será un honor compartir este día con ustedes.',
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
					text: 'Etiqueta formal. Mujeres: vestido largo de noche (evitar blanco, beige o tonos claros). Hombres: traje.',
				},
				{
					iconName: 'Church',
					styleVariant: 'default',
					text: `La ceremonia civil se celebrará en la recepción a las ${CIVIL_TIME}`,
				},
			],
		},
		// Soft guest placeholders until parent names are confirmed (OD5). No invented names.
		family: {
			presentation: 'text-only',
			groups: [
				{
					title: 'Padres de la Novia',
					items: [
						{ name: 'Por confirmar', role: 'Madre' },
						{ name: 'Por confirmar', role: 'Padre' },
					],
				},
				{
					title: 'Padres del Novio',
					items: [
						{ name: 'Por confirmar', role: 'Madre' },
						{ name: 'Por confirmar', role: 'Padre' },
					],
				},
			],
			labels: {
				sectionSubtitle: 'Familia',
				sectionTitle: 'Con la bendición de nuestros padres',
				sectionMessage:
					'Con gratitud honramos a quienes nos han acompañado con amor hasta este día.',
			},
		},
		gallery: {
			eyebrow: 'Retrato',
			title: 'Nuestro comienzo',
			subtitle: 'Una imagen para recordar el inicio de este camino juntos.',
			items: [
				{
					key: 'gallery-01',
					image: assets['gallery-01'],
					alt: 'Perla y Carlos en retrato de sesión',
					focalPoint: '50% 38%',
					layoutRole: 'feature',
					aspectRatio: '2 / 3',
				},
			],
		},
		interludes: [
			{
				image: assets['interlude-01'],
				afterSection: 'countdown',
				alt: PERLA_INTERLUDE_01.alt,
				height: 'screen',
				focalPoint: PERLA_INTERLUDE_01.focalPoint,
			},
			{
				image: assets['interlude-02'],
				afterSection: 'gallery',
				alt: PERLA_INTERLUDE_02.alt,
				height: 'screen',
				focalPoint: PERLA_INTERLUDE_02.focalPoint,
			},
		],
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy:
				'Será un honor recibirles. Les pedimos confirmar su asistencia desde esta invitación.',
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
				title: 'Boda de Perla y Carlos',
				description: `Ceremonia religiosa en Catedral de Cristo Rey (${CEREMONY_TIME}), recepción en Salón El Pedregal (${RECEPTION_TIME}) y ceremonia civil en la recepción (${CIVIL_TIME}). Huejutla de Reyes, Hidalgo.`,
				startsAt: PERLA_EVENT.startsAtUtc,
			},
			personalizedAccess: {
				title: 'Su invitación personal',
				subtitle: 'Esta invitación ha sido preparada para:',
				footerText: 'Confirme su asistencia en el formulario.',
			},
		},
		thankYou: {
			message:
				'Gracias por acompañarnos en un día que recordaremos siempre con el corazón lleno.',
			closingName: 'Perla & Carlos',
			closingPhrase: 'Con cariño',
			date: EVENT_DATE_LONG,
		},
		sharing: {
			ogImage: assets['hero-desktop'],
			ogDescription: 'Invitación a la boda de Perla y Carlos',
			whatsappTemplate:
				'Hola {name}, le compartimos la invitación a la boda de Perla y Carlos: {inviteUrl}',
		},
	};
}

export const perlaInvitation: InvitationDefinition<PerlaAssetKey> = defineInvitation({
	slug: PERLA_EVENT.slug,
	createdAt: '2026-07-31T12:00:00.000Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: PERLA_EVENT.eventType,
	title: PERLA_EVENT.title,
	clientName: 'Daniela Medina',
	hostLoginAlias: 'perla_medina',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: true,
	baseDemoId: PERLA_EVENT.baseDemoId,
	themeId: PERLA_EVENT.themeId,
	visualProfileId: PERLA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: PERLA_EVENT.localDateTime,
		timeZone: PERLA_EVENT.timeZone,
		startsAtUtc: PERLA_EVENT.startsAtUtc,
	},
	assets: PERLA_ASSET_SPECS,
	buildPublishedContent(assets) {
		return buildPerlaPublishedContent(assets);
	},
});
