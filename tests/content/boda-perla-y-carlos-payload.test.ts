import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	PERLA_ASSET_SPECS,
	PERLA_EVENT,
	buildPerlaPublishedContent,
	type PerlaAssetMap,
} from '../../scripts/provision/invitations/boda-perla-y-carlos.ts';

const profilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/boda-perla-y-carlos.scss',
);

const assetDir = path.join(process.cwd(), 'src/assets/invitations/boda-perla-y-carlos');

function buildTestAssets(): PerlaAssetMap {
	return Object.fromEntries(
		PERLA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as PerlaAssetMap;
}

describe('Boda Perla y Carlos provision contract', () => {
	it('uses jewelry-box-wedding catalog entry', () => {
		const preset = findDemoPreset(PERLA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-boda-jewelry-box-wedding',
			eventType: 'boda',
			themeId: 'jewelry-box-wedding',
		});
		expect(
			checkPublishGuard({
				baseDemoId: PERLA_EVENT.baseDemoId,
				themeId: PERLA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a Lane A profile scoped to jewelry-box-wedding', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain(
			'.event--boda-perla-y-carlos.theme-preset--jewelry-box-wedding',
		);
		expect(profile).toContain('--perla-olive');
		expect(profile).toContain('--perla-gold');
		expect(profile).toContain('--pa-card-bg-image');
		expect(profile).toContain('--family-media-filter: none');
	});

	it('has source files for every declared asset', () => {
		for (const spec of PERLA_ASSET_SPECS) {
			const filePath = path.join(assetDir, spec.relativePath);
			expect(fs.existsSync(filePath)).toBe(true);
		}
	});

	it('builds schema-valid published content with OD2 structural contracts', () => {
		const content = buildPerlaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		if (!result.success) {
			console.error(result.error.issues);
		}

		expect(content.sectionOrder).toEqual([
			'quote',
			'countdown',
			'location',
			'family',
			'gallery',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(content).not.toHaveProperty('gifts');
		expect(content).not.toHaveProperty('music');
		expect(content).not.toHaveProperty('interludes');

		const family = content.family as {
			presentation?: string;
			groups?: Array<{ title: string; items: Array<{ name: string }> }>;
			godparents?: unknown;
		};
		expect(family.presentation).toBe('text-only');
		expect(family.godparents).toBeUndefined();
		expect(family.groups?.map((g) => g.items[0]?.name)).toEqual([
			'Por confirmar',
			'Por confirmar',
		]);
		expect(JSON.stringify(content)).not.toMatch(/\[\[PENDIENTE:/);

		const gallery = content.gallery as { items: unknown[] };
		expect(gallery.items).toHaveLength(1);

		const rsvp = content.rsvp as {
			confirmationMode?: string;
			accessMode?: string;
		};
		expect(rsvp.confirmationMode).toBe('api');
		expect(rsvp.accessMode).toBe('hybrid');

		const thankYou = content.thankYou as { image?: unknown };
		expect(thankYou.image).toBeUndefined();
	});
});
