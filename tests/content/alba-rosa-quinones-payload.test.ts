import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	ALBA_ASSET_SPECS,
	ALBA_EVENT,
	buildAlbaPublishedContent,
	type AlbaAssetMap,
} from '../../scripts/provision/invitations/alba-rosa-quinones.ts';

const albaProfilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/alba-rosa-quinones.scss',
);

const albaAssetDir = path.join(process.cwd(), 'src/assets/invitations/alba-rosa-quinones');

function buildTestAssets(): AlbaAssetMap {
	return Object.fromEntries(
		ALBA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as AlbaAssetMap;
}

describe('Alba Rosa Quiñónez local invitation content', () => {
	it('uses a consistent luxury-hacienda catalog entry', () => {
		const preset = findDemoPreset(ALBA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-cumple-luxury-hacienda',
			eventType: 'cumple',
			themeId: 'luxury-hacienda',
		});
		expect(
			checkPublishGuard({
				baseDemoId: ALBA_EVENT.baseDemoId,
				themeId: ALBA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a neutral editorial Lane A profile', () => {
		const profile = fs.readFileSync(albaProfilePath, 'utf8');
		expect(profile).toContain('.event--alba-rosa-quinones.theme-preset--luxury-hacienda');
		expect(profile).toContain('--alba-ivory');
		expect(profile).toContain('--alba-sage');
		expect(profile).toContain('Neutral editorial palette');
	});

	it('has WebP release sources for every declared asset', () => {
		for (const spec of ALBA_ASSET_SPECS) {
			const filePath = path.join(albaAssetDir, spec.relativePath);
			expect(fs.existsSync(filePath)).toBe(true);
			expect(path.extname(spec.relativePath)).toBe('.webp');
		}
		expect(fs.existsSync(path.join(albaAssetDir, 'gallery-04-cafe.webp'))).toBe(false);
	});

	it('builds schema-valid published content with unique photo roles', () => {
		const content = buildAlbaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/\[\[PENDIENTE:/);
		expect(content.hero).toMatchObject({
			date: '2026-09-12T20:00:00.000Z',
			label: '70 AÑOS',
		});
		expect(content.hero).not.toHaveProperty('nickname');
		expect(content.envelope).toMatchObject({
			cardLabel: '70 AÑOS',
			envelopeName: 'Alba Rosa',
			cardName: 'Alba Rosa',
			cardSecondaryName: 'Quiñónez López',
			guestPlacement: 'outside-envelope',
			showCardAction: false,
			sealInitials: 'A·R',
			microcopy: 'ABRIR LA INVITACIÓN',
			tooltipText: 'ABRIR LA INVITACIÓN',
		});
		expect(content.sectionOrder).toEqual([
			'countdown',
			'location',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'family',
			'thankYou',
		]);
		expect(content.rsvp).toMatchObject({
			confirmationMode: 'api',
			accessMode: 'hybrid',
		});
		expect(content.countdown).toMatchObject({
			title: 'FALTAN',
		});
		expect(content.location).toMatchObject({
			introEyebrow: '12 DE SEPTIEMBRE DE 2026',
			reception: {
				venueName: 'Canta Luna Campestre',
				coordinates: { lat: 25.833891, lng: -109.052681, zoom: 15 },
			},
		});
		expect(content.gifts).toMatchObject({
			subtitle: expect.stringContaining('sobre'),
			items: [{ type: 'cash' }],
		});
		expect(content.thankYou).toMatchObject({
			message: expect.stringMatching(/^Gracias por acompañarme/),
			closingName: 'Alba Rosa',
		});
		expect(
			(
				(content.thankYou as { message: string }).message.match(
					/Gracias por acompañarme/g,
				) ?? []
			).length,
		).toBe(1);
		expect(content.sectionStyles).toMatchObject({
			thankYou: { variant: 'editorial-magazine' },
		});
		expect((content.interludes as unknown[]).length).toBe(1);
		expect(content.family).toMatchObject({
			presentation: 'with-photo',
			labels: {
				sectionMessage: 'El corazón de esta celebración es mi familia.',
			},
		});
		expect(content.gallery).toMatchObject({
			items: expect.arrayContaining([
				expect.objectContaining({ key: 'gallery-02-london' }),
				expect.objectContaining({ key: 'gallery-05-albert' }),
			]),
		});
		expect((content.gallery as { items: unknown[] }).items).toHaveLength(3);
		expect(content.music).toBeUndefined();
		expect(content.itinerary).toBeUndefined();
	});
});
