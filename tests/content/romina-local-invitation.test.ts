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
		expect(sql).toContain('ROMINA_ASSET');
		expect(sql).not.toMatch(/Prueba local|guest_invitations/i);
	});

	it('contains zero operator placeholders in the generated SQL', () => {
		const sql = readFileSync(resolve(process.cwd(), ROMINA_SQL_PATCH_PATH), 'utf8');

		// Neither __OWNER_USER_ID__ nor __SUPABASE_PROJECT_URL__ should appear
		expect(sql).not.toMatch(/__OWNER_USER_ID__/);
		expect(sql).not.toMatch(/__SUPABASE_PROJECT_URL__/);

		// Only asset placeholders (runtime-resolved) are allowed
		const allBare = sql.match(/__[A-Z][A-Z_]+[A-Z]__/g) ?? [];
		const assetPrefixes = ['__ROMINA_ASSET_ID_', '__ROMINA_ASSET_URL_'];
		const unexpected = allBare.filter(
			(p) => !assetPrefixes.some((pref) => p.startsWith(pref)),
		);
		expect(unexpected).toHaveLength(0);

		// Verify that both session settings are read
		expect(sql).toContain("current_setting('app.owner_user_id'");
		expect(sql).toContain("current_setting('app.supabase_project_url'");
	});

	it('performs owner validation before mutation', () => {
		const sql = readFileSync(resolve(process.cwd(), ROMINA_SQL_PATCH_PATH), 'utf8');

		// Owner input is read from session config and validated as UUID
		expect(sql).toContain("current_setting('app.owner_user_id'");
		expect(sql).toContain('v_owner_id_text::uuid');
		expect(sql).toMatch(/not a valid UUID/);

		// Owner existence in auth.users is verified
		expect(sql).toContain('auth.users');
		expect(sql).toContain('does not exist in auth.users');

		// Conflicting ownership is checked and aborted
		expect(sql).toMatch(/existing invitation is owned by a different user/);
		expect(sql).toMatch(/existing event records have a different owner/);
		expect(sql).toMatch(/Aborting to prevent silent reassignment/);
	});

	it('validates supabase_project_url from session before mutation', () => {
		const sql = readFileSync(resolve(process.cwd(), ROMINA_SQL_PATCH_PATH), 'utf8');

		// URL is read from current_setting (injected by runner)
		expect(sql).toContain("current_setting('app.supabase_project_url'");
		expect(sql).toMatch(/supabase_project_url is not configured/);
		expect(sql).toMatch(/valid HTTPS URL/);
	});

	it('detects SQL divergence between generator and checked-in artifact', () => {
		const sql = readFileSync(resolve(process.cwd(), ROMINA_SQL_PATCH_PATH), 'utf8');

		// The parity test already verifies sql === buildRominaInvitationSql().
		const sqlFromGenerator = buildRominaInvitationSql();
		expect(sql).toBe(sqlFromGenerator);

		// Verify the SQL contains the generated marker and the generator is the
		// canonical source (not a hand-edit artifact).
		expect(sql).toMatch(/Do not hand-edit/);
	});
});
