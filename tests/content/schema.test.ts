// tests/content/schema.test.ts
// Tests for Zod schema validation of content collections

import { z } from 'zod';

// Recreate the schema from config.ts for testing
// Note: We can't import the actual schema because it uses Astro-specific imports
const eventSchema = z.object({
	eventType: z.enum(['xv', 'boda', 'bautizo']),
	title: z.string(),
	description: z.string().optional(),
	theme: z.object({
		primaryColor: z.string().regex(/^#/, 'Must be a hex color'),
		accentColor: z.string().regex(/^#/, 'Must be a hex color').optional(),
		fontFamily: z.enum(['serif', 'sans']).default('serif'),
	}),
	hero: z.object({
		name: z.string(),
		date: z.string().datetime(), // ISO 8601
		backgroundImage: z.string(), // Simplified for testing - actual uses image()
	}),
	location: z.object({
		venueName: z.string(),
		address: z.string(),
		mapUrl: z.string().url().optional(),
	}),
	family: z
		.object({
			parents: z.object({
				father: z.string().optional(),
				mother: z.string().optional(),
			}),
			godparents: z
				.array(
					z.object({
						name: z.string(),
						role: z.string().optional(),
					}),
				)
				.optional(),
			featuredImage: z.string().optional(), // Simplified for testing
		})
		.optional(),
	rsvp: z
		.object({
			title: z.string().default('¿Vienes a celebrar conmigo?'),
			guestCap: z.number().int().positive().default(1),
			confirmationMessage: z
				.string()
				.default('¡Gracias por confirmar! Te esperamos con mucha emoción.'),
		})
		.optional(),
	quote: z
		.object({
			text: z.string(),
			author: z.string().optional(),
		})
		.optional(),
	thankYou: z
		.object({
			message: z.string(),
			closingName: z.string(),
			image: z.string().optional(), // Simplified for testing
		})
		.optional(),
	music: z
		.object({
			url: z.string(),
			autoPlay: z.boolean().default(false),
			title: z.string().optional(),
		})
		.optional(),
	sections: z
		.object({
			countdown: z.boolean().default(true),
			rsvp: z.boolean().default(true),
			gifts: z.boolean().default(false),
		})
		.optional(),
});

describe('Event Schema Validation', () => {
	describe('Valid Events', () => {
		it('should validate demo-xv.json structure', () => {
			const demoEvent = {
				eventType: 'xv',
				title: 'XV Años - Demo Invitación',
				description: 'Acompáñanos a celebrar estos XV años de ensueño.',
				theme: {
					primaryColor: '#d4af37',
					accentColor: '#111111',
					fontFamily: 'serif',
				},
				hero: {
					name: 'Lucía García',
					date: '2025-10-25T18:00:00.000Z',
					backgroundImage: '../../assets/images/hero/bgHeroDesktop.jpg',
				},
				location: {
					venueName: "Salón de Eventos 'El Jardín'",
					address: 'Av. de las Rosas #100, Col. Centro, Ciudad',
				},
				family: {
					parents: {
						father: 'Sr. Roberto Pérez',
						mother: 'Sra. Esthela de Pérez',
					},
					godparents: [
						{ name: 'Sr. Juan Carlos', role: 'Padrino de Honor' },
						{ name: 'Sra. Ana María', role: 'Madrina de Honor' },
					],
					featuredImage: '../../assets/images/about/partyToast.jpg',
				},
				sections: {
					countdown: true,
					rsvp: true,
				},
				rsvp: {
					title: '¿Vienes a celebrar conmigo?',
					guestCap: 2,
					confirmationMessage: '¡Gracias por confirmar! Te esperamos con mucha emoción.',
				},
				quote: {
					text: 'Hoy dejo atrás la niñez...',
					author: 'Lucía García',
				},
				thankYou: {
					message: 'Gracias por ser parte de este momento tan especial...',
					closingName: 'Lucía',
					image: '../../assets/images/about/partyToast.jpg',
				},
				music: {
					url: 'https://example.com/audio.mp3',
					autoPlay: false,
					title: 'Música de fondo',
				},
			};

			const result = eventSchema.safeParse(demoEvent);
			expect(result.success).toBe(true);
		});

		it('should validate minimal valid event', () => {
			const minimalEvent = {
				eventType: 'xv',
				title: 'Minimal Event',
				theme: {
					primaryColor: '#ffffff',
				},
				hero: {
					name: 'Test Name',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'path/to/image.jpg',
				},
				location: {
					venueName: 'Test Venue',
					address: 'Test Address',
				},
			};

			const result = eventSchema.safeParse(minimalEvent);
			expect(result.success).toBe(true);
		});

		it('should validate all event types', () => {
			const eventTypes = ['xv', 'boda', 'bautizo'];

			eventTypes.forEach((type) => {
				const event = {
					eventType: type,
					title: `${type} Event`,
					theme: { primaryColor: '#000000' },
					hero: {
						name: 'Test',
						date: '2025-01-01T00:00:00.000Z',
						backgroundImage: 'img.jpg',
					},
					location: { venueName: 'Venue', address: 'Address' },
				};

				const result = eventSchema.safeParse(event);
				expect(result.success).toBe(true);
			});
		});
	});

	describe('Invalid Events', () => {
		it('should reject invalid event type', () => {
			const invalidEvent = {
				eventType: 'fiesta', // Invalid
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
			};

			const result = eventSchema.safeParse(invalidEvent);
			expect(result.success).toBe(false);
		});

		it('should reject invalid color format', () => {
			const invalidColor = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: 'red' }, // Invalid - not hex
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
			};

			const result = eventSchema.safeParse(invalidColor);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('hex color');
			}
		});

		it('should reject invalid date format', () => {
			const invalidDate = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: 'not-a-date', // Invalid
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
			};

			const result = eventSchema.safeParse(invalidDate);
			expect(result.success).toBe(false);
		});

		it('should reject missing required hero.name', () => {
			const missingName = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					// name is missing
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
			};

			const result = eventSchema.safeParse(missingName);
			expect(result.success).toBe(false);
		});

		it('should reject invalid guestCap', () => {
			const invalidGuestCap = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
				rsvp: {
					guestCap: -5, // Invalid - must be positive
				},
			};

			const result = eventSchema.safeParse(invalidGuestCap);
			expect(result.success).toBe(false);
		});

		it('should reject invalid mapUrl format', () => {
			const invalidMapUrl = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: {
					venueName: 'Venue',
					address: 'Address',
					mapUrl: 'not-a-url', // Invalid
				},
			};

			const result = eventSchema.safeParse(invalidMapUrl);
			expect(result.success).toBe(false);
		});
	});

	describe('Default Values', () => {
		it('should apply default fontFamily', () => {
			const eventWithoutFontFamily = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
			};

			const result = eventSchema.parse(eventWithoutFontFamily);
			expect(result.theme.fontFamily).toBe('serif');
		});

		it('should apply default rsvp values', () => {
			const eventWithEmptyRsvp = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
				rsvp: {},
			};

			const result = eventSchema.parse(eventWithEmptyRsvp);
			expect(result.rsvp?.guestCap).toBe(1);
			expect(result.rsvp?.title).toBe('¿Vienes a celebrar conmigo?');
		});

		it('should apply default section values', () => {
			const eventWithEmptySections = {
				eventType: 'xv',
				title: 'Test',
				theme: { primaryColor: '#ffffff' },
				hero: {
					name: 'Test',
					date: '2025-01-01T00:00:00.000Z',
					backgroundImage: 'img.jpg',
				},
				location: { venueName: 'Venue', address: 'Address' },
				sections: {},
			};

			const result = eventSchema.parse(eventWithEmptySections);
			expect(result.sections?.countdown).toBe(true);
			expect(result.sections?.rsvp).toBe(true);
			expect(result.sections?.gifts).toBe(false);
		});
	});
});
