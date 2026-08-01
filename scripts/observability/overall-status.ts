/**
 * Normalized overall observability health.
 * Never HEALTHY when required evidence is unreachable, stale, invalid, or absent.
 * Local-first: Preview/Production probe gaps degrade to ATTENTION, not Local BLOCKED.
 */

import type {
	AssetHealthRow,
	EnvironmentHealthRow,
	EvidenceFreshness,
	InvitationHealthRow,
	MigrationEnvHealth,
	OverallStatus,
	ValidationEvidenceView,
} from './types.ts';

function evidenceBlocksHealthy(freshness: EvidenceFreshness): boolean {
	return freshness !== 'PASS';
}

function isBlocked(input: {
	localEnv: EnvironmentHealthRow | undefined;
	localMigration: MigrationEnvHealth | undefined;
	invitations: readonly InvitationHealthRow[];
	assets: readonly AssetHealthRow[];
	corpusComplete: boolean;
	evidenceFail: boolean;
}): boolean {
	const localConnectionBad =
		input.localEnv?.connection === 'unreachable' ||
		input.localEnv?.connection === 'credentials_required';
	const localSchemaDrift = input.localMigration?.schemaLifecycle === 'SCHEMA_DRIFT';
	const missingLocalCorpus = input.invitations.some(
		(row) => row.environments.local.status === 'NOT_PRESENT',
	);
	const localIdentityConflict = input.invitations.some(
		(row) => row.environments.local.status === 'IDENTITY_CONFLICT',
	);
	const missingRequiredAssets = input.assets.some(
		(a) =>
			a.status === 'MISSING' &&
			(a.assetStrategy === 'VERSIONED_MANAGED_ASSET' ||
				a.assetStrategy === 'VERSIONED_LOCAL_ASSET'),
	);

	return (
		localConnectionBad ||
		localSchemaDrift ||
		missingLocalCorpus ||
		!input.corpusComplete ||
		localIdentityConflict ||
		missingRequiredAssets ||
		input.evidenceFail
	);
}

function isLocalUnverified(
	localEnv: EnvironmentHealthRow | undefined,
	localMigration: MigrationEnvHealth | undefined,
	invitations: readonly InvitationHealthRow[],
	assets: readonly AssetHealthRow[],
): boolean {
	return (
		localEnv?.connection === 'unverified' ||
		localMigration?.schemaLifecycle === 'UNVERIFIED' ||
		localEnv?.renderEffectiveParity === 'UNVERIFIABLE' ||
		invitations.some((row) => row.environments.local.status === 'UNVERIFIED') ||
		assets.some((a) => a.status === 'UNVERIFIED')
	);
}

function isLocalAttention(
	localEnv: EnvironmentHealthRow | undefined,
	localMigration: MigrationEnvHealth | undefined,
	invitations: readonly InvitationHealthRow[],
	assets: readonly AssetHealthRow[],
): boolean {
	const parityAttention =
		localEnv?.renderEffectiveParity === 'DRAFT_DIVERGENCE_ONLY' ||
		localEnv?.renderEffectiveParity === 'PUBLISHED_MISMATCH' ||
		localEnv?.renderEffectiveParity === 'PARTIAL_PRESENCE' ||
		localEnv?.renderEffectiveParity === 'BEHIND_OR_CONFLICTED';
	const inviteAttention = invitations.some((row) => {
		const s = row.environments.local.status;
		return s === 'BEHIND_CANONICAL' || s === 'DIVERGED' || s === 'DIVERGED_FROM_REFERENCE';
	});
	return (
		localMigration?.schemaLifecycle === 'BEHIND' ||
		parityAttention ||
		inviteAttention ||
		assets.some((a) => a.status === 'PARTIAL' || a.status === 'MISSING')
	);
}

function isRemoteAttention(environments: readonly EnvironmentHealthRow[]): boolean {
	return environments.some((env) => {
		if (env.environment === 'local') return false;
		// Summary / scoped probes leave remotes as unverified — do not penalize overall status.
		if (env.connection === 'unverified') return false;
		return (
			env.connection !== 'ok' ||
			env.renderEffectiveParity === 'PUBLISHED_MISMATCH' ||
			env.renderEffectiveParity === 'BEHIND_OR_CONFLICTED' ||
			env.renderEffectiveParity === 'PARTIAL_PRESENCE'
		);
	});
}

function evidenceUnverified(
	regression: ValidationEvidenceView,
	screenshots: ValidationEvidenceView,
): boolean {
	return (
		regression.freshness === 'NOT_RUN' ||
		screenshots.freshness === 'NOT_RUN' ||
		regression.freshness === 'INVALID' ||
		screenshots.freshness === 'INVALID'
	);
}

export function computeOverallStatus(input: {
	environments: readonly EnvironmentHealthRow[];
	invitations: readonly InvitationHealthRow[];
	migrations: readonly MigrationEnvHealth[];
	assets: readonly AssetHealthRow[];
	regression: ValidationEvidenceView;
	screenshots: ValidationEvidenceView;
	corpusComplete: boolean;
}): OverallStatus {
	const { invitations, migrations, assets, regression, screenshots } = input;
	const localEnv = input.environments.find((env) => env.environment === 'local');
	const localMigration = migrations.find((m) => m.environment === 'local');
	const evidenceFail = regression.freshness === 'FAIL' || screenshots.freshness === 'FAIL';
	const evidenceMissingOrBad =
		evidenceBlocksHealthy(regression.freshness) || evidenceBlocksHealthy(screenshots.freshness);

	if (
		isBlocked({
			localEnv,
			localMigration,
			invitations,
			assets,
			corpusComplete: input.corpusComplete,
			evidenceFail,
		})
	) {
		return 'BLOCKED';
	}

	const localUnverified = isLocalUnverified(localEnv, localMigration, invitations, assets);
	const localAttention = isLocalAttention(localEnv, localMigration, invitations, assets);
	const remoteAttention = isRemoteAttention(input.environments);

	if (evidenceMissingOrBad) {
		if (evidenceUnverified(regression, screenshots) || localUnverified) return 'UNVERIFIED';
		return 'ATTENTION';
	}

	if (localUnverified) return 'UNVERIFIED';
	if (localAttention || remoteAttention) return 'ATTENTION';

	if (
		regression.freshness === 'PASS' &&
		screenshots.freshness === 'PASS' &&
		localEnv?.renderEffectiveParity === 'ALL_ALIGNED' &&
		(localMigration?.schemaLifecycle === 'CURRENT' || !localMigration)
	) {
		return 'HEALTHY';
	}

	return 'ATTENTION';
}
