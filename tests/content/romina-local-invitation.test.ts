import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	type RominaAssetMap,
} from '../../scripts/dev/romina-invitation-data';
import {
	buildRominaInvitationSql,
	ROMINA_SQL_PATCH_PATH,
} from '../../scripts/dev/generate-romina-invitation-sql';

function buildTestAssets(): RominaAssetMap {
	return Object.fromEntries(
		ROMINA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as RominaAssetMap;
}

describe('Romina local invitation content', () => {
	it('uses an internally consistent Premiere Floral catalog entry', () => {
		const preset = findDemoPreset(ROMINA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-premiere-floral',
			eventType: 'xv',
			themeId: 'premiere-floral',
		});
		expect(
			checkPublishGuard({
				baseDemoId: ROMINA_EVENT.baseDemoId,
				themeId: ROMINA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('builds schema-valid published content without visible pending placeholders', () => {
		const content = buildRominaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		expect(JSON.stringify(content)).not.toMatch(/PENDING_|PROVISIONAL_/);
		expect(content).toMatchObject({
			eventType: 'xv',
			visualProfileId: 'romina-rios-chaparro',
			_assetSlug: 'romina-rios-chaparro',
			theme: { preset: 'premiere-floral' },
			eventTiming: {
				localDateTime: '2026-08-14T17:00',
				timeZone: 'America/Chihuahua',
				startsAtUtc: '2026-08-14T23:00:00.000Z',
			},
			rsvp: { accessMode: 'personalized-only' },
			thankYou: { closingName: 'Romina', date: '14 de agosto de 2026' },
		});
		expect(result.data!.gallery!.items).toHaveLength(9);
		expect(content).not.toHaveProperty('music');
		expect(content).not.toHaveProperty('gifts');
	});

	it('keeps the checked-in SQL artifact generated from the canonical typed invitation data', () => {
		const sql = readFileSync(resolve(process.cwd(), ROMINA_SQL_PATCH_PATH), 'utf8');
		expect(sql).toBe(buildRominaInvitationSql());
		expect(sql).toContain(ROMINA_EVENT.slug);
		expect(sql).toContain(ROMINA_EVENT.visualProfileId);
		expect(sql).toContain('__ROMINA_ASSET_ID_hero__');
		expect(sql).not.toMatch(/Prueba local|guest_invitations/i);
	});
});
