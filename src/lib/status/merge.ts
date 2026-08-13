/**
 * Merge a partial or failed live probe into a previous canonical view.
 * Reuses decidePromotionAction. Does not classify schema.
 */
import { decidePromotionAction } from './decision';
import {
	combineEvidence,
	ENVS,
	hasPersistableOperationalEvidence,
	invitationAttentionCount,
} from './evidence';
import { presentPromotionRow } from './presentation';
import type {
	CanonicalEnvSummary,
	CanonicalPromotionRow,
	CanonicalStatusView,
	EnvironmentPromotionState,
	EvidenceState,
	RecentMigrationRecord,
	TargetEnv,
} from './types';

function statesFromView(
	view: CanonicalStatusView,
): Map<string, Record<TargetEnv, EnvironmentPromotionState>> {
	const map = new Map<string, Record<TargetEnv, EnvironmentPromotionState>>();
	for (const slug of view.inSyncSlugs) {
		map.set(slug, { local: 'match', preview: 'match', production: 'match' });
	}
	for (const row of view.promotions) {
		map.set(row.slug, row.environments);
	}
	return map;
}

function metaFromView(view: CanonicalStatusView): Map<string, { title: string; eventType: string }> {
	const map = new Map<string, { title: string; eventType: string }>();
	for (const row of view.promotions) {
		map.set(row.slug, { title: row.title, eventType: row.eventType });
	}
	return map;
}

function canonicalAvailableFromView(view: CanonicalStatusView, slug: string): boolean {
	const row = view.promotions.find((item) => item.slug === slug);
	return row?.reasonCode !== 'CANONICAL_UNAVAILABLE';
}

function incomingReplacesPrevious(
	incoming: CanonicalEnvSummary,
	previous: CanonicalEnvSummary,
): boolean {
	if (
		incoming.evidence === 'UNVERIFIED' &&
		hasPersistableOperationalEvidence(previous.evidence)
	) {
		return false;
	}
	return true;
}

function downgradePreserved(summary: CanonicalEnvSummary): CanonicalEnvSummary {
	if (summary.evidence === 'LIVE') {
		return { ...summary, evidence: 'CACHED' };
	}
	return summary;
}

function mergeRecentMigrations(
	previous: RecentMigrationRecord[] | undefined,
	incoming: RecentMigrationRecord[] | undefined,
	replaceByEnv: Record<TargetEnv, boolean>,
): RecentMigrationRecord[] | undefined {
	const replacedEnvs = ENVS.filter((env) => replaceByEnv[env]);
	if (replacedEnvs.length === 0) return previous;
	if (!previous || previous.length === 0) return incoming;
	if (!incoming || incoming.length === 0) return previous;

	const byVersion = new Map<string, RecentMigrationRecord>();
	for (const rec of previous) {
		byVersion.set(rec.version, {
			...rec,
			presence: { ...rec.presence },
			verifiedAt: { ...rec.verifiedAt },
		});
	}
	for (const rec of incoming) {
		const current = byVersion.get(rec.version) ?? {
			version: rec.version,
			name: rec.name,
			presence: { local: 'UNVERIFIED', preview: 'UNVERIFIED', production: 'UNVERIFIED' },
			verifiedAt: { local: null, preview: null, production: null },
		};
		for (const env of replacedEnvs) {
			current.presence[env] = rec.presence[env];
			current.verifiedAt[env] = rec.verifiedAt[env];
		}
		if (rec.name && !current.name) current.name = rec.name;
		byVersion.set(rec.version, current);
	}
	return [...byVersion.values()].sort((left, right) => right.version.localeCompare(left.version));
}

