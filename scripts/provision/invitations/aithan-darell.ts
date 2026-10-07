/**
 * aithan-darell.ts — Managed invitation definition for Aithan Darell's 3rd birthday
 *
 * Content owner for cumple/aithan-darell. Cars-themed children's party on the editorial-magazine
 * preset (ink, paper, racing red): the first birthday invitation on that preset, backed by the
 * catalog-only base demo `demo-cumple-editorial-magazine`. Variants with an XV edition label baked
 * into their markup (editorial-press-pass, editorial-pass, editorial-catalog) are intentionally not
 * used; the preset folios are relabelled through the aithan-darell visual profile.
 *
 * The four photographs are messaging-app JPEGs that the owner accepted as the definitive set; the
 * client chose the ride-on car photograph as the main image. Music is omitted until the owner hosts
 * the requested track ("Life Is a Highway").
 */

import { defineCanonicalInvitation } from './canonical-definition.ts';
import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import { deriveStartsAtUtc } from '../../../src/lib/time/event-time.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const TIME_ZONE = 'America/Mexico_City';
// Party start confirmed by the client ("Hora 5:30" after an earlier 4:30).
const PARTY_LOCAL = '2026-10-24T17:30';
const derivedStartsAtUtc = deriveStartsAtUtc(PARTY_LOCAL, TIME_ZONE);
if (!derivedStartsAtUtc) {
	throw new Error(
		'Aithan eventTiming.startsAtUtc could not be derived from America/Mexico_City.',
	);
}

export const AITHAN_EVENT = {
	eventType: 'cumple',
	slug: 'aithan-darell',
	baseDemoId: 'demo-cumple-editorial-magazine',
	themeId: 'editorial-magazine',
	visualProfileId: 'aithan-darell',
	title: 'Mis 3 años — Aithan Darell',
	localDateTime: PARTY_LOCAL,
	timeZone: TIME_ZONE,
	startsAtUtc: derivedStartsAtUtc,
	/**
	 * The editorial cover formats hero.date with timeZone 'UTC'. Keep a wall-clock Z instant so the
	 * visible time stays 5:30 p. m.; eventTiming owns the real instant.
	 */
	heroDate: '2026-10-24T17:30:00.000Z',
	eventDateLong: 'sábado 24 de octubre de 2026',
} as const;

const CELEBRANT_NAME = 'Aithan Darell';
const VENUE_NAME = 'Jardín de Teresita';
// Client text: "avenida Juárez 49 Atizapán centro"; the municipality follows from the Maps pin.
const VENUE_ADDRESS = 'Avenida Juárez 49, Atizapán centro, Atizapán de Zaragoza, Estado de México';
const VENUE_CITY = 'Atizapán de Zaragoza, Estado de México';
const MAPS_URL = 'https://maps.app.goo.gl/HZDDjkjo8QrPrD5Y9';

