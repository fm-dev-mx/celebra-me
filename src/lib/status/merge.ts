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
	ManualPatchEnvironmentStatus,
	RecentMigrationRecord,
	ManualPatchStatus,
	TargetEnv,
} from './types';

function incomingPatchReplacesPrevious(
	incoming: ManualPatchEnvironmentStatus,
	previous: ManualPatchEnvironmentStatus,
): boolean {
	if (incoming.evidence === 'UNVERIFIED' && hasPersistableOperationalEvidence(previous.evidence)) {
		return false;
	}
	return true;
}

function mergeManualPatches(
	previous: ManualPatchStatus[] | undefined,
	incoming: ManualPatchStatus[],
	probedByEnv: Record<TargetEnv, boolean>,
): ManualPatchStatus[] {
	if (!previous || previous.length === 0) return incoming;
	const previousById = new Map(previous.map((item) => [item.scriptId, item]));
	return incoming.map((item) => {
		const old = previousById.get(item.scriptId);
		if (!old) return item;
		const environments = { ...old.environments };
		for (const env of ENVS) {
			if (!probedByEnv[env]) continue;
			if (incomingPatchReplacesPrevious(item.environments[env], old.environments[env])) {
				environments[env] = item.environments[env];
			}
		}
		return { ...item, environments };
	});
}

function refreshesSchemaDomain(domain: 'schema' | 'content' | 'patch' | undefined): boolean {
	return domain !== 'content' && domain !== 'patch';
}

function refreshesContentDomain(domain: 'schema' | 'content' | 'patch' | undefined): boolean {
	return domain !== 'schema' && domain !== 'patch';
}

function refreshesPatchDomain(domain: 'schema' | 'content' | 'patch' | undefined): boolean {
	return domain !== 'schema' && domain !== 'content';
}

function preservesRecentMigrations(domain: 'schema' | 'content' | 'patch' | undefined): boolean {
	return domain === 'content' || domain === 'patch';
}

function didAcceptPatchProbe(
	previous: ManualPatchStatus[] | undefined,
	incoming: ManualPatchStatus[],
	probedByEnv: Record<TargetEnv, boolean>,
): boolean {
	if (!ENVS.some((env) => probedByEnv[env])) return false;
	if (!previous || previous.length === 0) return incoming.length > 0;
	if (incoming.length !== previous.length) return true;
	const previousById = new Map(previous.map((item) => [item.scriptId, item]));
	if (incoming.some((item) => !previousById.has(item.scriptId))) return true;
	for (const item of incoming) {
		const old = previousById.get(item.scriptId);
		if (!old) continue;
		for (const env of ENVS) {
			if (!probedByEnv[env]) continue;
			const next = item.environments[env];
			const current = old.environments[env];
			if (next.status === 'NOT_APPLICABLE' && current.status === 'NOT_APPLICABLE') continue;
			if (incomingPatchReplacesPrevious(next, current)) return true;
		}
	}
	return false;
}

function downgradeUnreplacedEnvironments(
	environments: Record<TargetEnv, CanonicalEnvSummary>,
	replaceByEnv: Record<TargetEnv, boolean>,
): void {
	for (const env of ENVS) {
		if (replaceByEnv[env]) continue;
		if (environments[env].evidence === 'LIVE') environments[env].evidence = 'CACHED';
	}
}

function mergedDisposableProof(
	previous: CanonicalStatusView,
	incoming: CanonicalStatusView,
	domain: 'schema' | 'content' | 'patch' | undefined,
	anyReplaced: boolean,
): CanonicalStatusView['disposableProof'] {
	if (domain === 'patch' || !anyReplaced) return previous.disposableProof;
	return incoming.disposableProof;
}

function mergedPatchState(
	previous: CanonicalStatusView,
	incoming: CanonicalStatusView,
	domain: 'schema' | 'content' | 'patch' | undefined,
	probedByEnv: Record<TargetEnv, boolean>,
): ManualPatchStatus[] {
	if (!refreshesPatchDomain(domain)) return previous.manualPatches;
	return mergeManualPatches(previous.manualPatches, incoming.manualPatches, probedByEnv);
}

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

function mergeSchemaEnvironments(
	environments: Record<TargetEnv, CanonicalEnvSummary>,
	previous: CanonicalStatusView,
	incoming: CanonicalStatusView,
	probedEnvs: TargetEnv[],
	replaceByEnv: Record<TargetEnv, boolean>,
): void {
	for (const env of probedEnvs) {
		if (replaceByEnv[env]) {
			environments[env] = {
				...incoming.environments[env],
				invitationAttentionCount: previous.environments[env].invitationAttentionCount,
			};
		} else {
			environments[env] = downgradePreserved(previous.environments[env]);
		}
	}
}

