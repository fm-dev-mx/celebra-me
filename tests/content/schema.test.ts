import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';
import { EVENT_TYPES, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { ICON_CATALOG } from '@/lib/icons/icon-catalog';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';

const rawSchema = collections.events.schema;
if (!rawSchema) {
	throw new Error('events schema is not defined');
}
const eventSchema =
	typeof rawSchema === 'function' ? rawSchema({ image: () => z.string() } as never) : rawSchema;

const contentRoots = ['src/content/event-demos', 'src/content/event-templates'];
const babyShowerDemoRoot = path.resolve(process.cwd(), 'src/content/event-demos/baby-shower');

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

function forEachContentFile(fn: (file: string) => void): void {
	for (const contentRoot of contentRoots) {
		const files = getJsonContentFiles(path.resolve(process.cwd(), contentRoot));
		for (const file of files) {
			fn(file);
		}
	}
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
		forEachContentFile((file) => {
			const raw = fs.readFileSync(file, 'utf8');
			const parsed = JSON.parse(raw);
			const result = eventSchema.safeParse(parsed);
			if (!result.success) {
				throw new Error(`${file}: ${JSON.stringify(result.error.issues, null, 2)}`);
			}
			expect(result.success).toBe(true);
		});
	});

	it('keeps deprecated theme color fields out of real event content files', () => {
		forEachContentFile((file) => {
			const raw = fs.readFileSync(file, 'utf8');
			const parsed = JSON.parse(raw);
			expect(parsed.theme?.primaryColor).toBeUndefined();
			expect(parsed.theme?.accentColor).toBeUndefined();
		});
	});

	it('keeps raw hex envelope palette values out of real event content files', () => {
		forEachContentFile((file) => {
			const raw = fs.readFileSync(file, 'utf8');
			const parsed = JSON.parse(raw);
			const palette = parsed.envelope?.closedPalette ?? {};
			expect(
				Object.values(palette).some(
					(value) => typeof value === 'string' && value.startsWith('#'),
				),
			).toBe(false);
		});
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

	it('includes baby-shower in EVENT_TYPES', () => {
		expect((EVENT_TYPES as readonly string[]).includes('baby-shower')).toBe(true);
	});

	it('includes primera-comunion in EVENT_TYPES', () => {
		expect((EVENT_TYPES as readonly string[]).includes('primera-comunion')).toBe(true);
	});

	it('accepts native baby-shower event content', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				eventType: 'baby-shower',
				title: 'Baby Shower de Luna Celeste',
				theme: {
					fontFamily: 'serif',
					preset: 'celestial-blue',
				},
				eventTiming: {
					localDateTime: '2026-06-21T14:00',
					timeZone: 'America/Mexico_City',
					startsAtUtc: '2026-06-21T20:00:00.000Z',
				},
				hero: {
					name: 'Luna Celeste',
					label: 'Mi Baby Shower',
					date: '2026-06-21T20:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('accepts native primera-comunion event content', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				eventType: 'primera-comunion',
				title: 'Primera Comunión de Luna y Estrella',
				theme: {
					fontFamily: 'serif',
					preset: 'angelic-presence',
				},
				hero: {
					name: 'Luna y Estrella',
					label: 'Mi Primera Comunión',
					date: '2026-09-12T17:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('accepts after-rsvp location visibility for protected venue details', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				eventType: 'primera-comunion',
				title: 'Primera Comunión de Luna y Estrella',
				location: {
					visibility: 'after-rsvp',
					introHeading: 'Ubicación',
					ceremony: {
						venueEvent: 'Celebración',
						venueName: 'Salón García',
						address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
						date: '2026-08-01',
						time: '14:00',
					},
				},
			}),
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.location?.visibility).toBe('after-rsvp');
		}
	});

	it('routes the static baby-shower demo through a fictitious slug only', () => {
		const fictitiousDemoPath = path.join(babyShowerDemoRoot, 'demo-baby-shower-celestial.json');
		const leahDemoPath = path.join(babyShowerDemoRoot, 'leah-lexa-baby-shower.json');
		const babyShowerPreset = DEMO_PRESET_CATALOG.find(
			(preset) => preset.eventType === 'baby-shower',
		);

		expect(fs.existsSync(fictitiousDemoPath)).toBe(true);
		expect(fs.existsSync(leahDemoPath)).toBe(false);
		expect(babyShowerPreset).toMatchObject({
			id: 'demo-baby-shower-celestial',
			displayName: 'Baby Shower — Celestial Demo',
			previewSlug: 'demo-baby-shower-celestial',
		});
	});

	it('keeps real Leah Lexa details out of static baby-shower demo content', () => {
		const targetFile = path.join(babyShowerDemoRoot, 'demo-baby-shower-celestial.json');
		const content = fs.readFileSync(targetFile, 'utf8');

		expect(content).toContain('Luna Celeste');
		expect(content).toContain('Mateo y Valeria');
		expect(content).toContain('"_assetSlug": "demo-baby-shower-celestial"');
		expect(content).not.toMatch(
			/Leah Lexa|Hugo y Fernanda|Guadalupe Proletaria|51975133|Liverpool/,
		);
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

	it('accepts grouped eventTiming fields', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				eventTiming: {
					localDateTime: '2026-08-01T20:00',
					timeZone: 'America/Mazatlan',
					startsAtUtc: '2026-08-02T03:00:00.000Z',
				},
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.eventTiming).toEqual({
			localDateTime: '2026-08-01T20:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-08-02T03:00:00.000Z',
		});
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

	it('accepts medium interlude height for compact emotional sections', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				interludes: [
					{
						image: 'https://example.com/interlude.jpg',
						afterSection: 'quote',
						height: 'medium',
						alt: 'Antes de conocerte, ya eras nuestro sueño más bonito.',
					},
				],
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('expected parse to succeed');
		expect(result.data.interludes?.[0]?.height).toBe('medium');
	});

	it('preserves the single gallery variant for one-image editorial galleries', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				gallery: {
					variant: 'single',
					title: 'La manada tambien te espera',
					subtitle: 'En casa ya hay patitas listas para recibirte con amor.',
					items: [{ image: 'https://example.com/dogs.jpg' }],
				},
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('expected parse to succeed');
		expect(result.data.gallery?.variant).toBe('single');
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

	it('accepts sealVariant premium-rose and passes through sealInitials', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					sealInitials: 'LL',
					sealVariant: 'premium-rose',
					microcopy: 'Toca para abrir',
				},
			}),
		);

		expect(result.success).toBe(true);
		if (result.success) {
			const { sealVariant, sealInitials } = result.data.envelope ?? {};
			expect(sealVariant).toBe('premium-rose');
			expect(sealInitials).toBe('LL');
		}
	});

	it('rejects sealVariant with invalid value', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				envelope: {
					disabled: false,
					sealStyle: 'wax',
					sealVariant: 'gold-foil',
					microcopy: 'Abrir',
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
							iconName: 'Crown',
							text: '<strong>Solo adultos</strong>',
						},
					],
				},
			}),
		);

		expect(result.success).toBe(true);
	});

	it('supports itinerary subtitles and iconName-based items', () => {
		const result = eventSchema.safeParse(
			createMinimalEvent({
				itinerary: {
					title: 'Programa',
					subtitle: 'Bautizo y 1er Año de César Ramses',
					items: [
						{
							iconName: 'MapLocation',
							label: 'Recepción',
							time: '4:00 p.m.',
							description: 'Nos reuniremos para celebrar con cariño.',
						},
						{
							iconName: 'Sparkles',
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
		const catalogNames = ICON_CATALOG.map((entry) => entry.name);
		expect(catalogNames).toContain('MapLocation');
		expect(catalogNames).toContain('Sparkles');
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
