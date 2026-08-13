import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
	getCanonicalStatusView,
	readOperationalStatusCache,
	resetCanonicalStatusRuntimeForTests,
	setOperationalStatusCachePathForTests,
	writeOperationalStatusCache,
} from '@/lib/status/server/canonical-status';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture';

const LEGACY_SNAPSHOT = join(process.cwd(), '.agent', 'status-snapshot.json');

describe('local operational status cache', () => {
	let tempDir: string;
	let cacheFile: string;

	beforeEach(() => {
		resetCanonicalStatusRuntimeForTests();
		tempDir = mkdtempSync(join(tmpdir(), 'celebra-status-cache-'));
		cacheFile = join(tempDir, 'canonical-status.json');
		setOperationalStatusCachePathForTests(cacheFile);
	});

	afterEach(() => {
		resetCanonicalStatusRuntimeForTests();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('hydrates from isolated cache as CACHED, never LIVE from age', async () => {
		const fixture = buildCanonicalStatusViewFixture({
			generatedAt: new Date().toISOString(),
			evidence: 'LIVE',
			freshnessMeta: { status: 'LIVE', lastVerifiedAt: new Date().toISOString() },
			recentMigrations: [
				{
					version: '20260806120000',
					name: '20260806120000_base.sql',
					presence: { local: 'APPLIED', preview: 'APPLIED', production: 'APPLIED' },
					verifiedAt: {
						local: new Date().toISOString(),
						preview: new Date().toISOString(),
						production: new Date().toISOString(),
					},
				},
			],
		});

		await writeOperationalStatusCache(fixture);
		resetCanonicalStatusRuntimeForTests();
		setOperationalStatusCachePathForTests(cacheFile);

		const read = await readOperationalStatusCache();
		expect(read).not.toBeNull();
		expect(read?.recentMigrations?.[0]?.presence.local).toBe('APPLIED');

		const hydrated = await getCanonicalStatusView();
		expect(hydrated.evidence).toBe('CACHED');
		expect(hydrated.freshnessMeta?.status).toBe('CACHED');
		expect(hydrated.freshnessMeta?.status).not.toBe('LIVE');
		expect(existsSync(cacheFile)).toBe(true);
	});

	it('classifies an old cache entry as STALE rather than LIVE', async () => {
		const fixture = buildCanonicalStatusViewFixture({
			generatedAt: '2020-01-01T00:00:00.000Z',
			freshnessMeta: { status: 'LIVE', lastVerifiedAt: '2020-01-01T00:00:00.000Z' },
		});
		await writeOperationalStatusCache(fixture);
		resetCanonicalStatusRuntimeForTests();
		setOperationalStatusCachePathForTests(cacheFile);

		const hydrated = await getCanonicalStatusView();
		expect(hydrated.freshnessMeta?.status).toBe('STALE');
		expect(hydrated.evidence).toBe('CACHED');
	});

	it('does not persist UNVERIFIED local stubs and does not write the legacy snapshot', async () => {
		const stub = buildCanonicalStatusViewFixture({
			evidence: 'UNVERIFIED',
			environments: {
				local: {
					...buildCanonicalStatusViewFixture().environments.local,
					evidence: 'UNVERIFIED',
					appliedCount: null,
				},
				preview: {
					...buildCanonicalStatusViewFixture().environments.preview,
					evidence: 'UNVERIFIED',
					appliedCount: null,
				},
				production: {
					...buildCanonicalStatusViewFixture().environments.production,
					evidence: 'UNVERIFIED',
					appliedCount: null,
				},
			},
		});
		const legacyBefore = existsSync(LEGACY_SNAPSHOT);
		await writeOperationalStatusCache(stub);
		expect(existsSync(cacheFile)).toBe(false);
		expect(existsSync(LEGACY_SNAPSHOT)).toBe(legacyBefore);
	});

	it('separates probe verification time from application time', () => {
		const fixture = buildCanonicalStatusViewFixture({
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					presence: { local: 'APPLIED', preview: 'APPLIED', production: 'NOT_APPLIED' },
					verifiedAt: {
						local: '2026-08-12T22:00:00.000Z',
						preview: '2026-08-12T22:00:00.000Z',
						production: '2026-08-12T22:00:00.000Z',
					},
				},
			],
		});
		const rec = fixture.recentMigrations![0]!;
		expect(rec.presence.local).toBe('APPLIED');
		expect(rec.presence.production).toBe('NOT_APPLIED');
		expect(rec).not.toHaveProperty('appliedAt');
		expect(rec.verifiedAt.local).toBe('2026-08-12T22:00:00.000Z');
	});
});
