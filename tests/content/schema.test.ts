import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';
import {
	ITINERARY_ICON_DISPLAY_NAMES,
	ITINERARY_ICON_KEYS,
	THEME_PRESETS,
} from '@/lib/theme/theme-contract';

const rawSchema = collections.events.schema;
if (!rawSchema) {
	throw new Error('events schema is not defined');
}
const eventSchema =
	typeof rawSchema === 'function' ? rawSchema({ image: () => z.string() } as never) : rawSchema;

const contentRoots = [
	'src/content/events',
	'src/content/event-demos',
	'src/content/event-templates',
];

function getJsonContentFiles(root: string): string[] {
	return fs
		.readdirSync(root, { recursive: true, withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				entry.name.endsWith('.json') &&
				!entry.name.endsWith('.assets.json'),
		)
		.map((entry) => path.join(entry.parentPath, entry.name));
}

function createMinimalEvent(overrides = {}) {
	return {
		eventType: 'xv',
		title: 'Test Event',
		theme: {
			fontFamily: 'serif',
			preset: 'jewelry-box',
		},
		hero: {
			name: 'Test Name',
			date: '2026-01-01T00:00:00.000Z',
			backgroundImage: 'https://example.com/hero.jpg',
		},
		quote: {
			text: 'Test quote text',
			author: 'Test Author',
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
		for (const contentRoot of contentRoots) {
			const files = getJsonContentFiles(path.resolve(process.cwd(), contentRoot));
			for (const file of files) {
				const raw = fs.readFileSync(file, 'utf8');
				const parsed = JSON.parse(raw);
				const result = eventSchema.safeParse(parsed);
				expect(result.success).toBe(true);
			}
		}
	});

	it('keeps deprecated theme color fields out of real event content files', () => {
		for (const contentRoot of contentRoots) {
			const files = getJsonContentFiles(path.resolve(process.cwd(), contentRoot));
			for (const file of files) {
				const raw = fs.readFileSync(file, 'utf8');
				const parsed = JSON.parse(raw);
				expect(parsed.theme?.primaryColor).toBeUndefined();
				expect(parsed.theme?.accentColor).toBeUndefined();
			}
		}
	});

	it('keeps raw hex envelope palette values out of real event content files', () => {
		for (const contentRoot of contentRoots) {
			const files = getJsonContentFiles(path.resolve(process.cwd(), contentRoot));
			for (const file of files) {
				const raw = fs.readFileSync(file, 'utf8');
				const parsed = JSON.parse(raw);
				const palette = parsed.envelope?.closedPalette ?? {};
				expect(
					Object.values(palette).some(
						(value) => typeof value === 'string' && value.startsWith('#'),
					),
				).toBe(false);
			}
		}
	});

	it('accepts all theme presets from ThemeContract', () => {
		for (const preset of THEME_PRESETS) {
			const result = eventSchema.safeParse(
				createMinimalEvent({
					theme: {
						fontFamily: 'serif',
						preset,
					},
				}),
			);
			expect(result.success).toBe(true);
		}
	});

	it('includes angelic-presence in THEME_PRESETS', () => {
		expect((THEME_PRESETS as readonly string[]).includes('angelic-presence')).toBe(true);
	});

	it('includes enchanted-rose in THEME_PRESETS', () => {
		expect((THEME_PRESETS as readonly string[]).includes('enchanted-rose')).toBe(true);
	});

	it('rejects invalid preset and section variants not present in ThemeContract', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				theme: {
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

	it('rejects unsupported sectionStyles fields instead of silently stripping them', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				sectionStyles: {
					quote: {
						fontStyle: 'script',
						animation: 'fade',
					},
					countdown: {
						numberStyle: 'thin',
					},
					location: {
						mapStyle: 'dark',
						showFlourishes: true,
					},
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('supports hero portrait and variant as formal content fields', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				hero: {
					name: 'Test Name',
					date: '2026-01-01T00:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
					portrait: 'https://example.com/portrait.jpg',
					variant: 'editorial',
				},
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.hero.portrait).toEqual({
			type: 'external',
			src: 'https://example.com/portrait.jpg',
		});
		expect(result.data.hero.variant).toBe('editorial');
	});

	it('accepts explicit invitation section order with personalized access', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				sectionOrder: ['quote', 'location', 'personalizedAccess', 'rsvp', 'thankYou'],
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.sectionOrder).toEqual([
			'quote',
			'location',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
	});

	it('rejects unknown section order keys', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				sectionOrder: ['quote', 'unknownSection'],
			}),
		);

		expect(result.success).toBe(false);
	});

	it('rejects unsupported RSVP content fields instead of silently stripping them', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				rsvp: {
					title: 'Confirma tu asistencia',
					guestCap: 4,
					confirmationMessage: 'Gracias por confirmar',
					confirmationMode: 'api',
					attendanceLabel: '¿Nos acompañarás?',
					guests: [
						{
							guestId: 'demo',
							displayName: 'Demo Guest',
							maxAllowedAttendees: 2,
						},
					],
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('rejects deprecated theme color fields', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				theme: {
					fontFamily: 'serif',
					preset: 'jewelry-box',
					primaryColor: '#d4af37',
					accentColor: 'surfaceDark',
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('rejects raw hex envelope palette values', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					microcopy: 'Abrir',
					closedPalette: {
						background: '#0D0D0D',
					},
				},
			}),
		);

		expect(result.success).toBe(false);
	});

	it('supports typed location indications with explicit iconName and styleVariant', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				sectionStyles: {
					quote: { variant: THEME_PRESETS[0] },
					location: { variant: THEME_PRESETS[0] },
					rsvp: { variant: THEME_PRESETS[0] },
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
					confirmationMode: 'api',
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('strips event-level branding key since branding is now per-guest only', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				branding: {
					hideCelebraMeBranding: true,
				},
			}),
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect((result.data as Record<string, unknown>).branding).toBeUndefined();
		}
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

	it('supports itinerary subtitles and refined venue/farewell icons', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				itinerary: {
					title: 'Programa',
					subtitle: 'Bautizo y 1er Año de César Ramses',
					items: [
						{
							icon: 'map',
							label: 'Recepción',
							time: '4:00 p.m.',
							description: 'Nos reuniremos para celebrar con cariño.',
						},
						{
							icon: 'sparkles',
							label: 'Cierre de celebración',
							time: '10:00 p.m.',
							description: 'Gracias por ser parte de este recuerdo.',
						},
					],
				},
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.itinerary?.subtitle).toBe('Bautizo y 1er Año de César Ramses');
		expect((ITINERARY_ICON_KEYS as readonly string[]).includes('map')).toBe(true);
		expect((ITINERARY_ICON_KEYS as readonly string[]).includes('sparkles')).toBe(true);
		expect(ITINERARY_ICON_DISPLAY_NAMES.map).toBe('MapLocation');
		expect(ITINERARY_ICON_DISPLAY_NAMES.sparkles).toBe('Sparkles');
	});

	it('accepts thank-you overlay anchor and normalized safe area metadata', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				thankYou: {
					message: 'Gracias por acompañarnos.',
					closingName: 'Test Name',
					image: 'https://example.com/thank-you.jpg',
					focalPoint: '52% 42%',
					overlayAnchor: 'left',
					overlaySafeArea: {
						x: 0.48,
						y: 0.08,
						width: 0.34,
						height: 0.42,
					},
				},
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.thankYou?.overlayAnchor).toBe('left');
		expect(result.data.thankYou?.overlaySafeArea).toEqual({
			x: 0.48,
			y: 0.08,
			width: 0.34,
			height: 0.42,
		});
	});

	it('rejects invalid thank-you overlay anchors and safe area values outside the image', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				thankYou: {
					message: 'Gracias por acompañarnos.',
					closingName: 'Test Name',
					overlayAnchor: 'center',
					overlaySafeArea: {
						x: 0.8,
						y: 0.2,
						width: 0.4,
						height: 0.3,
					},
				},
			}),
		);

		expect(result.success).toBe(false);
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