const content: CanonicalEventContentInput = {
	eventType: AITHAN_EVENT.eventType,
	isDemo: false,
	templateId: 'cumple-editorial-magazine',
	title: AITHAN_EVENT.title,
	description:
		'Invitación para celebrar los 3 años de Aithan Darell el sábado 24 de octubre de 2026 en Atizapán, Estado de México.',
	theme: { preset: AITHAN_EVENT.themeId, fontFamily: 'serif' },
	eventTiming: {
		localDateTime: AITHAN_EVENT.localDateTime,
		timeZone: AITHAN_EVENT.timeZone,
		startsAtUtc: AITHAN_EVENT.startsAtUtc,
	},
	composition: { intersections: {} },
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'gallery',
		'personalizedAccess',
		'rsvp',
		'thankYou',
	],
	hero: {
		variant: 'editorial-cover',
		name: CELEBRANT_NAME,
		label: 'Mis 3 años',
		date: AITHAN_EVENT.heroDate,
		backgroundImage: 'hero',
		// The client's chosen photograph (the ride-on car) leads both the cover and the desktop card.
		portrait: 'heroPortrait',
		focalPoint: '50% 55%',
		focalPointMobile: '50% 50%',
		tagline: 'Tres años a toda velocidad.',
		// Race-number watermark and page rail instead of the preset's XV folio marks.
		presentation: { coverMark: '3', coverPage: 'PÁG. 3' },
	},
	quote: {
		text: 'La pista está lista y los motores encendidos. Acompáñeme a celebrar mis primeros tres años.',
		author: CELEBRANT_NAME,
	},
	countdown: {
		variant: 'magazine-folio',
		title: 'La carrera comienza en',
		footerText: 'Jardín de Teresita, Atizapán',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		mapStyle: 'dark',
		introEyebrow: 'Le espero en Atizapán',
		introHeading: 'Sábado, 24 de octubre',
		introLede: 'Una tarde de carreras, pastel y diversión.',
		indicationsHeading: 'Detalles para mis invitados',
		venues: [
			{
				type: 'reception',
				venueEvent: 'Fiesta de cumpleaños',
				venueName: VENUE_NAME,
				address: VENUE_ADDRESS,
				city: VENUE_CITY,
				date: AITHAN_EVENT.eventDateLong,
				time: '5:30 p. m.',
				googleMapsUrl: MAPS_URL,
				isVisible: true,
			},
		],
		indications: [
			{
				title: 'Confirmación',
				iconName: 'Enveloped',
				styleVariant: 'default',
				text: 'Le agradecemos confirmar su asistencia con anticipación para preparar cada detalle.',
			},
			{
				title: 'Puntualidad',
				iconName: 'Calendar',
				styleVariant: 'default',
				text: 'La fiesta arranca a las 5:30 p. m. Su puntualidad nos ayudará a disfrutar juntos cada momento.',
			},
		],
	},
	gallery: {
		variant: 'feature-stack',
		eyebrow: 'Galería',
		title: 'Mi equipo de carreras',
		subtitle: 'Listo para la pista.',
		items: [
			{
				image: 'gallery01',
				alt: 'Aithan sonriendo con su traje de piloto rojo junto a una pared blanca',
			},
			{
				image: 'gallery02',
				alt: 'Aithan de espaldas con su chamarra de Mate y Rayo McQueen frente a una pista ilustrada',
			},
			{
				image: 'gallery03',
				alt: 'Aithan sonriendo con su chamarra roja y blanca',
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		title: 'Confirme su asistencia',
		subcopy:
			'Nos encantará contar con usted en la pista. Puede responder aquí mismo y dejarnos un mensaje.',
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		confirmationMessage: 'Gracias por confirmar. Nos dará mucha alegría celebrar con usted.',
		personalizedAccess: {
			variant: 'formal-pass',
			title: 'Su pase',
			subtitle: 'Hemos reservado estos lugares para usted.',
			footerText: 'Confirme su asistencia en la sección siguiente.',
		},
		labels: {
			name: 'Su nombre',
			notesPlaceholder: 'Escriba unas palabras para Aithan…',
		},
	},
	thankYou: {
		variant: 'editorial-back-cover',
		message:
			'Gracias por acompañarme en esta carrera tan especial. Su presencia es el mejor regalo.',
		closingName: CELEBRANT_NAME,
		date: '24 · X · 2026',
	},
	envelope: {
		disabled: false,
		revealVariant: 'editorial-cover',
		// Explicit edition label: the cover falls back to an XV mark when it is omitted.
		coverEdition: '3 años',
		coverVolume: '1',
		coverIssue: '2026',
		coverLines: ['Una tarde de carreras', 'Retrato de un piloto'],
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'A·D',
		microcopy: 'Abrir invitación',
		documentLabel: 'Edición 3 años',
		cardLabel: 'Mis 3 años',
		cardTagline: 'Una fiesta a toda velocidad',
		stampText: 'Aithan Darell',
		stampYear: '2026',
		closedPalette: {
			primary: 'surfaceDark',
			accent: 'actionAccent',
			background: 'surfaceDark',
		},
	},
	sharing: {
		shareMessages: createShareMessages(
			'Hola {name}, le comparto con mucha ilusión la invitación a los 3 años de Aithan Darell: {inviteUrl}',
		),
		ogImage: 'hero',
		ogDescription:
			'Acompáñenos a celebrar los 3 años de Aithan Darell el sábado 24 de octubre de 2026 en Atizapán, Estado de México.',
	},
};

export const aithanInvitation = defineCanonicalInvitation({
	slug: AITHAN_EVENT.slug,
	eventType: AITHAN_EVENT.eventType,
	title: AITHAN_EVENT.title,
	clientName: 'Alin Salgado',
	baseDemoId: AITHAN_EVENT.baseDemoId,
	themeId: AITHAN_EVENT.themeId,
	visualProfileId: AITHAN_EVENT.visualProfileId,
	eventTiming: {
		localDateTime: AITHAN_EVENT.localDateTime,
		timeZone: AITHAN_EVENT.timeZone,
		startsAtUtc: AITHAN_EVENT.startsAtUtc,
	},
	content,
	managedIdentityId: 'ff2c91a0-5fe5-4260-aef6-8c61da963fd6',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'aithan_ruiz',
	assetDir: 'src/assets/invitations/aithan-darell',
	assetFiles: {
		hero: 'hero.jpg',
		// Same source as the cover under its own key so each delivery role keeps a single binding.
		heroPortrait: 'hero.jpg',
		gallery01: 'gallery-01.jpg',
		gallery02: 'gallery-02.jpg',
		gallery03: 'gallery-03.jpg',
	},
	deliveryScope: 'content-and-assets',
});
