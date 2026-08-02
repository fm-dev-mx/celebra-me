import type { ObservabilitySignal, ObservabilitySnapshot } from '@/lib/observability/types';

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

function staleIssue(): ObservabilitySignal {
	return {
		impact: 'OPERATIONAL',
		reasonCode: 'SNAPSHOT_REFRESH_FAILED',
		nextStep: 'RETRY_PROBE',
		operationalStatus: 'UNVERIFIED',
		deliveryStatus: 'ALIGNED',
		detailStatus: 'DETAIL_UNAVAILABLE',
		affectedFieldCount: 0,
		affectedSectionCount: 0,
		semanticPaths: [],
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
					freshness: 'STALE',
					operationalStatus:
						cache.snapshot.operationalStatus === 'BLOCKED' ? 'BLOCKED' : 'UNVERIFIED',
					cache: {
						refreshAfter: new Date(now() + OBSERVABILITY_CACHE_TTL_MS).toISOString(),
					},
					issues: cache.snapshot.issues.some(
						(item) => item.reasonCode === issue.reasonCode,
					)
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
