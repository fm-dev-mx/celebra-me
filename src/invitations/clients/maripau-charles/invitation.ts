import { defineCanonicalInvitation } from '../../../../scripts/provision/invitations/canonical-definition.ts';
import { createShareMessages } from '../../../lib/rsvp/services/shared/share-message-defaults.ts';
import type { CanonicalEventContentInput } from '../../../lib/schemas/content/base-event.schema.ts';

/**
 * Owner-authorized local draft. Photographs come from messaging-app sources and stay
 * provisional until the client sends the originals. Music is pending a hosted track.
 */
const TIMING = {
	localDateTime: '2027-01-08T19:00',
	timeZone: 'America/Monterrey',
	startsAtUtc: '2027-01-09T01:00:00.000Z',
} as const;

const CELEBRANT_NAME = 'Maripau';
const CITY = 'Monclova, Coahuila';
const EVENT_DATE_LABEL = '8 de enero de 2027';

const mapsSearch = (query: string): string =>
	`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	description: 'Le invito a celebrar conmigo mis XV años el 8 de enero de 2027.',
	theme: { preset: 'jewelry-box' },
	eventTiming: TIMING,
	sectionOrder: [
		'personalizedAccess',
		'family',
		'gallery',
		'countdown',
		'location',
		'rsvp',
		'gifts',
		'thankYou',
	],
	composition: {
		intersections: {
			rsvp: { family: 'arch', source: 'location' },
			thankYou: { family: 'atmospheric-blend', source: 'gifts' },
		},
	},
	hero: {
		variant: 'framed-portrait',
		name: CELEBRANT_NAME,
		label: 'Mis XV años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2027-01-08T12:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 30%',
		focalPointMobile: '50% 30%',
		presentation: { venueIndex: 0, nameLeadWords: 1 },
		scrollLabel: 'Descubra los detalles',
		ambientVideo: {
			webm: '/videos/maripau-charles/hero-loop.webm',
			mp4: '/videos/maripau-charles/hero-loop.mp4',
			poster: '/videos/maripau-charles/hero-loop-poster.webp',
		},
	},
	envelope: {
		disabled: false,
		variant: 'jewelry-box',
		sealStyle: 'wax',
		sealIcon: 'wax-medallion',
		sealInitials: 'MP',
		cardTagline: 'Viernes 8 de enero de 2027',
		microcopy: 'Toque para abrir la invitación',
		teaserDetails: '8 de enero de 2027 · Monclova',
		openingVideo: {
			webm: '/videos/maripau-charles/opening.webm',
			mp4: '/videos/maripau-charles/opening.mp4',
			poster: '/videos/maripau-charles/poster.webp',
		},
	},
	family: {
		variant: 'ceremonial-family',
		presentation: 'text-only',
		parentsOrder: 'father-first',
		parents: { father: 'Gaspar Charles', mother: 'Paula Montante de Charles' },
		labels: {
			sectionTitle: 'Mi familia',
			sectionSubtitle: '',
			parentsTitle: 'Mis padres',
			fatherRole: '',
			motherRole: '',
			sectionMessage: 'Con la bendición de Dios y el cariño de mis padres.',
		},
	},
	interludes: [
		{
			image: 'interludeSpotlight',
			afterSection: 'countdown',
			alt: 'Maripau recostada en el estudio, sonriendo a la cámara.',
			height: 'tall',
			focalPoint: '50% 45%',
		},
	],
	gallery: {
		variant: 'paired-feature-band',
		eyebrow: 'Sesión de fotos',
		title: 'Retratos de Maripau',
		items: [
			{ image: 'gallery01', alt: 'Maripau de pie con vestido negro de lentejuelas.' },
			{ image: 'gallery03', alt: 'Maripau sentada en una silla de director.' },
			{
				image: 'gallery02',
				layoutRole: 'feature',
				alt: 'Retrato horizontal de Maripau sentada en el estudio.',
			},
			{ image: 'gallery05', alt: 'Maripau de espaldas con vestido rojo bajo un candelabro.' },
			{ image: 'gallery04', alt: 'Maripau recostada en el estudio con atuendo negro.' },
		],
	},
	countdown: {
		variant: 'standard',
		title: 'Falta muy poco',
		footerText: '',
	},
	location: {
		variant: 'stacked-venue-plates',
		accessPolicy: { visibility: 'public' },
		presentationOptions: { showNavigationButtons: true, showFlourishes: false },
		introEyebrow: CITY,
		introHeading: 'Ceremonia y recepción',
		mapStyle: 'dark',
		indicationsHeading: 'Para tomar en cuenta',
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'default',
				text: 'Código de vestimenta: <strong>All black</strong> (todo de negro).',
			},
			{ iconName: 'Forbidden', styleVariant: 'default', text: 'Celebración sin niños.' },
			{
				iconName: 'Calendar',
				styleVariant: 'default',
				text: 'Confirme su asistencia a más tardar el <strong>domingo 20 de diciembre</strong>.',
			},
			{
				iconName: 'MapLocation',
				styleVariant: 'default',
				text: 'Hospedaje sugerido: San Patricio Hotel Estudio, Río de Janeiro 807, Col. Guadalupe. Al reservar mencione el código <strong>Maripau Xv</strong>.',
			},
		],
		venues: [
			{
				type: 'ceremony',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Iglesia Santiago Apóstol',
				address: CITY,
				date: EVENT_DATE_LABEL,
				time: '19:00',
				googleMapsUrl: mapsSearch(`Iglesia Santiago Apóstol, ${CITY}`),
				isVisible: true,
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Marencco',
				address: CITY,
				date: EVENT_DATE_LABEL,
				time: '21:00',
				googleMapsUrl: mapsSearch(`Salón Marencco, ${CITY}`),
				isVisible: true,
			},
		],
	},
	rsvp: {
		variant: 'formal-register',
		title: 'Confirme su asistencia',
		subcopy: 'Le agradeceré confirmar su asistencia a más tardar el domingo 20 de diciembre.',
		guestCap: 1,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'formal-pass',
			ticket: { signature: 'Maripau', monogram: 'MP' },
			title: 'Pase de acceso',
			subtitle: 'Con cariño le espero para celebrar mis XV años.',
		},
		labels: {
			name: 'Su nombre',
			attendance: 'Asistencia',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
			notesLabel: 'Un mensaje para Maripau (opcional)',
			notesPlaceholder: 'Escriba unas palabras para Maripau…',
		},
		confirmationMessage: 'Gracias por confirmar. Me dará mucho gusto celebrar con usted.',
		responseMessages: {
			confirmed: {
				title: 'Gracias por confirmar',
				subtitle: 'Le espero el viernes 8 de enero.',
			},
			declined: {
				title: 'Gracias por avisarme',
				subtitle: 'Lamento que no pueda acompañarme; le tendré presente en este día.',
			},
		},
	},
	gifts: {
		variant: 'standard',
		title: 'Regalos',
		subtitle:
			'Su presencia es mi mejor regalo. Si además desea tener un detalle conmigo, esta es mi sugerencia:',
		items: [{ type: 'cash', title: 'Lluvia de sobres' }],
	},
	thankYou: {
		variant: 'portrait-letter',
		image: 'thankYouPortrait',
		// The cover's mirror-ball room plays its lights over the closing portrait.
		ambientVideo: {
			webm: '/videos/maripau-charles/hero-loop.webm',
			mp4: '/videos/maripau-charles/hero-loop.mp4',
			poster: '/videos/maripau-charles/hero-loop-poster.webp',
		},
		focalPoint: '50% 30%',
		message:
			'Gracias por ser parte de esta noche tan especial. Su compañía hará de mis XV años un recuerdo inolvidable.',
		closingName: CELEBRANT_NAME,
		closingNameLeadWords: 1,
	},
	sharing: {
		ogImage: 'ogShare',
		ogDescription:
			'Le invito a celebrar mis XV años el viernes 8 de enero de 2027 en Monclova.',
		shareMessages: createShareMessages(
			'Hola {{invitado}}: con mucho cariño le compartimos la invitación a los XV años de Maripau.\n\n{{enlace}}\n\nEn ella encontrará los detalles y podrá confirmar su asistencia.',
		),
	},
};

export default defineCanonicalInvitation({
	slug: 'maripau-charles',
	eventType: 'xv',
	title: `Mis XV años — ${CELEBRANT_NAME}`,
	clientName: 'Paula Montante',
	themeId: 'jewelry-box',
	visualProfileId: 'maripau-charles',
	eventTiming: TIMING,
	content,
	managedIdentityId: 'b8645313-9ca2-410f-9dca-5224e6f2f554',
	managedIdentityProvenance: 'owner-approved',
	lifecycle: 'in_progress',
	hostLoginAlias: 'maripau_charles',
	assetDir: 'src/invitations/clients/maripau-charles/assets',
	assetFiles: {
		hero: 'hero.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
		gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp',
		interludeSpotlight: 'interlude-spotlight.webp',
		thankYouPortrait: 'thank-you.webp',
		ogShare: 'og-share.webp',
	},
	deliveryScope: 'content-and-assets',
});
