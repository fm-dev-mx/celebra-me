/**
 * Read-only managed promotion status for pnpm dbs.
 * Composes fingerprint + grouped evidence + pure decision. No apply policy.
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
import {
	decidePromotionAction,
	type PromotionAction,
	type PromotionReasonCode,
} from './promotion-decision.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

export interface PromotionStatusRow {
	slug: string;
	eventType: string;
	action: Exclude<PromotionAction, 'NONE'>;
	reasonCode: PromotionReasonCode;
}

export interface ManagedPromotionStatus {
	promotions: PromotionStatusRow[];
}

export function formatPromotionsSection(promotions: readonly PromotionStatusRow[]): string {
	if (promotions.length === 0) {
		return 'PROMOTIONS\nCURRENT\n';
	}
	const blocks = promotions.map((row) => {
		const lines = [
			row.slug,
			`  eventType: ${row.eventType}`,
			`  action: ${row.action}`,
		];
		if (row.action === 'BLOCKED' || row.action === 'UNKNOWN') {
			lines.push(`  reasonCode: ${row.reasonCode}`);
		}
		return lines.join('\n');
	});
	return `PROMOTIONS\n\n${blocks.join('\n\n')}\n`;
}

export function formatSlugPromotionLine(
	row: PromotionStatusRow | undefined,
): string {
	if (!row) return 'Promotion: (none)';
	if (row.action === 'BLOCKED' || row.action === 'UNKNOWN') {
		return `Promotion: ${row.action} (${row.reasonCode})`;
	}
	return `Promotion: ${row.action}`;
}

export async function evaluateManagedPromotionStatus(options?: {
	session?: StatusProbeSession;
	definitions?: InvitationDefinition[];
	slugs?: readonly string[];
}): Promise<ManagedPromotionStatus> {
	const session = options?.session ?? getOrCreateStatusProbeSession();
	const definitions = (options?.definitions ?? listInvitationDefinitions()).filter((definition) =>
		options?.slugs ? options.slugs.includes(definition.slug) : true,
	);
	const slugs = definitions.map((definition) => definition.slug);

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

	await mapPool(ENVS, 3, async (env) => {
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

	const promotions: PromotionStatusRow[] = [];
	for (const definition of definitions) {
		const canonical = canonicalBySlug.get(definition.slug);
		const decision = decidePromotionAction({
			canonicalAvailable: Boolean(canonical),
			local: envStates.get('local')?.get(definition.slug) ?? 'unknown',
			preview: envStates.get('preview')?.get(definition.slug) ?? 'unknown',
			production: envStates.get('production')?.get(definition.slug) ?? 'unknown',
		});
		if (decision.action === 'NONE') continue;
		promotions.push({
			slug: definition.slug,
			eventType: definition.eventType,
			action: decision.action,
			reasonCode: decision.reasonCode,
		});
	}
	promotions.sort((left, right) => left.slug.localeCompare(right.slug));
	return { promotions };
}
