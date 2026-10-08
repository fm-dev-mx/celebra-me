import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';
import {
	AITHAN_EVENT,
	aithanInvitation,
} from '../../scripts/provision/invitations/aithan-darell.ts';
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const PLACEHOLDER_PATTERN = /PENDIENTE|\[confirmar|: Por confirmar$|Pendiente de confirmar/i;
// The editorial-magazine preset was born for XV; none of that copy may leak into a child's birthday.
const XV_PATTERN = /\bXV\b|quince|edición xv/i;

function buildTestAssets(): UploadedAssetMap {
	return Object.fromEntries(
		aithanInvitation.assets.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	);
}

function collectStrings(value: unknown, pathSegments: string[] = []): string[] {
	if (typeof value === 'string') return [`${pathSegments.join('.')}: ${value}`];
	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			collectStrings(item, [...pathSegments, String(index)]),
		);
	}
	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
			collectStrings(item, [...pathSegments, key]),
		);
	}
	return [];
}

function publishedContent(): Record<string, unknown> {
	return aithanInvitation.buildPublishedContent(buildTestAssets());
}

describe('Aithan Darell managed definition', () => {
	it('resolves from the managed registry as a birthday on the editorial-magazine preset', () => {
		expect(getInvitationDefinition('aithan-darell')).toBe(aithanInvitation);
		expect(aithanInvitation.eventType).toBe('cumple');
		expect(aithanInvitation.hostLoginAlias).toBe('aithan_ruiz');
		expect(aithanInvitation.lifecycle).toBe('in_progress');
		expect(aithanInvitation.deliveryScope).toBe('content-and-assets');
		expect(aithanInvitation.managedIdentityProvenance).toBe('owner-approved');
	});

	it('uses the cumple editorial-magazine catalog entry that matches its theme', () => {
		const preset = findDemoPreset(AITHAN_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-cumple-editorial-magazine',
			eventType: 'cumple',
			themeId: 'editorial-magazine',
		});
		expect(preset?.themeId).toBe(aithanInvitation.themeId);
		expect(resolveInvitationTheme({ themeId: AITHAN_EVENT.themeId })).toBe(
			AITHAN_EVENT.themeId,
		);
	});

	it('builds schema-valid published content with the authored variants', () => {
		const content = publishedContent();
		const result = eventContentSchema.safeParse(content);
		expect({
			success: result.success,
			...(result.success ? {} : { issues: result.error.issues }),
		}).toStrictEqual({ success: true });

		const parsed = eventContentSchema.parse(content);
		expect(parsed.templateId).toBe('cumple-editorial-magazine');
		expect(parsed.visualProfileId).toBe('aithan-darell');
		expect(parsed.hero.variant).toBe('editorial-cover');
		expect(parsed.countdown?.variant).toBe('magazine-folio');
		expect(parsed.gallery?.variant).toBe('paired-portraits');
		expect(parsed.gallery?.items).toHaveLength(2);
		expect(parsed.rsvp?.variant).toBe('formal-register');
		expect(parsed.rsvp?.personalizedAccess?.variant).toBe('formal-pass');
		expect(parsed.thankYou?.variant).toBe('editorial-back-cover');
		expect(parsed.envelope?.revealVariant).toBe('editorial-cover');
		expect(parsed.envelope?.coverExperience).toBe('collector');
		// The edition is the age, printed alone on the rail (no "NÚM." label).
		expect(parsed.envelope?.coverEdition).toBe('3 años');
		expect(parsed.envelope?.coverEditionLabel).toBe('');
		// The collector face does not print cover lines; none are published.
		expect(parsed.envelope?.coverLines).toBeUndefined();
		expect(parsed.gallery?.variantOptions).toEqual({ arrangement: 'overlap' });
		expect(parsed.location?.presentationOptions).toEqual({
			indicationsStyle: 'numbered-board',
		});
		// Client dress code: red, black and/or white for every guest.
		expect(parsed.location?.indications).toContainEqual(
			expect.objectContaining({
				title: 'Código de vestimenta',
				iconName: 'DressCode',
				text: 'Todas las personas en color <strong>rojo, negro y/o blanco</strong>.',
			}),
		);
		// The brand is named once (cover masthead): no hero design credit.
		expect(parsed.hero.presentation).toEqual({
			coverMark: '3 años',
			coverPage: 'POLE POSITION',
			designCredit: false,
		});
		expect(parsed.composition.intersections).toEqual({
			quote: { family: 'atmospheric-blend', source: 'hero' },
			location: { family: 'pattern-band', source: 'countdown' },
			'personalized-access': { family: 'overlap', source: 'gallery' },
			thankYou: { family: 'pattern-band', source: 'rsvp' },
		});
	});

	it('keeps the real party instant in eventTiming and a wall-clock hero date', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.eventTiming).toEqual({
			localDateTime: '2026-10-24T17:30',
			timeZone: 'America/Mexico_City',
			startsAtUtc: '2026-10-24T23:30:00.000Z',
		});
		expect(parsed.hero.date).toBe('2026-10-24T17:30:00.000Z');
		expect(parsed.location?.venues).toHaveLength(1);
		expect(parsed.location?.venues?.[0]).toMatchObject({
			type: 'reception',
			venueName: 'Jardín de Teresita',
			time: '5:30 p. m.',
		});
	});

	it('prints the client-confirmed 5:30 p. m. start wherever a time is shown', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		const visibleTimes = [
			parsed.countdown?.footerText,
			parsed.sharing?.ogDescription,
			...(parsed.location?.indications ?? []).map((indication) => indication.text),
		].filter((text): text is string => typeof text === 'string');
		expect(visibleTimes.some((text) => text.includes('5:30 p. m.'))).toBe(true);
		// No other clock time (e.g. the superseded 4:30) may appear anywhere in the payload.
		const otherTimes = collectStrings(publishedContent()).filter((entry) =>
			/\b(?!5:30)\d{1,2}:\d{2}\s*(?:a|p)\.?\s*m\./i.test(entry),
		);
		expect(otherTimes).toEqual([]);
	});

	it('prints the age as "3 años" wherever the figure would stand alone', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		// The race number on the suit caption is a number, not the age: it keeps "Nº 3".
		expect(parsed.gallery?.items?.[0]?.caption).toBe('Traje oficial del piloto Nº 3');
		// No other field prints a bare "3" (the number-only edition and cover mark are gone).
		const bareThrees = collectStrings(publishedContent()).filter((entry) => /: 3$/.test(entry));
		expect(bareThrees).toEqual([]);
	});

	it('prints a date anyone can read on the back cover without repeating the scoreboard date', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.thankYou?.date).toBe('Sábado 24 de octubre de 2026');
		expect(JSON.stringify(publishedContent())).not.toContain('24 · X · 2026');
		// The scoreboard prints the full date itself; its footer only adds the start time.
		expect(parsed.countdown?.footerText).toBe(
			'Semáforo de salida · Pits listos para el arranque · 5:30 p. m.',
		);
		expect(parsed.countdown?.footerText).not.toMatch(/sábado/i);
	});

	it('links the venue to the pinned Google Maps location', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.location?.venues?.[0]).toMatchObject({
			// Client wording, printed literally; the pin resolves the municipality.
			address: 'Avenida Juárez 49, Atizapán centro',
			googleMapsUrl: 'https://maps.app.goo.gl/ebbpWEFK68LhuDm28',
		});
		expect(JSON.stringify(publishedContent())).not.toContain('HZDDjkjo8QrPrD5Y9');
		expect(JSON.stringify(publishedContent())).not.toContain('Qyf8Da9khBt6vHrPA');
	});

	it('distributes Cars characters and escudería references organically across sections', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		// Hero: call to action / race engines
		expect(parsed.hero.tagline).toContain('Arrancan los motores');
		// Location: Mack's route
		expect(parsed.location?.introEyebrow).toBe('La ruta de Mack');
		expect(parsed.location?.introLede).toContain('transporte oficial');
		// Gallery: Mate and McQueen
		expect(parsed.gallery?.items?.[1]?.caption).toBe(
			'Mate en los pits y McQueen en la pista: la mejor escudería',
		);
		// Personalized access: escudería, count interpolation tokens, date, time and venue
		const pass = parsed.rsvp?.personalizedAccess;
		expect(pass?.title).toBe('Su lugar en la tribuna');
		expect(pass?.subtitle).toContain('escudería');
		expect(pass?.noteText).toContain('{count}');
		expect(pass?.noteText).toContain('{personWord}');
		expect(pass?.noteText).toContain('Sábado 24 de octubre de 2026');
		expect(pass?.noteText).toContain('5:30 p. m.');
		expect(pass?.noteText).toContain('Jardín de Teresita');
		// Thank you: escudería and trophy
		expect(parsed.thankYou?.message).toContain('escudería reunida');
	});

	it('omits the sections the client did not supply data for', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.sectionOrder).toEqual([
			'quote',
			'countdown',
			'location',
			'gallery',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(parsed.family).toBeUndefined();
		expect(parsed.gifts).toBeUndefined();
		expect(parsed.itinerary).toBeUndefined();
	});

	it('publishes no placeholders and no XV edition copy', () => {
		const strings = collectStrings(publishedContent());
		expect(strings.filter((entry) => PLACEHOLDER_PATTERN.test(entry))).toEqual([]);
		expect(strings.filter((entry) => XV_PATTERN.test(entry))).toEqual([]);
	});

	it('publishes every photograph in a single role', () => {
		const specs = aithanInvitation.assets;
		const pathOf = (key: string) => specs.find((spec) => spec.key === key)?.relativePath;
		expect(specs.map((spec) => spec.key)).toEqual([
			'heroCanvas',
			'heroPortrait',
			'gallery01',
			'gallery02',
			'coverGrid',
			'thankYouTrophy',
			'characterMcQueen',
			'characterMack',
			'characterMate',
			'characterDocHudson',
			'characterSally',
			'characterRamone',
			'characterMcQueenFront',
			'logoCars',
		]);
		// Client photographs: car (hero portrait), race suit and jacket (gallery), one key each.
		const photoPaths = ['hero.jpg', 'gallery-01.jpg', 'gallery-02.jpg'];
		for (const photo of photoPaths) {
			expect(specs.filter((spec) => spec.relativePath === photo)).toHaveLength(1);
		}
		expect(pathOf('heroPortrait')).toBe('hero.jpg');
		// Original motif artwork fills the cover, the hero canvas and the back cover.
		expect(pathOf('heroCanvas')).toBe('hero-canvas.jpg');
		expect(pathOf('coverGrid')).toBe('cover-grid.jpg');
		expect(pathOf('thankYouTrophy')).toBe('thankyou-trophy.jpg');

		const parsed = eventContentSchema.parse(publishedContent());
		const keyOf = (asset: unknown) =>
			typeof asset === 'string' ? asset : JSON.stringify(asset);
		expect(keyOf(parsed.hero.backgroundImage)).toContain('heroCanvas');
		expect(keyOf(parsed.hero.portrait)).toContain('heroPortrait');
		expect(keyOf(parsed.thankYou?.image)).toContain('thankYouTrophy');
		expect(keyOf(parsed.envelope?.backdropImage)).toContain('coverGrid');
		// The share preview is off-page: it reuses the client's chosen photograph.
		expect(keyOf(parsed.sharing?.ogImage)).toContain('heroPortrait');
		// Client-requested Cars characters: one transparent cutout per surface, one role each.
		expect(keyOf(parsed.countdown?.ornament)).toContain('characterDocHudson');
		expect(keyOf(parsed.location?.ornament)).toContain('characterMack');
		expect(keyOf(parsed.thankYou?.ornament)).toContain('characterMate');
		// Owner-approved placement: McQueen (front view) on the cover face and (side view) under the
		// hero details, Sally and Ramone on the inner page, the Cars emblem above the hero name.
		// Each file appears once.
		expect(keyOf(parsed.envelope?.coverOrnament)).toContain('characterMcQueenFront');
		expect(keyOf(parsed.hero.accentOrnament)).toContain('characterMcQueen');
		const spread = parsed.envelope?.spreadOrnaments ?? [];
		expect(spread).toHaveLength(2);
		expect(keyOf(spread[0])).toContain('characterSally');
		expect(keyOf(spread[1])).toContain('characterRamone');
		expect(keyOf(parsed.hero.ornament)).toContain('logoCars');
		const ornamentKeys = [
			parsed.countdown?.ornament,
			parsed.location?.ornament,
			parsed.thankYou?.ornament,
			parsed.envelope?.coverOrnament,
			...(parsed.envelope?.spreadOrnaments ?? []),
			parsed.hero.ornament,
			parsed.hero.accentOrnament,
		].map(keyOf);
		expect(new Set(ornamentKeys).size).toBe(ornamentKeys.length);
		const motifFiles: Record<string, string> = {
			characterMcQueen: 'character-mcqueen.webp',
			characterMcQueenFront: 'character-mcqueen-front.webp',
			characterMack: 'character-mack.webp',
			characterMate: 'character-mate.webp',
			characterDocHudson: 'character-doc-hudson.webp',
			characterSally: 'character-sally.webp',
			characterRamone: 'character-ramone.webp',
			logoCars: 'logo-cars.webp',
		};
		for (const [key, file] of Object.entries(motifFiles)) {
			expect(pathOf(key)).toBe(file);
		}
	});

	it('publishes the hosted "Life Is a Highway" music track', () => {
		const parsed = eventContentSchema.parse(publishedContent());
		expect(parsed.music).toMatchObject({
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1791406894/Rascal_Flatts_-_Life_Is_a_Highway_swt74a.mp3',
			title: 'Life Is a Highway',
			autoPlay: true,
		});
	});
});
