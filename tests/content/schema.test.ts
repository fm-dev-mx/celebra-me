import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';
import {
	LOCATION_VARIANTS,
	QUOTE_VARIANTS,
	SHARED_SECTION_VARIANTS,
	THEME_PRESETS,
} from '@/lib/theme/theme-contract';

const resolvedSchema =
	typeof collections.events.schema === 'function'
		? collections.events.schema({ image: () => z.unknown() } as unknown as never)
		: collections.events.schema;

if (!resolvedSchema) {
	throw new Error('events schema is not defined');
}

const eventSchema = resolvedSchema as {
	safeParse: (value: unknown) => { success: boolean };
};

function createMinimalEvent(overrides = {}) {
	return {
		eventType: 'xv',
		title: 'Test Event',
		theme: {
			primaryColor: '#ffffff',
			fontFamily: 'serif',
			preset: 'jewelry-box',
		},
		hero: {
			name: 'Test Name',
			date: '2026-01-01T00:00:00.000Z',
			backgroundImage: 'https://example.com/hero.jpg',
		},
		location: {
			venueName: 'Test Venue',
			address: 'Test Address',
			city: 'Test City',
		},
		...overrides,
	};
}

describe('Event content schema (real contract)', () => {
	it('validates all real event content files', () => {
		const eventsDir = path.resolve(process.cwd(), 'src/content/events');
		const files = fs
			.readdirSync(eventsDir)
			.filter((file) => file.endsWith('.json') && !file.endsWith('.assets.json'));

		for (const file of files) {
			const raw = fs.readFileSync(path.join(eventsDir, file), 'utf8');
			const parsed = JSON.parse(raw);
			const result = eventSchema.safeParse(parsed);
			expect(result.success).toBe(true);
		}
	});

	it('accepts all theme presets from ThemeContract', () => {
		for (const preset of THEME_PRESETS) {
			const result = eventSchema.safeParse(
				createMinimalEvent({
					theme: {
						primaryColor: '#d4af37',
						fontFamily: 'serif',
						preset,
					},
				}),
			);
			expect(result.success).toBe(true);
		}
	});

	it('rejects invalid preset and section variants not present in ThemeContract', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				theme: {
					primaryColor: '#d4af37',
					fontFamily: 'serif',
					preset: 'broken-preset',
				},
				sectionStyles: {
					quote: { variant: 'broken-quote' },
					location: { variant: 'broken-location' },
					rsvp: { variant: 'broken-rsvp' },
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('enforces typed hero and family layout variants', () => {
		const validResult = eventSchema.safeParse(
			createMinimalEvent({
				hero: {
					name: 'Test Name',
					date: '2026-01-01T00:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
					layoutVariant: 'premium-portrait',
				},
				family: {
					layoutVariant: 'premium-mask',
				},
			}),
		);
		const invalidResult = eventSchema.safeParse(
			createMinimalEvent({
				hero: {
					name: 'Test Name',
					date: '2026-01-01T00:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
					layoutVariant: 'broken-layout',
				},
			}),
		);

		expect(validResult.success).toBe(true);
		expect(invalidResult.success).toBe(false);
	});

	it('supports typed location indications with explicit iconName and styleVariant', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				sectionStyles: {
					quote: { variant: QUOTE_VARIANTS[0] },
					location: { variant: LOCATION_VARIANTS[0] },
					rsvp: { variant: SHARED_SECTION_VARIANTS[0] },
				},
				location: {
					venueName: 'Test Venue',
					address: 'Test Address',
					city: 'Test City',
					indications: [
						{
							icon: 'crown',
							iconName: 'Crown',
							styleVariant: 'reserved',
							text: 'Reserved color',
						},
					],
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('accepts hybrid RSVP access mode in event content', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				rsvp: {
					title: 'Confirma tu asistencia',
					guestCap: 3,
					accessMode: 'hybrid',
					confirmationMessage: 'Gracias por confirmar',
					showDietaryField: false,
					confirmationMode: 'api',
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('accepts rich text in location indications text', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				location: {
					venueName: 'Test Venue',
					address: 'Test Address',
					city: 'Test City',
					indications: [
						{
							icon: 'crown',
							text: '<strong>Solo adultos</strong>',
						},
					],
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('rejects unsupported preset and location variant pairings', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				theme: {
					primaryColor: '#d4af37',
					fontFamily: 'serif',
					preset: 'jewelry-box',
				},
				sectionStyles: {
					location: { variant: 'editorial' },
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('allows editorial location styling when the floral preset publishes the required tokens', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				theme: {
					primaryColor: '#d4af37',
					fontFamily: 'serif',
					preset: 'premiere-floral',
				},
				sectionStyles: {
					location: { variant: 'editorial' },
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('rejects invalid internal asset keys in event content', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				hero: {
					name: 'Test Name',
					date: '2026-01-01T00:00:00.000Z',
					backgroundImage: 'broken-asset-key',
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('rejects insecure external asset URLs', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				hero: {
					name: 'Test Name',
					date: '2026-01-01T00:00:00.000Z',
					backgroundImage: 'http://example.com/hero.jpg',
				},
			}),
		);

		expect(result.success).toBe(false);
	});
});
