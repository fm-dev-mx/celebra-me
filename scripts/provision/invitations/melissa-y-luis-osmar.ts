/**
 * melissa-y-luis-osmar.ts — Managed invitation for Melissa & Luis Osmar
 *
 * Base: demo-boda-jewelry-box-wedding / jewelry-box-wedding
 * Prep SoT: docs/invitations/melissa-y-luis-osmar.md
 * prepReadiness: READY_FOR_IMPLEMENTATION
 */

import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import { defineInvitation } from './invitation-definition.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
	UploadedAssetRef,
} from './invitation-definition.ts';

export const MELISSA_EVENT = {
	eventType: 'boda',
	slug: 'melissa-y-luis-osmar',
	assetSlug: 'melissa-y-luis-osmar',
	baseDemoId: 'demo-boda-jewelry-box-wedding',
	themeId: 'jewelry-box-wedding',
	visualProfileId: 'melissa-y-luis-osmar',
	title: 'Boda de Melissa Landell Osuna y Luis Osmar Muñoz Rodríguez',
	localDateTime: '2026-12-16T12:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-12-16T19:00:00.000Z',
	/** Wall-clock ceremony instant encoded as Z for hero schema (eventTiming owns true zone). */
	heroDate: '2026-12-16T12:00:00.000Z',
} as const;

const MELISSA_SCHEDULE = {
	ceremonyTime: '12:00',
	receptionTime: '14:00',
	civilCeremonyTime: '15:00',
} as const;

const EVENT_DATE_LONG = '16 de diciembre de 2026';
const EVENT_DATE_HEADING = 'Miércoles, 16 de diciembre de 2026';
const RSVP_DEADLINE = '16 de noviembre de 2026';

export const MELISSA_ASSET_SPECS = [
	{
		key: 'cathedral-editorial',
		relativePath: 'cathedral-editorial.webp',
		displayName: 'Catedral — interpretación editorial',
		alt: 'Interior editorial de una catedral en tonos marfil con luz natural',
		optimizationRole: 'editorial-featured',
		focalPoint: {
			default: '50% 48%',
			mobile: '50% 48%',
			tablet: '50% 50%',
			desktop: '50% 50%',
		},
	},
	{
		key: 'belcanto-editorial',
		relativePath: 'belcanto-editorial.webp',
		displayName: 'Belcanto Jardín — interpretación editorial',
		alt: 'Jardín para recepción preparado al atardecer con iluminación cálida',
		optimizationRole: 'editorial-featured',
		focalPoint: {
			default: '50% 52%',
			mobile: '50% 52%',
			tablet: '50% 50%',
			desktop: '50% 50%',
		},
	},
] as const;

export type MelissaAssetKey = (typeof MELISSA_ASSET_SPECS)[number]['key'];
export type MelissaAssetMap = Record<MelissaAssetKey, UploadedAssetRef>;

