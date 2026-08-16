/**
 * Canonical evidence aggregation. Not a classifier and not a formatter.
 * UI and CLI consume the resulting tokens; they must not re-derive them.
 */
import type {
	CanonicalEnvSummary,
	EnvironmentPromotionState,
	EvidenceState,
	FreshnessMeta,
	MigrationPresence,
	TargetEnv,
} from './types';

export const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

export const CANONICAL_STATUS_CACHE_TTL_MS = 60_000;

/**
 * Aggregate evidence authority. Incomplete evidence must never become globally LIVE.
 * LIVE + UNVERIFIED → CACHED (not LIVE). All UNVERIFIED → UNVERIFIED.
 */
export function combineEvidence(states: readonly EvidenceState[]): EvidenceState {
	if (states.length === 0) return 'UNVERIFIED';
	if (states.every((state) => state === 'LIVE')) return 'LIVE';
	if (states.every((state) => state === 'UNVERIFIED')) return 'UNVERIFIED';
	if (states.includes('UNVERIFIED')) return 'CACHED';
	if (states.every((state) => state === 'CACHED')) return 'CACHED';
	return 'CACHED';
}

export function invitationAttentionCount(
	environmentsBySlug: ReadonlyMap<string, Record<TargetEnv, EnvironmentPromotionState>>,
	env: TargetEnv,
	options?: { excludeSlugs?: ReadonlySet<string> },
): number {
	let count = 0;
	for (const [slug, states] of environmentsBySlug) {
		if (options?.excludeSlugs?.has(slug)) continue;
		if (states[env] !== 'match') count += 1;
	}
	return count;
}

/**
 * Freshness from a cached (memory or disk) payload. Never LIVE — age is not authority.
 */
export function freshnessFromCachedTimestamp(
	lastVerifiedAt: string,
	nowMs: number = Date.now(),
	ttlMs: number = CANONICAL_STATUS_CACHE_TTL_MS,
): FreshnessMeta {
	const verifiedMs = new Date(lastVerifiedAt).getTime();
	if (!Number.isFinite(verifiedMs)) {
		return { status: 'UNVERIFIED', lastVerifiedAt };
	}
	const ageMs = nowMs - verifiedMs;
	return {
		status: ageMs < ttlMs ? 'CACHED' : 'STALE',
		lastVerifiedAt,
	};
}

export function liveFreshnessMeta(verifiedAt: string): FreshnessMeta {
	return { status: 'LIVE', lastVerifiedAt: verifiedAt };
}

export function migrationPresenceForEnv(
	env: Pick<CanonicalEnvSummary, 'evidence' | 'appliedCount' | 'pendingMigrations'>,
	version: string,
): MigrationPresence {
	if (env.evidence === 'UNVERIFIED' || env.appliedCount == null) return 'UNVERIFIED';
	if (env.pendingMigrations.includes(version)) return 'NOT_APPLIED';
	return 'APPLIED';
}

export function hasPersistableOperationalEvidence(evidence: EvidenceState): boolean {
	return evidence === 'LIVE' || evidence === 'CACHED';
}
