/**
 * aithan-darell.ts — Managed invitation definition for Aithan Darell's 3rd birthday
 *
 * Content owner for cumple/aithan-darell. Cars-themed children's party on the editorial-magazine
 * preset, told as a race-day magazine ("Gran Premio"): collector cover, editorial hero, paired
 * portrait gallery, a dark registration chapter and a back cover with a photograph. The first
 * birthday invitation on that preset, backed by the catalog-only base demo
 * `demo-cumple-editorial-magazine`. Variants with an XV edition label baked into their markup
 * (editorial-press-pass, editorial-pass, editorial-catalog) are intentionally not used; the preset
 * folios, palette and display face are remapped through the aithan-darell visual profile.
 *
 * The photographs are messaging-app JPEGs that the owner accepted as the definitive set; the
 * client chose the ride-on car photograph as the main image. Every photograph is published in a
 * single role: the car in the hero portrait (and the off-page share image), the race suit and the
 * jacket in the gallery. The collector cover, the hero canvas and the back-cover trophy are
 * original race motifs (asphalt, checkered flag, race number "3", trophy) rendered as image
 * assets — no third-party artwork; the low-light selfie (chat-052) appears only inside the cover's
 * race roundel. Music is hosted ("Life Is a Highway" by Rascal Flatts).
 */

import { defineCanonicalInvitation } from './canonical-definition.ts';
import { createShareMessages } from '../../../src/lib/rsvp/services/shared/share-message-defaults.ts';
import { deriveStartsAtUtc } from '../../../src/lib/time/event-time.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const TIME_ZONE = 'America/Mexico_City';
// Party start confirmed by the client: 5:30 p. m. ("Hora 5:30" after an earlier 4:30, then
// re-confirmed as p. m.).
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
// Client text: "avenida Juárez 49 Atizapán centro". The municipality and state were only inferred
// from the Maps pin, so they are not printed; the map and the Google Maps button resolve the route.
const VENUE_ADDRESS = 'Avenida Juárez 49, Atizapán centro';
const VENUE_CITY = 'Atizapán';
// Pinned link (Av. Juárez 49, Atizapán Centro).
const MAPS_URL = 'https://maps.app.goo.gl/ebbpWEFK68LhuDm28';

/**
 * Music: the client asked for "Life Is a Highway" (Rascal Flatts). Hosted track on Cloudinary
 * (full track). Client request (2026-10-08): start where the vocals begin (~0:49), entering with a
 * gentle volume ramp instead of cutting in mid-phrase.
 */
const MUSIC_URL =
	'https://res.cloudinary.com/dusxvauvj/video/upload/v1791406894/Rascal_Flatts_-_Life_Is_a_Highway_swt74a.mp3';
const MUSIC_START_SECONDS: number | undefined = 49;
const MUSIC_FADE_IN_SECONDS = 3;

const hasMusic = MUSIC_URL.trim().length > 0;

