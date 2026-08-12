/**
 * Read-only managed promotion status for pnpm dbs and the canonical status view.
 * Composes fingerprint + grouped evidence + pure decision + presentation. No apply policy.
 */
import {
	mapPool,
	readGroupedPromotionalEvidence,
	type StatusProbeSession,
} from '../status-core/index.ts';
import {
	getOrCreateStatusProbeSession,
	resolveDbUrlForEnv,
	type TargetEnv,
} from './dbs-status.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';
import {
	buildCanonicalPromotionalFingerprint,
	classifyLiveInvitation,
	type EnvironmentPromotionState,
} from './promotional-fingerprint.ts';
import { decidePromotionAction } from '../../src/lib/status/decision.ts';
import { presentPromotionRow } from '../../src/lib/status/presentation.ts';
import type {
	CanonicalPromotionRow,
	EvidenceState,
} from '../../src/lib/status/types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

export interface ManagedPromotionStatus {
	promotions: CanonicalPromotionRow[];
	inSyncSlugs: string[];
	environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	canonicalAvailableBySlug: Record<string, boolean>;
}

export function formatSlugPromotionLine(row: CanonicalPromotionRow | undefined): string {
	if (!row) return 'Publication: (none)';
	if (row.action === 'BLOCKED' || row.action === 'UNKNOWN') {
		return `Publication: ${row.action} (${row.reasonCode})`;
	}
	return `Publication: ${row.action}`;
}

export async function evaluateManagedPromotionStatus(options?: {
	session?: StatusProbeSession;
	definitions?: InvitationDefinition[];
	slugs?: readonly string[];
	environments?: readonly TargetEnv[];
}): Promise<ManagedPromotionStatus> {
	const session = options?.session ?? getOrCreateStatusProbeSession();
	const definitions = (options?.definitions ?? listInvitationDefinitions()).filter((definition) =>
		options?.slugs ? options.slugs.includes(definition.slug) : true,
	);
	const slugs = definitions.map((definition) => definition.slug);
	const probeEnvs: TargetEnv[] = options?.environments ? [...options.environments] : [...ENVS];

	const canonicalBySlug = new Map<
		string,
		{ fingerprint: string; assetKeys: readonly string[] }
	>();
	await Promise.all(
		definitions.map(async (definition) => {
			const canonical = await buildCanonicalPromotionalFingerprint(definition);
			if (canonical.ok) {
				canonicalBySlug.set(definition.slug, {
					fingerprint: canonical.fingerprint,
					assetKeys: canonical.assetKeys,
				});
			}
		}),
	);

	const envStates = new Map<TargetEnv, Map<string, EnvironmentPromotionState>>();
	const envEvidence: Record<TargetEnv, EvidenceState> = {
		local: 'UNVERIFIED',
		preview: 'UNVERIFIED',
		production: 'UNVERIFIED',
	};

	await mapPool(probeEnvs, 3, async (env) => {
		const perSlug = new Map<string, EnvironmentPromotionState>();
		envStates.set(env, perSlug);
		const { dbUrl } = resolveDbUrlForEnv(env);
		if (!dbUrl) {
			for (const slug of slugs) perSlug.set(slug, 'unknown');
			return;
		}
		const reachable = await session.probeConnectivity(dbUrl);
		if (!reachable) {
			for (const slug of slugs) perSlug.set(slug, 'unknown');
			return;
		}
		const evidence = await readGroupedPromotionalEvidence(session, dbUrl, slugs);
		if (!evidence.ok) {
			for (const slug of slugs) perSlug.set(slug, 'unknown');
			return;
		}
		envEvidence[env] = 'LIVE';
		for (const definition of definitions) {
			const canonical = canonicalBySlug.get(definition.slug);
			if (!canonical) {
				perSlug.set(definition.slug, 'unknown');
				continue;
			}
			const rows = evidence.rows.filter((row) => row.slug === definition.slug);
			perSlug.set(
				definition.slug,
				classifyLiveInvitation({
					canonicalFingerprint: canonical.fingerprint,
					canonicalAssetKeys: canonical.assetKeys,
					expectedSlug: definition.slug,
					expectedManagedIdentityId: definition.managedIdentityId,
					rows,
				}),
			);
		}
	});

	for (const env of ENVS) {
		if (envStates.has(env)) continue;
		const perSlug = new Map<string, EnvironmentPromotionState>();
		envStates.set(env, perSlug);
		for (const slug of slugs) perSlug.set(slug, 'unknown');
	}

	const environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>> = {};
	const canonicalAvailableBySlug = new Map<string, boolean>();
	for (const definition of definitions) {
		canonicalAvailableBySlug.set(definition.slug, canonicalBySlug.has(definition.slug));
		environmentsBySlug[definition.slug] = {
			local: envStates.get('local')?.get(definition.slug) ?? 'unknown',
			preview: envStates.get('preview')?.get(definition.slug) ?? 'unknown',
			production: envStates.get('production')?.get(definition.slug) ?? 'unknown',
		};
	}
	const presented = presentManagedPromotions({
		definitions,
		environmentsBySlug,
		envEvidence,
		canonicalAvailableBySlug,
	});
	return {
		promotions: presented.promotions,
		inSyncSlugs: presented.inSyncSlugs,
		environmentsBySlug,
		envEvidence,
		canonicalAvailableBySlug: Object.fromEntries(canonicalAvailableBySlug),
	};
}

export function presentManagedPromotions(input: {
	definitions: readonly InvitationDefinition[];
	environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	canonicalAvailableBySlug: ReadonlyMap<string, boolean>;
}): Pick<ManagedPromotionStatus, 'promotions' | 'inSyncSlugs'> {
	const promotions: CanonicalPromotionRow[] = [];
	const inSyncSlugs: string[] = [];
	for (const definition of input.definitions) {
		const environments = input.environmentsBySlug[definition.slug] ?? {
			local: 'unknown',
			preview: 'unknown',
			production: 'unknown',
		};
		const decision = decidePromotionAction({
			canonicalAvailable: Boolean(input.canonicalAvailableBySlug.get(definition.slug)),
			local: environments.local,
			preview: environments.preview,
			production: environments.production,
		});
		if (decision.action === 'NONE') {
			inSyncSlugs.push(definition.slug);
			continue;
		}
		promotions.push(
			presentPromotionRow({
				slug: definition.slug,
				title: definition.title,
				eventType: definition.eventType,
				action: decision.action,
				reasonCode: decision.reasonCode,
				environments,
				envEvidence: input.envEvidence,
			}),
		);
	}
	promotions.sort((left, right) => left.slug.localeCompare(right.slug));
	inSyncSlugs.sort((left, right) => left.localeCompare(right));
	return { promotions, inSyncSlugs };
}
