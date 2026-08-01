import { describe, expect, it, jest } from '@jest/globals';
import { ObservabilitySnapshotSchema } from '@/lib/observability/schema';
import {
	createObservabilitySnapshotCache,
	OBSERVABILITY_CACHE_TTL_MS,
	OBSERVABILITY_STALE_FALLBACK_MS,
} from '@/lib/observability/server/snapshot-cache';
import type { ObservabilitySnapshot } from '@/lib/observability/types';

function snapshot(): ObservabilitySnapshot {
	const empty = { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 };
	return {
		schemaVersion: 2,
		generatedAt: '2026-08-01T12:00:00.000Z',
		overallStatus: 'HEALTHY',
		cache: { state: 'fresh', refreshAfter: '2026-08-01T12:01:00.000Z' },
		source: { branch: 'dev-local', commitShaShort: 'abcdef1234', workingTreeDirty: false },
		health: {
			environments: empty,
			invitations: empty,
			migrations: empty,
			assets: empty,
			validations: { total: 2, ok: 2, warning: 0, blocking: 0, unverified: 0 },
		},
		issues: [],
		validationEvidence: [
			{
				type: 'regression',
				freshness: 'PASS',
				completedAt: '2026-08-01T12:00:00.000Z',
				passed: 13,
				total: 13,
			},
			{
				type: 'screenshots',
				freshness: 'PASS',
				completedAt: '2026-08-01T12:00:00.000Z',
				passed: 13,
				total: 13,
			},
		],
		recommendedActions: [],
	};
}

describe('observability snapshot contract', () => {
	it('accepts the strict browser-safe v2 payload', () => {
		expect(ObservabilitySnapshotSchema.parse(snapshot()).schemaVersion).toBe(2);
	});

	it('rejects unexpected sensitive fields and unsafe commands', () => {
		expect(() =>
			ObservabilitySnapshotSchema.parse({ ...snapshot(), dbUrl: 'postgres://secret' }),
		).toThrow();
		expect(() =>
			ObservabilitySnapshotSchema.parse({
				...snapshot(),
				recommendedActions: [
					{ id: 'x', label: 'X', command: 'pnpm db:prod:migrate', reason: 'X' },
				],
			}),
		).toThrow();
	});
});

describe('observability snapshot cache', () => {
	it('reuses a snapshot for 60 seconds and rebuilds after expiry', async () => {
		let now = 0;
		const build = jest.fn(async () => snapshot());
		const cache = createObservabilitySnapshotCache({ build, now: () => now });
		await cache.get();
		now = OBSERVABILITY_CACHE_TTL_MS - 1;
		await cache.get();
		expect(build).toHaveBeenCalledTimes(1);
		now = OBSERVABILITY_CACHE_TTL_MS;
		await cache.get();
		expect(build).toHaveBeenCalledTimes(2);
	});

	it('deduplicates concurrent rebuilds', async () => {
		let resolveBuild: ((value: ObservabilitySnapshot) => void) | undefined;
		const build = jest.fn(
			() => new Promise<ObservabilitySnapshot>((resolve) => (resolveBuild = resolve)),
		);
		const cache = createObservabilitySnapshotCache({ build, now: () => 0 });
		const first = cache.get();
		const second = cache.get();
		expect(build).toHaveBeenCalledTimes(1);
		resolveBuild?.(snapshot());
		await expect(Promise.all([first, second])).resolves.toHaveLength(2);
	});

	it('returns a marked stale fallback for at most five minutes', async () => {
		let now = 0;
		let fail = false;
		const build = jest.fn(async () => {
			if (fail) throw new Error('probe failed');
			return snapshot();
		});
		const cache = createObservabilitySnapshotCache({ build, now: () => now });
		await cache.get();
		fail = true;
		now = OBSERVABILITY_CACHE_TTL_MS;
		const stale = await cache.get();
		expect(stale.cache.state).toBe('stale-fallback');
		expect(stale.overallStatus).toBe('UNVERIFIED');
		expect(stale.issues[0]?.code).toBe('SNAPSHOT_REFRESH_FAILED');
		now = OBSERVABILITY_STALE_FALLBACK_MS + 1;
		await expect(cache.get()).rejects.toThrow('probe failed');
	});
});
