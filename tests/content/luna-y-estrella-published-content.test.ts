import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

export const lunaYEstrellaContent = {
	eventType: 'primera-comunion',
	isDemo: false,
	title: 'Primera Comunión de Luna y Estrella',
	description:
		'Invitación para la Primera Comunión de Luna Yamileth y Estrella Abigail, con una estética blanca, rosa suave, floral y ceremonial.',
	_assetSlug: 'luna-y-estrella-primera-comunion',
	theme: {
		fontFamily: 'serif',
		preset: 'angelic-presence',
	},
	eventTiming: {
		localDateTime: '2026-08-01T14:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-08-01T20:00:00.000Z',
	},
	sectionOrder: ['countdown', 'quote', 'location', 'rsvp', 'thankYou'],
	sectionStyles: {
		location: { showFlourishes: true },
		rsvp: {
			labels: {
				name: 'Nombre completo',
				guestCount: 'Personas que asistirán',
				attendance: '¿Nos acompañará?',
				confirmButton: 'Confirmar asistencia',
			},
		},
	},
	hero: {
		name: 'Luna Yamileth',
		secondaryName: 'Estrella Abigail',
		label: 'Primera Comunión',
		date: '2026-08-01T20:00:00.000Z',
		backgroundImage: 'hero',
		focalPoint: '50% 42%',
	},
	quote: {
		text: 'Jesús es el pan de vida que llena nuestro corazón de amor y esperanza.',
		author: 'Juan 6:35',
	},
	countdown: {
		title: 'Nos acercamos con alegría',
		footerText: 'Sábado, 1 de agosto de 2026',
	},
	location: {
		visibility: 'after-rsvp',
		introEyebrow: 'Detalles reservados',
		introHeading: 'Ubicación',
		introLede:
			'Por cuidado de la familia, compartiremos la dirección después de confirmar asistencia.',
		indicationsHeading: 'Indicaciones',
		ceremony: {
			venueEvent: 'Celebración',
			venueName: 'Salón García',
			address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
			city: 'Uruapan',
			date: '2026-08-01',
			time: '14:00',
			image: 'ceremony',
			googleMapsUrl:
				'https://www.google.com/maps/search/?api=1&query=Victoriano%20Huerta%2051%20Col.%20San%20Francisco%20Uruapan',
		},
		reception: {
			venueEvent: 'Recepción',
			venueName: 'Salón García',
			address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
			city: 'Uruapan',
			date: '2026-08-01',
			time: '14:00',
			image: 'reception',
			googleMapsUrl:
				'https://www.google.com/maps/search/?api=1&query=Victoriano%20Huerta%2051%20Col.%20San%20Francisco%20Uruapan',
		},
		indications: [
			{
				iconName: 'Calendar',
				styleVariant: 'default',
				text: '<strong>Llegada sugerida</strong> Favor de llegar con anticipación para recibir a Luna y Estrella.',
			},
		],
	},
	rsvp: {
		title: 'Confirma tu asistencia',
		subcopy: 'Su respuesta nos ayuda a preparar cada detalle de esta celebración de fe.',
		guestCap: 4,
		accessMode: 'hybrid',
		confirmationMessage:
			'Gracias por confirmar. Será un honor compartir este día tan especial con ustedes.',
		confirmationMode: 'api',
		responseMessages: {
			confirmed: {
				title: 'Gracias por acompañarnos, {guestName}.',
				subtitle: 'Su confirmación ha sido registrada.',
			},
			declined: {
				title: 'Gracias por avisarnos, {guestName}.',
				subtitle: 'Agradecemos mucho su cariño para Luna y Estrella.',
			},
		},
	},
	thankYou: {
		message:
			'Gracias por compartir con nosotras este día de fe. Su presencia y sus bendiciones quedarán guardadas con mucho cariño.',
		closingName: 'Luna y Estrella',
		image: 'thankYouPortrait',
		focalPoint: '50% 50%',
	},
	envelope: {
		disabled: false,
		sealStyle: 'wax',
		sealIcon: 'flower',
		sealInitials: 'L·E',
		microcopy: 'Primera Comunión de Luna y Estrella',
		documentLabel: 'Primera Comunión',
		cardLabel: 'Primera Comunión',
		cardTagline: 'Una celebración de fe',
		stampText: 'Luna y Estrella',
		stampYear: '2026',
	},
	sharing: {
		whatsappTemplate:
			'Hola {name}, con alegría les compartimos la invitación a la Primera Comunión de Luna y Estrella: {inviteUrl}',
		ogImage: 'hero',
		ogDescription:
			'Acompáñenos en la Primera Comunión de Luna y Estrella el sábado, 1 de agosto de 2026.',
	},
};

describe('Luna y Estrella Primera Comunión published content', () => {
	it('validates the target DB-published content against eventContentSchema', () => {
		const result = eventContentSchema.safeParse(lunaYEstrellaContent);

		if (!result.success) {
			throw new Error(
				`Luna y Estrella content failed schema validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
			);
		}

		expect(result.data.eventType).toBe('primera-comunion');
		expect(result.data.isDemo).toBe(false);
		expect(result.data.theme.preset).toBe('angelic-presence');
		expect(result.data._assetSlug).toBe('luna-y-estrella-primera-comunion');
		expect(result.data.location?.visibility).toBe('after-rsvp');
		expect(result.data.location?.ceremony?.venueName).toBe('Salón García');
		expect(result.data.hero.name).toBe('Luna Yamileth');
		expect(result.data.hero.secondaryName).toBe('Estrella Abigail');
	});

	it('uses the correct simplified sectionOrder', () => {
		expect(lunaYEstrellaContent.sectionOrder).toEqual([
			'countdown',
			'quote',
			'location',
			'rsvp',
			'thankYou',
		]);

		expect(lunaYEstrellaContent.sectionOrder).not.toContain('family');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('gallery');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('itinerary');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('gifts');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('personalizedAccess');
	});

	it('does not include excluded content blocks', () => {
		expect(Object.hasOwn(lunaYEstrellaContent, 'family')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'gallery')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'itinerary')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'gifts')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'interludes')).toBe(false);
	});

	it('does not include excluded visible copy in serialized content', () => {
		const serialized = JSON.stringify(lunaYEstrellaContent).toLowerCase();

		expect(serialized).not.toContain('código de vestimenta');
		expect(serialized).not.toContain('dress code');
		expect(serialized).not.toContain('itinerario');
		expect(serialized).not.toContain('galería');
		expect(serialized).not.toContain('mesa de regalos');
		expect(serialized).not.toContain('padrinos');
		expect(serialized).not.toContain('misa');
	});

	it('does not include Leah Lexa or demo baby-shower source details', () => {
		const serialized = JSON.stringify(lunaYEstrellaContent).toLowerCase();

		expect(serialized).not.toContain('leah');
		expect(serialized).not.toContain('baby-shower');
		expect(serialized).not.toContain('demo-baby-shower-celestial');
		expect(lunaYEstrellaContent._assetSlug).not.toBe('luna-y-estrella');
	});
});
