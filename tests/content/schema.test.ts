import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

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