export function mergeCanonicalStatusView(input: {
	previous: CanonicalStatusView | null;
	incoming: CanonicalStatusView;
	env?: TargetEnv;
	domain?: 'schema' | 'content' | 'patch';
}): CanonicalStatusView {
	const previous = input.previous;
	if (!previous) return input.incoming;

	const probedEnvs: TargetEnv[] = input.env ? [input.env] : [...ENVS];
	const domain = input.domain;
	const refreshSchema = refreshesSchemaDomain(domain);
	const refreshContent = refreshesContentDomain(domain);
	const refreshPatch = refreshesPatchDomain(domain);
	const preserveRecent = preservesRecentMigrations(domain);
	const probedByEnv: Record<TargetEnv, boolean> = {
		local: false,
		preview: false,
		production: false,
	};
	const replaceByEnv: Record<TargetEnv, boolean> = {
		local: false,
		preview: false,
		production: false,
	};
	for (const env of probedEnvs) {
		probedByEnv[env] = true;
		replaceByEnv[env] = incomingReplacesPrevious(
			input.incoming.environments[env],
			previous.environments[env],
		);
	}
	const replacedEnvs = ENVS.filter((env) => replaceByEnv[env]);
	const anyPatchAccepted =
		refreshPatch &&
		didAcceptPatchProbe(previous.manualPatches, input.incoming.manualPatches, probedByEnv);
	const environments = {
		local: { ...previous.environments.local },
		preview: { ...previous.environments.preview },
		production: { ...previous.environments.production },
	};

	if (refreshSchema) mergeSchemaEnvironments(environments, previous, input.incoming, probedEnvs, replaceByEnv);

	let promotions = previous.promotions;
	let inSyncSlugs = previous.inSyncSlugs;
	let inSyncCount = previous.inSyncCount;

	if (refreshContent) {
		const res = mergeContentDomainState(previous, input.incoming, replacedEnvs, environments);
		promotions = res.promotions;
		inSyncSlugs = res.inSyncSlugs;
		inSyncCount = res.inSyncCount;
	}

	if (refreshSchema) {
		for (const env of replacedEnvs) {
			environments[env].evidence = 'LIVE';
			environments[env].probedAt = input.incoming.environments[env].probedAt;
		}
	}

	if (domain !== 'patch') downgradeUnreplacedEnvironments(environments, replaceByEnv);

	const anyReplaced = (refreshSchema || refreshContent) && replacedEnvs.length > 0;
	const anyAccepted = anyReplaced || anyPatchAccepted;
	const activeRowCounts = { ...previous.activeRowCounts };
	const identityConflictCounts = { ...previous.identityConflictCounts };
	if (refreshContent) {
		for (const env of replacedEnvs) {
			activeRowCounts[env] = input.incoming.activeRowCounts[env];
			identityConflictCounts[env] = input.incoming.identityConflictCounts[env];
		}
	}

	const refreshedDiagnosticDomains = new Set(domain ? [domain] : ['schema', 'content']);
	let diagnostics = previous.diagnostics;
	if (anyReplaced) {
		const belongsToReplacedEnvironment = (environment: TargetEnv | undefined): boolean =>
			!environment || replaceByEnv[environment];
		diagnostics = [
			...previous.diagnostics.filter(
				(item) =>
					!refreshedDiagnosticDomains.has(item.domain) ||
					!belongsToReplacedEnvironment(item.environment),
			),
			...input.incoming.diagnostics.filter(
				(item) =>
					refreshedDiagnosticDomains.has(item.domain) &&
					belongsToReplacedEnvironment(item.environment),
			),
		];
	}

	return {
		...previous,
		generatedAt: anyAccepted ? input.incoming.generatedAt : previous.generatedAt,
		evidence: combineEvidence(ENVS.map((env) => environments[env].evidence)),
		environments,
		promotions,
		inSyncSlugs,
		inSyncCount,
		disposableProof: mergedDisposableProof(previous, input.incoming, domain, anyReplaced),
		activeRowCounts,
		identityConflictCounts,
		recentMigrations: preserveRecent
			? previous.recentMigrations
			: mergeRecentMigrations(
					previous.recentMigrations,
					input.incoming.recentMigrations,
					replaceByEnv,
				),
		manualPatches: mergedPatchState(previous, input.incoming, domain, probedByEnv),
		diagnostics,
		debugCounters: input.incoming.debugCounters,
	};
}
