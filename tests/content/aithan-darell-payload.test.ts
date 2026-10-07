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
		expect(parsed.envelope?.coverEdition).toBe('3');
		// The collector face does not print cover lines; none are published.
		expect(parsed.envelope?.coverLines).toBeUndefined();
		expect(parsed.gallery?.variantOptions).toEqual({ arrangement: 'overlap' });
		expect(parsed.location?.presentationOptions).toEqual({
			indicationsStyle: 'numbered-board',
		});
		// The brand is named once (cover masthead): no hero design credit.
		expect(parsed.hero.presentation).toEqual({
			coverMark: '3',
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
		// Music waits for the owner-hosted track; no placeholder URL is published.
		expect(parsed.music).toBeUndefined();
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
	});

	it('publishes no music until the owner hosts the track', () => {
		expect(publishedContent()).not.toHaveProperty('music');
	});
});