export function buildMelissaPublishedContent(
	assets: UploadedAssetMap<MelissaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: MELISSA_EVENT.eventType,
		isDemo: false,
		templateId: 'boda-jewelry-box-wedding',
		visualProfileId: MELISSA_EVENT.visualProfileId,
		title: MELISSA_EVENT.title,
		description:
			'Invitación a la boda de Melissa y Luis Osmar, el 16 de diciembre de 2026 en Mazatlán, Sinaloa.',
		theme: { preset: MELISSA_EVENT.themeId },
		eventTiming: {
			localDateTime: MELISSA_EVENT.localDateTime,
			timeZone: MELISSA_EVENT.timeZone,
			startsAtUtc: MELISSA_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'quote',
			'countdown',
			'family',
			'location',
			'itinerary',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		composition: {
			intersections: {
				'interlude-after-family': { family: 'overlap', source: 'family' },
				location: { family: 'atmospheric-blend', source: 'interlude-after-family' },
				gifts: { family: 'atmospheric-blend', source: 'interlude-after-itinerary' },
				'personalized-access': { family: 'arch', source: 'gifts' },
			},
		},
		_assetSlug: MELISSA_EVENT.assetSlug,
		hero: {
			name: 'Melissa',
			secondaryName: 'Luis Osmar',
			label: 'Nuestra boda',
			date: MELISSA_EVENT.heroDate,
			variant: 'ceremonial-portrait',
			// The canonical hero schema requires a fallback asset even when the
			// invitation-local presentation intentionally suppresses photography.
			backgroundImage: { type: 'internal', key: 'logo' },
			presentation: { portraitEnabled: false },
		},
		envelope: {
			disabled: false,
			cardLabel: 'BODA',
			envelopeName: 'Melissa & Luis Osmar',
			teaserDetails: '16 · DIC · 2026 · MAZATLÁN',
			cardName: 'Melissa',
			cardSecondaryName: 'Luis Osmar',
			guestPlacement: 'outside-envelope',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'M·L',
			documentLabel: 'M & L',
			stampText: 'BODA',
			stampYear: '2026',
			microcopy: 'Tenemos el honor de invitarle',
			tooltipText: 'Abrir invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Dicen que cuando encuentras a la persona correcta, el corazón lo sabe. Nosotros lo supimos y hoy queremos celebrar nuestro amor rodeados de las personas más importantes en nuestras vidas.',
		},
		countdown: {
			variant: 'clock-face',
			title: 'Comienza la cuenta regresiva',
			footerText: 'Mazatlán, Sinaloa',
		},
		family: {
			presentation: 'text-only',
			variant: 'asymmetric-groups',
			groups: [
				{
					title: 'Familia de Melissa',
					items: [
						{ name: 'Martha Elena Osuna Rubio', role: 'Madre' },
						{ name: 'Rodrigo Landell Osuna', role: 'Padre' },
					],
				},
				{
					title: 'Familia de Luis Osmar',
					items: [
						{ name: 'Martha Leticia Rodríguez Vargas', role: 'Madre' },
						{ name: 'Jesús Gerardo Muñoz Silva', role: 'Padre' },
					],
				},
			],
			godparents: [
				{ name: 'Leonardo Campuzano', role: 'Padrino de matrimonio' },
				{ name: 'María Laura Moraga', role: 'Madrina de matrimonio' },
				{ name: 'Lucina Elsi Morán', role: 'Madrina de velación' },
				{ name: 'Darío Osuna Rubio', role: 'Padrino de velación' },
			],
			labels: {
				sectionSubtitle: 'Nuestras familias',
				sectionTitle: 'Con la bendición de Dios y de nuestros padres',
				godparentsTitle: 'Padrinos',
				sectionMessage: 'Su amor y guía nos acompañan en este día.',
			},
		},
		location: {
			accessPolicy: { visibility: 'public' },
			mapStyle: 'dark',
			variant: 'stacked-venue-plates',
			presentation: 'simple',
			presentationOptions: {
				showFlourishes: true,
				showNavigationButtons: false,
			},
			introEyebrow: 'Mazatlán, Sinaloa',
			introHeading: EVENT_DATE_HEADING,
			introLede:
				'La ceremonia religiosa y la recepción marcarán dos momentos de una misma celebración.',
			venues: [
				{
					type: 'ceremony',
					id: 'ceremony-cathedral',
					venueEvent: 'Ceremonia religiosa',
					venueName: 'Catedral Basílica de la Inmaculada Concepción',
					address: '21 de Marzo s/n, Centro, 82000 Mazatlán, Sinaloa',
					city: 'Mazatlán, Sinaloa',
					date: EVENT_DATE_LONG,
					time: MELISSA_SCHEDULE.ceremonyTime,
				},
				{
					type: 'reception',
					id: 'reception-belcanto',
					venueEvent: 'Recepción y ceremonia civil',
					venueName: 'Belcanto Jardín',
					address: 'Lib. 3 12100, Valle del Ejido, 82129 Mazatlán, Sinaloa',
					city: 'Mazatlán, Sinaloa',
					date: EVENT_DATE_LONG,
					time: MELISSA_SCHEDULE.receptionTime,
				},
			],
			indicationsHeading: 'Consideraciones',
			indications: [
				{
					iconName: 'DressCode',
					styleVariant: 'default',
					text: 'Código de vestimenta: Gala formal.',
				},
				{
					iconName: 'FlowerSeal',
					styleVariant: 'default',
					text: 'Celebración reservada para adultos.',
				},
			],
		},
		itinerary: {
			variant: 'editorial-ledger',
			title: 'Programa del día',
			subtitle: 'Acompáñenos a vivir cada momento de nuestra celebración.',
			items: [
				{
					iconName: 'Church',
					label: 'Ceremonia religiosa',
					time: MELISSA_SCHEDULE.ceremonyTime,
					description: 'Catedral Basílica de la Inmaculada Concepción.',
				},
				{
					iconName: 'Reception',
					label: 'Recepción',
					time: MELISSA_SCHEDULE.receptionTime,
					description: 'Belcanto Jardín.',
				},
				{
					iconName: 'Rings',
					label: 'Ceremonia civil',
					time: MELISSA_SCHEDULE.civilCeremonyTime,
					description: 'Belcanto Jardín.',
				},
			],
		},
		gifts: {
			variant: 'standard',
			title: 'Mesa de regalos',
			subtitle:
				'Su presencia es nuestro mejor regalo. Si desea tener un detalle adicional, agradecemos profundamente su gesto.',
			items: [
				{
					type: 'store',
					title: 'Liverpool',
					description: 'Mesa de Regalos Liverpool',
					tableNumber: '60019030',
					url: 'https://mesaderegalos.liverpool.com.mx/eventodebusqueda',
				},
				{
					type: 'cash',
					title: 'Lluvia de sobres',
					text: 'Podrá entregarnos su obsequio en efectivo dentro de un sobre durante la recepción.',
				},
			],
		},
		interludes: [
			{
				image: assets['cathedral-editorial'],
				afterSection: 'family',
				alt: 'Interior editorial de una catedral en tonos marfil con luz natural',
				height: 'tall',
			},
			{
				image: assets['belcanto-editorial'],
				afterSection: 'itinerary',
				alt: 'Jardín para recepción preparado al atardecer con iluminación cálida',
				height: 'medium',
			},
		],
		rsvp: {
			variant: 'formal-register',
			title: 'Confirme su asistencia',
			subcopy: `Le pedimos registrar su respuesta a más tardar el ${RSVP_DEADLINE}. El número de lugares corresponde al pase asignado.`,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage: 'Su respuesta quedó registrada. Le esperamos.',
			responseMessages: {
				confirmed: {
					title: 'Confirmación recibida, {guestName}.',
					subtitle: 'Su lugar quedó registrado para la celebración.',
				},
				declined: {
					title: 'Registramos su aviso, {guestName}.',
					subtitle: 'Agradecemos que nos lo haya hecho saber.',
				},
			},
			calendar: {
				title: 'Boda de Melissa y Luis Osmar',
				description: `Ceremonia religiosa en la Catedral Basílica de la Inmaculada Concepción (${MELISSA_SCHEDULE.ceremonyTime}) y recepción en Belcanto Jardín (${MELISSA_SCHEDULE.receptionTime}). Mazatlán, Sinaloa.`,
				startsAt: MELISSA_EVENT.startsAtUtc,
			},
			personalizedAccess: {
				variant: 'formal-pass',
				title: 'Su invitación personal',
				noteText:
					'Esta invitación es válida para {count} {personWord}. El número de lugares corresponde al pase asignado.',
				footerText: 'Confirme su asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			variant: 'ceremonial-closing',
			message:
				'Gracias por acompañarnos en el comienzo de esta nueva etapa y por hacer de este día un recuerdo inolvidable.',
			closingName: 'Melissa & Luis Osmar',
			date: EVENT_DATE_LONG,
		},
		sharing: {
			ogImage: assets['cathedral-editorial'],
			ogDescription: 'Invitación a la boda de Melissa y Luis Osmar',
			shareMessages: createShareMessages(
				'Hola {name}, le compartimos la invitación a la boda de Melissa y Luis Osmar: {inviteUrl}',
			),
		},
	};
}

export const melissaInvitation: InvitationDefinition<MelissaAssetKey> = defineInvitation({
	slug: MELISSA_EVENT.slug,
	managedIdentityId: 'e8bf73bf-50df-452c-844e-0889f2a0ae22',
	managedIdentityProvenance: 'owner-approved',
	createdAt: '2026-09-18T20:05:55.937Z',
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
	eventType: MELISSA_EVENT.eventType,
	title: MELISSA_EVENT.title,
	clientName: 'Melissa Landell Osuna',
	hostLoginAlias: 'melissa_landell',
	photosReceived: true,
	baseDemoId: MELISSA_EVENT.baseDemoId,
	themeId: MELISSA_EVENT.themeId,
	visualProfileId: MELISSA_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: MELISSA_EVENT.localDateTime,
		timeZone: MELISSA_EVENT.timeZone,
		startsAtUtc: MELISSA_EVENT.startsAtUtc,
	},
	assets: MELISSA_ASSET_SPECS,
	buildPublishedContent: buildMelissaPublishedContent,
});
