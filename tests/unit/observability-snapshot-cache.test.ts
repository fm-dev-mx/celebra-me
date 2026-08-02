import { describe, expect, it, jest } from '@jest/globals';
import { ObservabilitySnapshotSchema } from '@/lib/observability/schema';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	createObservabilitySnapshotCache,
	OBSERVABILITY_CACHE_TTL_MS,
	OBSERVABILITY_STALE_FALLBACK_MS,
} from '@/lib/observability/server/snapshot-cache';
import type { ObservabilitySnapshot } from '@/lib/observability/types';
import { buildObservabilitySnapshotFixture } from '../helpers/observability-snapshot-fixture';

describe('observability snapshot contract', () => {
	it('accepts the strict browser-safe v3 payload', () => {
		expect(
			ObservabilitySnapshotSchema.parse(buildObservabilitySnapshotFixture()).schemaVersion,
		).toBe(3);
	});

	it('rejects unsupported versions and unexpected sensitive fields', () => {
		expect(() =>
			ObservabilitySnapshotSchema.parse(
				buildObservabilitySnapshotFixture({ schemaVersion: 2 as never }),
			),
		).toThrow();
		expect(() =>
			ObservabilitySnapshotSchema.parse({
				...buildObservabilitySnapshotFixture(),
				dbUrl: 'postgres://secret',
			}),
		).toThrow();
	});
});

describe('observability snapshot cache', () => {
	it('reuses a snapshot for 60 seconds and rebuilds after expiry', async () => {
		let now = 0;
		const build = jest.fn(async () => buildObservabilitySnapshotFixture());
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
		resolveBuild?.(buildObservabilitySnapshotFixture());
		await expect(Promise.all([first, second])).resolves.toHaveLength(2);
	});

	it('returns a typed stale fallback after a timeout for at most five minutes', async () => {
		let now = 0;
		let fail = false;
		const build = jest.fn(async () => {
			if (fail) {
				throw new ApiError(504, 'service_unavailable', 'aggregation timeout');
			}
			return buildObservabilitySnapshotFixture();
		});
		const cache = createObservabilitySnapshotCache({ build, now: () => now });
		await cache.get();
		fail = true;
		now = OBSERVABILITY_CACHE_TTL_MS;
		const stale = await cache.get();
		expect(stale.freshness).toBe('STALE');
		expect(stale.operationalStatus).toBe('UNVERIFIED');
		expect(stale.deliveryStatus).toBe('ALIGNED');
		expect(stale.issues[0]?.reasonCode).toBe('SNAPSHOT_REFRESH_FAILED');
		now = OBSERVABILITY_STALE_FALLBACK_MS + 1;
		await expect(cache.get()).rejects.toThrow('aggregation timeout');
	});
});
