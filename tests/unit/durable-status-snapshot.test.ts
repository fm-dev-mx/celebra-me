import { describe, expect, it } from '@jest/globals';
import {
	getCanonicalStatusView,
	readDurableStatusSnapshot,
	writeDurableStatusSnapshot,
} from '@/lib/status/server/canonical-status';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture';

describe('durable status snapshot and evidence hydration', () => {
	it('hydrates from durable snapshot and preserves historical evidence across reads', async () => {
		const fixture = buildCanonicalStatusViewFixture({
			generatedAt: new Date().toISOString(),
			recentMigrations: [
				{
					version: '20260806120000',
					name: '20260806120000_base.sql',
					applied: { local: true, preview: true, production: true },
					appliedAt: {
						local: '2026-08-06T12:00:00.000Z',
						preview: '2026-08-06T12:05:00.000Z',
						production: '2026-08-06T12:10:00.000Z',
					},
					verifiedAt: new Date().toISOString(),
				},
			],
		});

		await writeDurableStatusSnapshot(fixture);

		const read = await readDurableStatusSnapshot();
		expect(read).not.toBeNull();
		expect(read?.schemaVersion).toBe(1);
		expect(read?.recentMigrations?.length).toBe(1);
		expect(read?.recentMigrations?.[0]?.version).toBe('20260806120000');

		const hydratedView = await getCanonicalStatusView();
		expect(hydratedView.freshnessMeta).toBeDefined();
		expect(['LIVE', 'CACHED', 'STALE']).toContain(hydratedView.freshnessMeta?.status);
	});

	it('separates applied timestamp from dashboard verification timestamp', () => {
		const fixture = buildCanonicalStatusViewFixture({
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					applied: { local: true, preview: true, production: false },
					appliedAt: {
						local: '2026-08-06T12:00:00.000Z',
						preview: null,
						production: null,
					},
					verifiedAt: '2026-08-12T22:00:00.000Z',
				},
			],
		});

		const rec = fixture.recentMigrations![0]!;
		expect(rec.applied.local).toBe(true);
		expect(rec.applied.production).toBe(false);
		expect(rec.appliedAt.local).toBe('2026-08-06T12:00:00.000Z');
		expect(rec.appliedAt.preview).toBeNull();
		expect(rec.verifiedAt).toBe('2026-08-12T22:00:00.000Z');
	});
});
