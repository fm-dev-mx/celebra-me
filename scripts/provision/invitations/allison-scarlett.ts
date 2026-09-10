import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

/** Owner-authorized local draft. Venue, guest cap and time zone remain provisional. */
export const ALLISON_TIMING = {
	localDateTime: '2026-11-27T18:00',
	timeZone: 'America/Mexico_City',
	startsAtUtc: '2026-11-28T00:00:00.000Z',
} as const;

const content: CanonicalEventContentInput = {
	eventType: 'xv',
	isDemo: false,
	templateId: 'xv-celestial-blue',
	title: 'Mis XV años — Allison Scarlett',
	description: 'Una noche para soñar, una vida para recordar. Celebre conmigo mis XV años.',
	theme: { preset: 'celestial-blue', fontFamily: 'serif' },
	eventTiming: ALLISON_TIMING,
	sectionOrder: [
		'family',
		'personalizedAccess',
		'countdown',
		'location',
		'gallery',
		'gifts',
		'rsvp',
		'thankYou',
	],
	composition: {
		intersections: {
			family: { family: 'arch', source: 'hero' },
			gallery: { family: 'atmospheric-blend', source: 'location' },
			thankYou: { family: 'arch', source: 'rsvp' },
		},
	},
	hero: {
		variant: 'ceremonial-portrait',
		ornament: { type: 'internal', key: 'carriage' },
		accentOrnament: { type: 'internal', key: 'slipper' },
		ambience: { type: 'internal', key: 'ambience' },
		name: 'Allison Scarlett',
		label: 'Mis XV años',
		// Hero formats its display date in UTC; eventTiming owns the real instant.
		date: '2026-11-27T18:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 50%',
		presentation: { venueIndex: 0, portraitEnabled: false },
	},
	envelope: {
		revealVariant: 'satin-filigree',
		sealImage: { type: 'internal', key: 'seal' },
		backdropImage: { type: 'internal', key: 'ambience' },
		teaserDetails: '',
		sealStyle: 'monogram',
		sealIcon: 'monogram',
		sealInitials: 'AS',
		envelopeName: 'Allison Scarlett',
		cardName: 'Allison Scarlett',
		cardLabel: 'MIS XV AÑOS',
		cardTagline: '',
		microcopy: 'Abra su invitación',
	},
	family: {
		variant: 'ceremonial-family',
		presentation: 'text-only',
		parents: { father: 'Edgar Juarez', mother: 'Erika Mejia' },
		godparents: [{ name: 'Geovanny Castillo' }, { name: 'Sherly Velazquez' }],
		labels: {
			sectionTitle: 'Un sueño compartido',
			sectionSubtitle: 'Con el amor de mi familia',
			parentsTitle: 'Mis papás',
			godparentsTitle: 'Mis padrinos',
			sectionMessage:
				'Hoy comienza un nuevo capítulo. Me hará muy feliz compartir esta noche con usted.',
		},
	},
	countdown: {
		variant: 'clock-face',
		title: 'La magia está por comenzar',
		footerText: '',
	},
	location: {
		variant: 'standard',
		presentation: 'simple',
		introHeading: 'Una noche para recordar',
		introLede: 'La ceremonia y la recepción se celebrarán en el mismo lugar.',
		venues: [
			{
				type: 'ceremony',
				label: 'Ceremonia y recepción',
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Salón Jardín Luigi',
				address: '[[PENDIENTE:VENUE_ADDRESS]]',
				city: 'Ciudad de México — provisional',
				date: '27 de noviembre de 2026',
				time: '6:00 p. m.',
				mapUrl: 'https://maps.app.goo.gl/N4W3Dz8kQi6b3bPy6?g_st=aw',
			},
			{
				type: 'reception',
				venueEvent: 'Recepción',
				venueName: 'Salón Jardín Luigi',
				address: '[[PENDIENTE:VENUE_ADDRESS]]',
				city: 'Ciudad de México — provisional',
				date: '27 de noviembre de 2026',
				time: '7:00 p. m. — provisional',
				mapUrl: 'https://maps.app.goo.gl/N4W3Dz8kQi6b3bPy6?g_st=aw',
			},
		],
		indications: [
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				text: 'El <strong>azul y el plata</strong> están reservados para la quinceañera. Gracias por elegir otros colores para su atuendo.',
			},
		],
	},
	gallery: {
		variant: 'paired-portraits',
		title: 'Instantes de ilusión',
		eyebrow: 'ALLISON SCARLETT',
		items: [
			{
				image: 'gallery01',
				alt: 'Allison de perfil con su ramo de rosas azules',
				caption: 'La ilusión de este momento.',
			},
			{
				image: 'gallery02',
				alt: 'Allison con vestido azul, vista de espalda y rostro de perfil',
				caption: 'Un recuerdo para siempre.',
			},
		],
	},
	gifts: {
		variant: 'standard',
		title: 'Detalles con cariño',
		subtitle:
			'Su presencia es mi mejor regalo. Si desea tener un detalle conmigo, me encantan Hello Kitty, el maquillaje, las bolsas y los productos de cuidado de la piel.',
		items: [
			{
				type: 'cash',
				title: 'Lluvia de sobres',
				text: 'También puede acompañar sus buenos deseos con un sobre el día de la celebración.',
			},
		],
	},
	rsvp: {
		variant: 'standard',
		title: '¿Me acompaña a celebrar?',
		subcopy: 'Borrador local: los pases y los datos pendientes son provisionales.',
		guestCap: 2,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'formal-pass',
			title: 'Su pase al baile',
			subtitle: 'Este pase indica los lugares reservados para usted.',
			footerText: 'Confirme su asistencia al final de la invitación.',
			noteText: 'Conserve su invitación personal.',
		},
		labels: {
			name: 'Su nombre',
			attendance: 'Asistencia',
			guestCount: 'Número de asistentes',
			confirmButton: 'Confirmar asistencia',
		},
		confirmationMessage: 'Gracias por acompañarme en esta noche tan especial.',
	},
	thankYou: {
		variant: 'ceremonial-closing',
		image: { type: 'internal', key: 'closingCarriage' },
		message: 'El mejor recuerdo será compartirlo con usted.',
		closingName: 'Allison Scarlett',
	},
};

export const allisonInvitation = defineCanonicalInvitation({
	slug: 'allison-scarlett',
	eventType: 'xv',
	title: 'Mis XV años — Allison Scarlett',
	clientName: 'Erika Mejia',
	baseDemoId: 'demo-xv-celestial-blue',
	themeId: 'celestial-blue',
	visualProfileId: 'allison-scarlett',
	eventTiming: ALLISON_TIMING,
	content,
	managedIdentityId: '8f64e9a4-fcbe-436a-8630-62e18fcafdf7',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'allison_scarlett',
	assetDir: 'src/assets/invitations/allison-scarlett',
	assetFiles: {
		carriage: 'carriage-delivery.webp',
		closingCarriage: 'carriage-delivery.webp',
		seal: 'seal-delivery.webp',
		ambience: 'palace-ambience.webp',
		slipper: 'slipper-delivery.webp',
		hero: 'hero.webp',
		gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp',
	},
	lifecycle: 'in_progress',
	deliveryScope: 'content-and-assets',
});
