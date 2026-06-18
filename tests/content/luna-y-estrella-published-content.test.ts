import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';

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
	sectionOrder: ['quote', 'family', 'countdown', 'personalizedAccess', 'rsvp', 'thankYou'],
	sectionStyles: {
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
		backgroundImage: '/images/events/luna-y-estrella/hero.jpg',
		focalPoint: '50% 42%',
	},
	quote: {
		text: 'Jesús es el pan de vida que llena nuestro corazón de amor y esperanza.',
		author: 'Juan 6:35',
	},
	family: {
		parents: {
			father: 'Juan Manuel Villa Ponce',
			mother: 'Estefanía Báez Pérez',
		},
		parentsOrder: 'father-first',
		labels: {
			sectionTitle: 'Con la bendición de Dios',
			sectionMessage:
				'Con inmensa alegría compartimos este día de fe. Gracias por acompañar a Luna y Estrella con su cariño y sus bendiciones.',
			parentsTitle: 'Nuestros papás',
			godparentsTitle: 'Padrinos',
		},
		godparentGroups: [
			{
				honoreeName: 'Luna Yamileth Villa Báez',
				label: 'Luna',
				godparents: [{ name: 'Emiliano Pérez Rodríguez' }],
			},
			{
				honoreeName: 'Estrella Abigail Villa Báez',
				label: 'Estrella',
				godparents: [{ name: 'María Guadalupe Villa Ponce' }],
			},
		],
	},
	countdown: {
		title: 'Nos acercamos con alegría',
		footerText: 'Sábado, 1 de agosto de 2026',
	},
	location: {
		visibility: 'after-rsvp',
		introHeading: 'Detalles de la celebración',
		indicationsHeading: '',
		venues: [
			{
				type: 'reception',
				id: 'celebration',
				venueEvent: 'Celebración',
				venueName: 'Salón García',
				address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
				date: 'Sábado, 1 de agosto de 2026',
				time: '2:00 PM',
				googleMapsUrl:
					'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20Garc%C3%ADa%2C%20Victoriano%20Huerta%2051%2C%20Col.%20San%20Francisco%2C%20Uruapan',
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
				title: 'Gracias por confirmar',
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
		image: '/images/events/luna-y-estrella/thank-you.jpg',
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
		ogImage: '/images/events/luna-y-estrella/hero.jpg',
		ogDescription:
			'Acompáñenos en la Primera Comunión de Luna y Estrella el sábado, 1 de agosto de 2026.',
	},
};

function buildAnonymousLunaPageModel() {
	const parsedContent = eventContentSchema.parse(lunaYEstrellaContent);
	const viewModel = adaptEvent({
		id: 'event-published/primera-comunion/luna-y-estrella',
		data: parsedContent,
	} as EventContentEntry);

	return buildPageContextFromViewModel({
		viewModel,
		slug: 'luna-y-estrella',
		eventType: 'primera-comunion',
	});
}

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
		expect(result.data.location?.venues?.[0]?.venueName).toBe('Salón García');
		expect(result.data.hero.name).toBe('Luna Yamileth');
		expect(result.data.hero.secondaryName).toBe('Estrella Abigail');
		expect(result.data.family?.godparentGroups).toEqual([
			{
				honoreeName: 'Luna Yamileth Villa Báez',
				label: 'Luna',
				godparents: [{ name: 'Emiliano Pérez Rodríguez' }],
			},
			{
				honoreeName: 'Estrella Abigail Villa Báez',
				label: 'Estrella',
				godparents: [{ name: 'María Guadalupe Villa Ponce' }],
			},
		]);
	});

	it('uses the correct sectionOrder with family and no location', () => {
		expect(lunaYEstrellaContent.sectionOrder).toEqual([
			'quote',
			'family',
			'countdown',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);

		expect(lunaYEstrellaContent.sectionOrder).not.toContain('location');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('gallery');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('itinerary');
		expect(lunaYEstrellaContent.sectionOrder).not.toContain('gifts');
	});

	it('keeps excluded standalone content blocks out of source content', () => {
		expect(Object.hasOwn(lunaYEstrellaContent, 'gallery')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'itinerary')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'gifts')).toBe(false);
		expect(Object.hasOwn(lunaYEstrellaContent, 'interludes')).toBe(false);
	});

	it('does not include excluded visible copy in serialized source content', () => {
		const serialized = JSON.stringify(lunaYEstrellaContent).toLowerCase();

		expect(serialized).not.toContain('código de vestimenta');
		expect(serialized).not.toContain('dress code');
		expect(serialized).not.toContain('itinerario');
		expect(serialized).not.toContain('galería');
		expect(serialized).not.toContain('mesa de regalos');
		expect(serialized).not.toContain('misa');
	});

	it('does not leak protected location into the anonymous rendered page model', () => {
		const context = buildAnonymousLunaPageModel();
		const serialized = JSON.stringify(context.viewModel);

		expect(context.viewModel.sections.location).toBeUndefined();
		expect(context.viewModel.sections.rsvp?.revealedLocation).toBeUndefined();
		expect(context.viewModel.sectionOrder).not.toContain('location');
		expect(context.viewModel.navigation).not.toContainEqual(
			expect.objectContaining({ href: '#event-location' }),
		);
		expect(context.heroVenueName).toBeUndefined();
		expect(context.envelope?.teaserDetails).not.toContain('Salón García');
		expect(serialized).not.toContain('Salón García');
		expect(serialized).not.toContain('Victoriano Huerta');
		expect(serialized).not.toContain('google.com/maps');
	});

	it('reveals location to confirmed guests with default response editing', () => {
		const parseResult = eventContentSchema.safeParse(lunaYEstrellaContent);
		expect(parseResult.success).toBe(true);
		const viewModel = adaptEvent({
			id: 'event-published/primera-comunion/luna-y-estrella',
			data: parseResult.data!,
		} as EventContentEntry);

		const confirmedContext = buildPageContextFromViewModel({
			viewModel,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
			guestContext: {
				inviteId: 'mock-invite-uuid',
				eventType: 'primera-comunion',
				eventSlug: 'luna-y-estrella',
				eventTitle: 'Primera Comunión de Luna y Estrella',
				guest: {
					fullName: 'María Solís',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Nos vemos',
					hideCelebraMeBranding: false,
				},
			},
		});

		const revealed = confirmedContext.viewModel.sections.rsvp?.revealedLocation;
		expect(confirmedContext.viewModel.sections.rsvp?.allowResponseEditing).toBeUndefined();
		expect(revealed).toBeDefined();
		expect(confirmedContext.viewModel.sections.location).toBeUndefined();

		// Fixture uses venues[] array — verify googleMapsUrl survives the adapter → viewModel → protected-location pipeline
		const venue = revealed?.venues?.[0];
		expect(venue?.venueName).toBe('Salón García');
		expect(venue?.googleMapsUrl).toContain('google.com/maps');
	});

	it('does not include Leah Lexa or demo baby-shower source details', () => {
		const serialized = JSON.stringify(lunaYEstrellaContent).toLowerCase();

		expect(serialized).not.toContain('leah');
		expect(serialized).not.toContain('baby-shower');
		expect(serialized).not.toContain('demo-baby-shower-celestial');
		expect(lunaYEstrellaContent._assetSlug).not.toBe('luna-y-estrella');
	});
});
