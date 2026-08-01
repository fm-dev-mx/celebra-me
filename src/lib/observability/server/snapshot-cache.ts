import type { ObservabilityIssue, ObservabilitySnapshot } from '@/lib/observability/types';

export const OBSERVABILITY_CACHE_TTL_MS = 60_000;
export const OBSERVABILITY_STALE_FALLBACK_MS = 300_000;

interface CacheEntry {
	snapshot: ObservabilitySnapshot;
	createdAtMs: number;
}

interface SnapshotCacheOptions {
	build: () => Promise<ObservabilitySnapshot>;
	now?: () => number;
}

function staleIssue(): ObservabilityIssue {
	return {
		id: 'snapshot_refresh_failed:aggregation',
		code: 'SNAPSHOT_REFRESH_FAILED',
		severity: 'unverified',
		domain: 'data_quality',
		scope: 'Agregación',
		title: 'No se pudo actualizar el snapshot',
		description: 'Se muestra la última evidencia válida disponible; confirme su antigüedad.',
		actionIds: [],
	};
}

export function createObservabilitySnapshotCache(options: SnapshotCacheOptions): {
	get: () => Promise<ObservabilitySnapshot>;
} {
	const now = options.now ?? Date.now;
	let cache: CacheEntry | null = null;
	let inFlight: Promise<ObservabilitySnapshot> | null = null;

	async function rebuild(): Promise<ObservabilitySnapshot> {
		try {
			const snapshot = await options.build();
			cache = { snapshot, createdAtMs: now() };
			return snapshot;
		} catch (error) {
			if (cache && now() - cache.createdAtMs <= OBSERVABILITY_STALE_FALLBACK_MS) {
				const issue = staleIssue();
				return {
					...cache.snapshot,
					overallStatus:
						cache.snapshot.overallStatus === 'BLOCKED' ? 'BLOCKED' : 'UNVERIFIED',
					cache: {
						state: 'stale-fallback',
						refreshAfter: new Date(now() + OBSERVABILITY_CACHE_TTL_MS).toISOString(),
					},
					issues: cache.snapshot.issues.some((item) => item.code === issue.code)
						? cache.snapshot.issues
						: [issue, ...cache.snapshot.issues],
				};
			}
			throw error;
		}
	}

	return {
		async get() {
			if (cache && now() - cache.createdAtMs < OBSERVABILITY_CACHE_TTL_MS) {
				return cache.snapshot;
			}
			if (!inFlight) {
				inFlight = rebuild().finally(() => {
					inFlight = null;
				});
			}
			return await inFlight;
		},
	};
}
