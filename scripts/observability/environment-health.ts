/**
 * Environment matrix health for Local / Preview / Production.
 * Asset inventory is corpus-level (see snapshot.assets), not per-environment.
 *
 * Prefer a precomputed `GeneralStatusSummary` so schema/connectivity are not
 * re-probed after migration-health already consumed the same pass.
 */

import {
	evaluateGeneralStatus,
	withStatusProbeTimeout,
	type GeneralStatusSummary,
	type TargetEnv,
} from '../provision/dbs-status.ts';
import { EXPECTED_LOCAL_RENDER_CORPUS_SIZE } from '../provision/local-render-corpus/registry.ts';
import { countCorpusPresence } from './invitation-health.ts';
import type { EnvironmentHealthRow, InvitationHealthRow, SchemaLifecycleState } from './types.ts';

function connectionFromGeneral(input: {
	configured: boolean;
	reachable: boolean;
}): EnvironmentHealthRow['connection'] {
	if (!input.configured) return 'credentials_required';
	if (!input.reachable) return 'unreachable';
	return 'ok';
}

function renderParityForEnv(
	env: TargetEnv,
	invitations: readonly InvitationHealthRow[],
	reachable: boolean,
	configured: boolean,
): EnvironmentHealthRow['renderEffectiveParity'] {
	if (!configured || !reachable) return 'UNVERIFIABLE';
	const statuses = invitations.map((row) => row.environments[env].status);
	if (statuses.length === 0) return 'MISSING';

	const blocking = statuses.filter(
		(s) =>
			s === 'NOT_PRESENT' ||
			s === 'IDENTITY_CONFLICT' ||
			s === 'CREDENTIALS_REQUIRED' ||
			s === 'UNREACHABLE',
	);
	if (blocking.length === statuses.length) {
		if (statuses.every((s) => s === 'NOT_PRESENT')) return 'MISSING';
		return 'UNVERIFIABLE';
	}
	if (blocking.some((s) => s === 'NOT_PRESENT')) return 'PARTIAL_PRESENCE';

	const aligned = statuses.filter(
		(s) => s === 'MATCH_CANONICAL' || s === 'MATCH_REFERENCE',
	).length;
	const draftOnly = statuses.filter((s) => s === 'DIVERGED').length;
	const publishedMismatch = statuses.filter(
		(s) =>
			s === 'BEHIND_CANONICAL' ||
			s === 'DIVERGED_FROM_REFERENCE' ||
			s === 'IDENTITY_CONFLICT',
	).length;
	const unverifiable = statuses.filter((s) => s === 'UNVERIFIED').length;

	if (
		unverifiable > 0 &&
		aligned + draftOnly + publishedMismatch + unverifiable === statuses.length
	) {
		if (aligned === 0 && draftOnly === 0 && publishedMismatch === 0) return 'UNVERIFIABLE';
	}
	if (aligned === statuses.length) return 'ALL_ALIGNED';
	if (aligned + draftOnly === statuses.length && draftOnly > 0) return 'DRAFT_DIVERGENCE_ONLY';
	if (publishedMismatch > 0) return 'PUBLISHED_MISMATCH';
	if (blocking.length > 0) return 'PARTIAL_PRESENCE';
	return 'BEHIND_OR_CONFLICTED';
}

function stubUnprobedEnv(env: TargetEnv): EnvironmentHealthRow {
	return {
		environment: env,
		connection: 'unverified',
		runtimeIdentity: 'unknown',
		schemaLifecycle: 'UNVERIFIED',
		activeInvitationRows: 0,
		supportedCorpusPresence: `0/${EXPECTED_LOCAL_RENDER_CORPUS_SIZE}`,
		renderEffectiveParity: 'UNVERIFIABLE',
		detail: 'Not probed in this observability scope',
	};
}

export function buildEnvironmentHealth(input: {
	invitations: readonly InvitationHealthRow[];
	probeTimeoutMs?: number;
	generalStatus?: GeneralStatusSummary;
	/** Environments to include as live probes; others are stubbed as unprobed. */
	environments?: readonly TargetEnv[];
}): EnvironmentHealthRow[] {
	const timeout = input.probeTimeoutMs ?? 2_000;
	const probeEnvs: TargetEnv[] = input.environments
		? [...input.environments]
		: ['local', 'preview', 'production'];
	const general =
		input.generalStatus ?? withStatusProbeTimeout(timeout, () => evaluateGeneralStatus());
	const allEnvs: TargetEnv[] = ['local', 'preview', 'production'];

	return allEnvs.map((env) => {
		if (!probeEnvs.includes(env)) {
			return stubUnprobedEnv(env);
		}

		const status = general.environments[env];
		const presence = countCorpusPresence(input.invitations, env);
		const connection = connectionFromGeneral(status);
		const schemaLifecycle = (status.schemaLifecycle ?? 'UNVERIFIED') as SchemaLifecycleState;

		return {
			environment: env,
			connection,
			runtimeIdentity: status.targetClassification || 'unknown',
			schemaLifecycle,
			activeInvitationRows: status.activeManagedCount,
			supportedCorpusPresence: `${presence.present}/${presence.total || EXPECTED_LOCAL_RENDER_CORPUS_SIZE}`,
			renderEffectiveParity: renderParityForEnv(
				env,
				input.invitations,
				status.reachable,
				status.configured,
			),
			detail:
				status.errorDetail?.slice(0, 160) ??
				(status.identityConflictsCount > 0
					? `identityConflicts=${status.identityConflictsCount}`
					: undefined),
		};
	});
}
