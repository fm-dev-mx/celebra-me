/**
 * Merge a partial live probe into a previous canonical view. Reuses decidePromotionAction.
 */
import { decidePromotionAction } from './decision';
import { invitationAttentionCount, presentPromotionRow } from './presentation';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	EnvironmentPromotionState,
	EvidenceState,
	TargetEnv,
} from './types';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function statesFromView(
	view: CanonicalStatusView,
): Map<string, Record<TargetEnv, EnvironmentPromotionState>> {
	const map = new Map<string, Record<TargetEnv, EnvironmentPromotionState>>();
	for (const slug of view.inSyncSlugs) {
		map.set(slug, { local: 'match', preview: 'match', production: 'match' });
	}
	for (const row of view.promotions) {
		map.set(slugStatesKey(row), row.environments);
	}
	return map;
}

function slugStatesKey(row: CanonicalPromotionRow): string {
	return row.slug;
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

export function mergeCanonicalStatusView(input: {
	previous: CanonicalStatusView | null;
	incoming: CanonicalStatusView;
	env?: TargetEnv;
	domain?: 'schema' | 'content';
}): CanonicalStatusView {
	const previous = input.previous;
	if (!previous || !input.env) {
		return {
			...input.incoming,
			evidence: input.incoming.evidence === 'LIVE' ? 'LIVE' : input.incoming.evidence,
		};
	}

	const probed = input.env;
	const domain = input.domain;
	const environments = {
		local: { ...previous.environments.local },
		preview: { ...previous.environments.preview },
		production: { ...previous.environments.production },
	};

	if (domain !== 'content') {
		environments[probed] = {
			...input.incoming.environments[probed],
			invitationAttentionCount: previous.environments[probed].invitationAttentionCount,
		};
	}

	let promotions = previous.promotions;
	let inSyncSlugs = previous.inSyncSlugs;
	let inSyncCount = previous.inSyncCount;

	if (domain !== 'schema') {
		const previousStates = statesFromView(previous);
		const incomingStates = statesFromView(input.incoming);
		const merged = new Map(previousStates);
		for (const [slug, states] of incomingStates) {
			const current = merged.get(slug) ?? {
				local: 'unknown' as const,
				preview: 'unknown' as const,
				production: 'unknown' as const,
			};
			merged.set(slug, { ...current, [probed]: states[probed] });
		}
		const meta = new Map([...metaFromView(previous), ...metaFromView(input.incoming)]);
		const envEvidence: Record<TargetEnv, EvidenceState> = {
			local: probed === 'local' ? 'LIVE' : previous.environments.local.evidence === 'LIVE' ? 'CACHED' : previous.environments.local.evidence,
			preview:
				probed === 'preview'
					? 'LIVE'
					: previous.environments.preview.evidence === 'LIVE'
						? 'CACHED'
						: previous.environments.preview.evidence,
			production:
				probed === 'production'
					? 'LIVE'
					: previous.environments.production.evidence === 'LIVE'
						? 'CACHED'
						: previous.environments.production.evidence,
		};
		const nextPromotions: CanonicalPromotionRow[] = [];
		const nextInSync: string[] = [];
		for (const [slug, environmentsForSlug] of merged) {
			const info = meta.get(slug) ?? { title: slug, eventType: 'unknown' };
			const decision = decidePromotionAction({
				canonicalAvailable: canonicalAvailableFromView(input.incoming, slug) &&
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
		promotions = nextPromotions;
		inSyncSlugs = nextInSync;
		inSyncCount = nextInSync.length;
		for (const env of ENVS) {
			environments[env].invitationAttentionCount = invitationAttentionCount(merged, env);
		}
		environments[probed].identityConflictsCount =
			input.incoming.environments[probed].identityConflictsCount;
	}

	if (domain !== 'content') {
		environments[probed].evidence = 'LIVE';
		environments[probed].probedAt = input.incoming.environments[probed].probedAt;
	}

	for (const env of ENVS) {
		if (env === probed) continue;
		if (environments[env].evidence === 'LIVE') environments[env].evidence = 'CACHED';
	}

	return {
		...previous,
		generatedAt: input.incoming.generatedAt,
		evidence: 'CACHED',
		environments,
		promotions,
		inSyncSlugs,
		inSyncCount,
		disposableProof: input.incoming.disposableProof,
		activeRowCounts:
			domain === 'schema'
				? previous.activeRowCounts
				: {
						...previous.activeRowCounts,
						[probed]: input.incoming.activeRowCounts[probed],
					},
		identityConflictCounts:
			domain === 'schema'
				? previous.identityConflictCounts
				: {
						...previous.identityConflictCounts,
						[probed]: input.incoming.identityConflictCounts[probed],
					},
		diagnostics:
			domain === 'schema'
				? previous.diagnostics
				: [
						...previous.diagnostics.filter(
							(item) => item.environment && item.environment !== probed,
						),
						...input.incoming.diagnostics.filter(
							(item) => !item.environment || item.environment === probed,
						),
					],
		debugCounters: input.incoming.debugCounters,
	};
}