const content: CanonicalEventContentInput = {
	eventType: AITHAN_EVENT.eventType,
	isDemo: false,
	templateId: 'cumple-editorial-magazine',
	title: AITHAN_EVENT.title,
	description:
		'Invitación al Gran Premio de los 3 años de Aithan Darell: sábado 24 de octubre de 2026 en Jardín de Teresita, Atizapán.',
	theme: { preset: AITHAN_EVENT.themeId, fontFamily: 'serif' },
	eventTiming: {
		localDateTime: AITHAN_EVENT.localDateTime,
		timeZone: AITHAN_EVENT.timeZone,
		startsAtUtc: AITHAN_EVENT.startsAtUtc,
	},
	// Race-day cadence: the cover bleeds into the quote, lane markings lead from the scoreboard into
	// the circuit, the pass overlaps the gallery and a checkered band marks the finish line before
	// the back cover. Remaining boundaries stay neutral.
	composition: {
		intersections: {
			quote: { family: 'atmospheric-blend', source: 'hero' },
			location: { family: 'pattern-band', source: 'countdown' },
			'personalized-access': { family: 'overlap', source: 'gallery' },
			thankYou: { family: 'pattern-band', source: 'rsvp' },
		},
	},
	...(hasMusic
		? {
				music: {
					url: MUSIC_URL,
					title: 'Life Is a Highway',
					autoPlay: true,
					...(MUSIC_START_SECONDS !== undefined ? { startAt: MUSIC_START_SECONDS } : {}),
					fadeInSeconds: MUSIC_FADE_IN_SECONDS,
				},
			}
		: {}),
	sectionOrder: [
		'quote',
		'countdown',
		'location',
		'gifts',
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
		// Asphalt canvas (original motif) behind the copy; the client's chosen photograph (the ride-on
		// car) appears once, in the portrait card (mobile) and panel (desktop).
		backgroundImage: 'heroCanvas',
		portrait: 'heroPortrait',
		// Owner-supplied Cars emblem above the name (the film's own title lock-up order) and McQueen
		// (side view) below the details: the star of the issue appears on the cover and the hero.
		ornament: 'logoCars',
		accentOrnament: { type: 'internal', key: 'characterMcQueen' },
		focalPoint: '50% 50%',
		focalPointMobile: '50% 50%',
		tagline: '¡Arrancan los motores! Acompáñeme a toda velocidad a celebrar mis 3 años.',
		// Age watermark ("3 años") and grid slot instead of the preset's XV folio marks.
		// The brand is named once, on the collector cover masthead: no design credit in the hero.
		presentation: { coverMark: '3 años', coverPage: 'POLE POSITION', designCredit: false },
	},
	quote: {
		text: 'Motores encendidos y casco listo. ¡Acompáñeme a celebrar mis tres años a toda velocidad!',
		author: CELEBRANT_NAME,
	},
	countdown: {
		variant: 'magazine-folio',
		title: 'Faltan para la salida',
		// The scoreboard already prints the full date above; the footer adds only the start time.
		footerText: 'Semáforo de salida · Pits listos para el arranque · 5:30 p. m.',
		// Client-requested character, owner-supplied cutout: Doc Hudson on the starting grid.
		ornament: 'characterDocHudson',
	},
	location: {
		accessPolicy: { visibility: 'public' },
		variant: 'standard',
		mapStyle: 'dark',
		// Indications read as numbered pit boards.
		presentationOptions: { indicationsStyle: 'numbered-board' },
		introEyebrow: 'La ruta de Mack',
		introHeading: 'Sábado, 24 de octubre',
		introLede:
			'El transporte oficial de la escudería nos traslada a la pista. ¡Siga el mapa hasta el circuito!',
		// Client-requested character, owner-supplied cutout: Mack under «La ruta de Mack».
		ornament: 'characterMack',
		indicationsHeading: 'Antes del banderazo',
		venues: [
			{
				type: 'reception',
				venueEvent: 'Gran Premio de cumpleaños',
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
				title: 'Aparte su lugar',
				iconName: 'Enveloped',
				styleVariant: 'default',
				text: 'Confirme su asistencia en el formulario al final de la invitación.',
			},
			{
				title: 'Llegue puntual',
				iconName: 'Calendar',
				styleVariant: 'default',
				text: 'La salida oficial es a las 5:30 p. m. ¡Llegue a tiempo para no perderse el banderazo!',
			},
			{
				// Client dress code, published literally (Cars clarification added 2026-10-08).
				title: 'Código de vestimenta',
				iconName: 'DressCode',
				styleVariant: 'default',
				text: 'Todas las personas en color <strong>rojo, negro y/o blanco</strong>.<br>Nada referente a Cars, no disfraz.',
			},
		],
	},
	// Client request (2026-10-08): a reminder to bring a gift, with no registry or account details.
	// The legend sits under an original gift-on-wheels illustration instead of the envelope glyph.
	gifts: {
		variant: 'standard',
		presentation: 'legend-only',
		ornament: 'giftsOrnament',
		title: '¡No olvide mi regalo!',
		subtitle: 'Haga su parada en los pits con un detalle para el piloto Nº 3.',
	},
	gallery: {
		// Two overlapping prints, each capped at its source's native width.
		variant: 'paired-portraits',
		variantOptions: { arrangement: 'overlap' },
		eyebrow: 'Pits',
		title: 'Listo para arrancar',
		subtitle: 'Así me preparo para mi gran día.',
		items: [
			{
				image: 'gallery01',
				alt: 'Aithan sonríe con su traje de piloto rojo y blanco junto a una pared blanca',
				// Non-breaking space keeps the race number on one line.
				caption: 'Traje oficial del piloto Nº 3',
				focalPoint: '52% 58%',
			},
			{
				image: 'gallery02',
				alt: 'Aithan de espaldas con su chamarra de Mate y Rayo McQueen frente a una pista ilustrada',
				caption: 'Mate en los pits y McQueen en la pista: la mejor escudería',
				focalPoint: '50% 40%',
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		// Owner request (2026-10-08): plain RSVP wording instead of the race "inscripción" metaphor,
		// so guests understand they are confirming attendance.
		title: 'Confirme su asistencia',
		subcopy:
			'El equipo de pits necesita confirmar su lugar en la parrilla de salida. ¿Nos acompaña?',
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMode: 'api',
		confirmationMessage:
			'¡Asistencia confirmada! Nos vemos el sábado 24 de octubre a las 5:30 p. m. en Jardín de Teresita.',
		responseMessages: {
			confirmed: {
				title: '¡Gracias por confirmar su asistencia, {guestName}!',
				subtitle:
					'Su lugar en la tribuna está reservado para el sábado 24 de octubre a las 5:30 p. m.',
			},
			declined: {
				title: 'Lamentamos que no pueda acompañarnos, {guestName}.',
				subtitle: 'Agradecemos que nos haya avisado.',
			},
		},
		personalizedAccess: {
			variant: 'formal-pass',
			// Pit-lane credential: red band with a checkered flag, race-number plate for the seats.
			presentationOptions: { passStyle: 'race-credential' },
			title: 'Su lugar en la tribuna',
			subtitle: 'Toda la escudería le espera en primera fila para apoyar al piloto Aithan.',
			noteText:
				'Pase personal válido para {count} {personWord} · Sábado 24 de octubre de 2026, 5:30 p. m. en Jardín de Teresita.',
			footerText: 'Por favor, confirme su asistencia en el formulario de abajo.',
		},
		labels: {
			name: 'Su nombre',
			attendance: '¿Asistirá a mi fiesta?',
			guestCount: 'Personas que asistirán',
			confirmButton: 'Confirmar asistencia',
			notesPlaceholder: 'Un mensaje para el piloto Aithan…',
		},
	},
	thankYou: {
		variant: 'editorial-back-cover',
		message:
			'Gracias por cruzar la meta conmigo. Con la escudería reunida, ¡su compañía es mi mejor trofeo!',
		closingName: CELEBRANT_NAME,
		date: 'Sábado 24 de octubre de 2026',
		// Original trophy artwork with the race number: the issue closes without repeating a photo.
		image: 'thankYouTrophy',
		// Client-requested character, owner-supplied cutout: Mate at the finish line.
		ornament: 'characterMate',
		focalPoint: '50% 50%',
	},
	envelope: {
		disabled: false,
		revealVariant: 'editorial-cover',
		// Collector edition: the guest drags the cover open; the inner page hands the asphalt
		// canvas to the hero. The cover face is the race motif (paper bands for the masthead,
		// asphalt track, checkered bands) with the low-light selfie (chat-052) brightened inside the
		// race roundel and a "3 años" badge: its only role, small enough to hide the compression.
		coverExperience: 'collector',
		backdropImage: { type: 'internal', key: 'coverGrid' },
		// The edition is the age: the rail prints "3 AÑOS" without the "NÚM." label and the inside
		// cover repeats it as the watermark; the cover falls back to XV when omitted.
		coverEdition: '3 años',
		coverEditionLabel: '',
		// Owner-approved character placement (2026-10-07): McQueen (front view, source cropped on
		// its left, so it enters from the page edge) crosses the cover's lower checkered band left
		// of the roundel; Sally and Ramone wait on the inner page's asphalt.
		coverOrnament: { type: 'internal', key: 'characterMcQueenFront' },
		spreadOrnaments: [
			{ type: 'internal', key: 'characterSally' },
			{ type: 'internal', key: 'characterRamone' },
		],
		coverVolume: '1',
		coverIssue: '2026',
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'A·D',
		microcopy: 'Abrir invitación',
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
			'Hola {name}, le comparto con mucha ilusión la invitación al Gran Premio de los 3 años de Aithan Darell: {inviteUrl}',
		),
		// Off-page share preview: the client's chosen photograph.
		ogImage: 'heroPortrait',
		ogDescription:
			'¡Arrancan motores! Celebre los 3 años de Aithan Darell el sábado 24 de octubre a las 5:30 p. m. en Jardín de Teresita.',
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
	managedIdentityProvenance: 'persisted',
	lifecycle: 'published',
	hostLoginAlias: 'aithan_ruiz',
	assetDir: 'src/assets/invitations/aithan-darell',
	// One binding per source: each photograph has a single visible role; the motif files are
	// original artwork (asphalt canvas, collector cover, trophy).
	assetFiles: {
		heroCanvas: 'hero-canvas.jpg',
		heroPortrait: 'hero.jpg',
		gallery01: 'gallery-01.jpg',
		gallery02: 'gallery-02.jpg',
		coverGrid: 'cover-grid.jpg',
		thankYouTrophy: 'thankyou-trophy.jpg',
		giftsOrnament: 'gifts-ornament.webp',
		// Cars characters requested by the client; owner-supplied artwork, background removed.
		characterMcQueen: 'character-mcqueen.webp',
		characterMack: 'character-mack.webp',
		characterMate: 'character-mate.webp',
		characterDocHudson: 'character-doc-hudson.webp',
		characterSally: 'character-sally.webp',
		characterRamone: 'character-ramone.webp',
		characterMcQueenFront: 'character-mcqueen-front.webp',
		logoCars: 'logo-cars.webp',
	},
	deliveryScope: 'content-and-assets',
});