function mergeContentDomainState(
	previous: CanonicalStatusView,
	incoming: CanonicalStatusView,
	replacedEnvs: readonly TargetEnv[],
	environments: Record<TargetEnv, CanonicalStatusView['environments'][TargetEnv]>,
): {
	promotions: CanonicalPromotionRow[];
	inSyncSlugs: string[];
	inSyncCount: number;
} {
	if (replacedEnvs.length === 0) {
		return {
			promotions: previous.promotions,
			inSyncSlugs: previous.inSyncSlugs,
			inSyncCount: previous.inSyncCount,
		};
	}

	const previousStates = statesFromView(previous);
	const incomingStates = statesFromView(incoming);
	const merged = new Map(previousStates);
	for (const [slug, states] of incomingStates) {
		const current = merged.get(slug) ?? {
			local: 'unknown' as const,
			preview: 'unknown' as const,
			production: 'unknown' as const,
		};
		const next = { ...current };
		for (const env of replacedEnvs) {
			next[env] = states[env];
		}
		merged.set(slug, next);
	}
	const meta = new Map([...metaFromView(previous), ...metaFromView(incoming)]);
	const envEvidence: Record<TargetEnv, EvidenceState> = {
		local: environments.local.evidence,
		preview: environments.preview.evidence,
		production: environments.production.evidence,
	};
	const nextPromotions: CanonicalPromotionRow[] = [];
	const nextInSync: string[] = [];
	for (const [slug, environmentsForSlug] of merged) {
		const info = meta.get(slug) ?? { title: slug, eventType: 'unknown' };
		const decision = decidePromotionAction({
			canonicalAvailable:
				canonicalAvailableFromView(incoming, slug) &&
				canonicalAvailableFromView(previous, slug),
			...environmentsForSlug,
		});
		if (decision.action === 'NONE') {
			nextInSync.push(slug);
			continue;
		}
		nextPromotions.push(
			presentPromotionRow({
				slug,
				title: info.title,
				eventType: info.eventType,
				action: decision.action,
				reasonCode: decision.reasonCode,
				environments: environmentsForSlug,
				envEvidence,
			}),
		);
	}
	nextPromotions.sort((left, right) => left.slug.localeCompare(right.slug));
	nextInSync.sort((left, right) => left.localeCompare(right));
	for (const env of ENVS) {
		environments[env].invitationAttentionCount = invitationAttentionCount(merged, env);
	}
	for (const env of replacedEnvs) {
		environments[env].identityConflictsCount = incoming.environments[env].identityConflictsCount;
	}

	return {
		promotions: nextPromotions,
		inSyncSlugs: nextInSync,
		inSyncCount: nextInSync.length,
	};
}

export function mergeCanonicalStatusView(input: {
	previous: CanonicalStatusView | null;
	incoming: CanonicalStatusView;
	env?: TargetEnv;
	domain?: 'schema' | 'content';
}): CanonicalStatusView {
	const previous = input.previous;
	if (!previous) return input.incoming;

	const probedEnvs: TargetEnv[] = input.env ? [input.env] : [...ENVS];
	const domain = input.domain;
	const replaceByEnv: Record<TargetEnv, boolean> = {
		local: false,
		preview: false,
		production: false,
	};
	for (const env of probedEnvs) {
		replaceByEnv[env] = incomingReplacesPrevious(
			input.incoming.environments[env],
			previous.environments[env],
		);
	}
	const replacedEnvs = ENVS.filter((env) => replaceByEnv[env]);
	const environments = {
		local: { ...previous.environments.local },
		preview: { ...previous.environments.preview },
		production: { ...previous.environments.production },
	};

	if (domain !== 'content') {
		for (const env of probedEnvs) {
			if (replaceByEnv[env]) {
				environments[env] = {
					...input.incoming.environments[env],
					invitationAttentionCount: previous.environments[env].invitationAttentionCount,
				};
			} else {
				environments[env] = downgradePreserved(previous.environments[env]);
			}
		}
	}

	let promotions = previous.promotions;
	let inSyncSlugs = previous.inSyncSlugs;
	let inSyncCount = previous.inSyncCount;

	if (domain !== 'schema') {
		const res = mergeContentDomainState(previous, input.incoming, replacedEnvs, environments);
		promotions = res.promotions;
		inSyncSlugs = res.inSyncSlugs;
		inSyncCount = res.inSyncCount;
	}

	if (domain !== 'content') {
		for (const env of replacedEnvs) {
			environments[env].evidence = 'LIVE';
			environments[env].probedAt = input.incoming.environments[env].probedAt;
		}
	}

	for (const env of ENVS) {
		if (replaceByEnv[env]) continue;
		if (environments[env].evidence === 'LIVE') environments[env].evidence = 'CACHED';
	}

	const anyReplaced = replacedEnvs.length > 0;
	const activeRowCounts = { ...previous.activeRowCounts };
	const identityConflictCounts = { ...previous.identityConflictCounts };
	if (domain !== 'schema') {
		for (const env of replacedEnvs) {
			activeRowCounts[env] = input.incoming.activeRowCounts[env];
			identityConflictCounts[env] = input.incoming.identityConflictCounts[env];
		}
	}

	let diagnostics = previous.diagnostics;
	if (domain !== 'schema' && anyReplaced) {
		diagnostics = [
			...previous.diagnostics.filter(
				(item) => !item.environment || !replaceByEnv[item.environment],
			),
			...input.incoming.diagnostics.filter(
				(item) => !item.environment || replaceByEnv[item.environment],
			),
		];
	}

	return {
		...previous,
		generatedAt: anyReplaced ? input.incoming.generatedAt : previous.generatedAt,
		evidence: combineEvidence(ENVS.map((env) => environments[env].evidence)),
		environments,
		promotions,
		inSyncSlugs,
		inSyncCount,
		disposableProof: anyReplaced ? input.incoming.disposableProof : previous.disposableProof,
		activeRowCounts,
		identityConflictCounts,
		recentMigrations:
			domain === 'content'
				? previous.recentMigrations
				: mergeRecentMigrations(
						previous.recentMigrations,
						input.incoming.recentMigrations,
						replaceByEnv,
					),
		diagnostics,
		debugCounters: input.incoming.debugCounters,
	};
}
