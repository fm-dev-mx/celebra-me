import { defineCanonicalInvitation } from './canonical-definition.ts';
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';

const content: CanonicalEventContentInput = {
	composition: {
		intersections: {},
	},
	hero: {
		variant: 'standard',
		date: '2026-08-01T14:00:00.000Z',
		name: 'Luna Yamileth',
		label: 'Primera comunión',
		nickname: '',
		secondaryName: 'Estrella Abigail',
		backgroundImage: 'hero',
		backgroundImageMobile: 'heroMobile',
	},
	rsvp: {
		variant: 'standard',
		title: 'Confirma tu asistencia',
		subcopy: 'Su respuesta nos ayuda a preparar cada detalle de esta celebración de fe.',
		guestCap: 4,
		accessMode: 'personalized-only',
		confirmationMode: 'api',
		personalizedAccess: {
			variant: 'standard',
		},
		responseMessages: {
			declined: {
				title: 'Gracias por avisarnos, {guestName}.',
				subtitle: 'Agradecemos mucho su cariño para Luna y Estrella.',
			},
			confirmed: {
				title: 'Gracias por acompañarnos, {guestName}.',
				subtitle: 'Su confirmación ha sido registrada.',
			},
		},
		confirmationMessage:
			'Gracias por confirmar. Será un honor compartir este día tan especial con ustedes.',
	},
	quote: {
		text: 'Jesús les dijo: "Yo soy el pan de vida; el que a mí viene, nunca tendrá hambre; y el que en mí cree, no tendrá sed jamás."',
		author: 'Juan 6:35',
	},
	theme: {
		preset: 'angelic-presence',
		fontFamily: 'serif',
	},
	title: 'Primera Comunión de Luna y Estrella',
	family: {
		variant: 'standard',
		labels: {
			fatherRole: '-',
			motherRole: '---',
			parentsTitle: 'Nuestros papás',
			sectionTitle: 'Con la bendición de Dios',
			sectionMessage:
				'Con inmensa alegría compartimos este día de fe. Gracias por acompañar a Luna y Estrella con su cariño y sus bendiciones.',
			godparentsTitle: 'Padrinos',
		},
		parents: {
			father: 'Juan Manuel Villa Ponce',
			mother: 'Estefanía Báez Pérez',
		},
		parentsOrder: 'father-first',
		featuredImage: 'family',
		sectionMessage:
			'Con inmensa alegría compartimos este día de fe. Gracias por acompañar a Luna y Estrella con su cariño y sus bendiciones.',
		godparentGroups: [
			{
				label: 'Luna',
				godparents: [
					{
						name: 'Emiliano Pérez Rodríguez',
					},
				],
				honoreeName: 'Luna Yamileth Villa Báez',
			},
			{
				label: 'Estrella',
				godparents: [
					{
						name: 'María Guadalupe Villa Ponce',
					},
				],
				honoreeName: 'Estrella Abigail Villa Báez',
			},
		],
	},
	isDemo: false,
	gallery: {
		items: [],
		title: 'Galería',
		eyebrow: 'Galería',
		variant: 'uniform-grid',
	},
	sharing: {
		ogDescription:
			'Acompáñenos en la Primera Comunión de Luna y Estrella el sábado, 1 de agosto de 2026.',
		shareMessages: {
			reminder:
				'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}',
			invitation:
				'Hola {{invitado}}, te comparto tu invitación a la {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		},
		reminderSettings: {
			enabled: true,
			audience: 'all-shared',
			showWhenDaysBeforeEvent: 7,
		},
	},
	envelope: {
		disabled: false,
		sealIcon: 'flower',
		cardLabel: 'Primera Comunión',
		microcopy: 'Primera Comunión de Luna y Estrella',
		sealStyle: 'wax',
		stampText: 'Luna y Estrella',
		stampYear: '2026',
		cardTagline: 'Una celebración de fe',
		sealInitials: 'L·E',
		documentLabel: 'Primera Comunión',
	},
	location: {
		accessPolicy: { visibility: 'after-rsvp', revealPlacement: 'rsvp' },
		variant: 'standard',
		venues: [
			{
				id: 'celebration',
				city: '',
				date: 'Sábado, 1 de agosto de 2026',
				time: '2:00 PM',
				type: 'reception',
				label: 'Recepción',
				address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
				isVisible: true,
				venueName: 'Salón García',
				venueEvent: 'Recepción',
				googleMapsUrl: 'https://maps.app.goo.gl/nf5EVPk9qvsgP87a6',
			},
		],
		presentationOptions: {},
		introHeading: 'Detalles de la celebración',
		indicationsHeading: '',
		mapStyle: 'dark',
	},
	thankYou: {
		variant: 'standard',
		image: {
			key: 'thankYouPortrait',
			type: 'internal',
		},
		message:
			'Gracias por compartir con nosotras este día de fe. Su presencia y sus bendiciones quedarán guardadas con mucho cariño.',
		focalPoint: '50% 50%',
		closingName: 'Luna y Estrella',
	},
	countdown: {
		variant: 'standard',
		title: 'Nos acercamos con alegría',
		footerText: '-',
	},
	eventType: 'primera-comunion',
	itinerary: {
		variant: 'standard',
		title: 'Itinerario',
		items: [],
	},
	_assetSlug: 'luna-y-estrella-primera-comunion',
	description:
		'Invitación para la Primera Comunión de Luna Yamileth y Estrella Abigail, con una estética blanca, rosa suave, floral y ceremonial.',
	eventTiming: {
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-08-01T20:00:00.000Z',
		localDateTime: '2026-08-01T14:00',
	},
	sectionOrder: ['quote', 'family', 'countdown', 'personalizedAccess', 'rsvp', 'thankYou'],
};

export const lunaInvitation = defineCanonicalInvitation({
	slug: 'luna-y-estrella',
	eventType: 'primera-comunion',
	title: 'Primera Comunión de Luna y Estrella',
	baseDemoId: 'demo-primera-comunion-illustrated',
	themeId: 'angelic-presence',
	visualProfileId: 'luna-y-estrella',
	eventTiming: {
		localDateTime: '2026-08-01T14:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-08-01T20:00:00.000Z',
	},
	content,
	managedIdentityId: '7870cfca-bb65-4bbc-a178-e2c508a33662',
	managedIdentityProvenance: 'owner-approved',
	hostLoginAlias: 'luna_y_estrella',
	assetDir: 'src/assets/images/events/luna-y-estrella-primera-comunion',
	assetFiles: {
		hero: 'hero.webp',
		heroMobile: 'hero.webp',
		family: 'family.webp',
		thankYouPortrait: 'thank-you.webp',
	},
	deliveryScope: 'content-only',
});
