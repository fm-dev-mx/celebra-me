/**
 * Shared hosted migration compatibility gate.
 * Used by push-prod-migrations.ts and push-preview-migrations.ts.
 */

import {
	assertCompatibilityOrFail,
	evaluateAppDatabaseReadiness,
	evaluateMigrationDeploymentCompatibility,
	isHostedMigrateTarget,
	listMigrationVersionsAtGitSha,
	loadMigrationRolloutRegistry,
	resolveHostedMigrationIdentity,
	type DbMigrateTarget,
} from './migration-deployment-compatibility.ts';

export function runHostedMigrationCompatibilityGate(options: {
	target: DbMigrateTarget;
	candidateVersions: readonly string[];
	dbAppliedVersions: readonly string[];
	fail: (message: string) => never;
	env?: NodeJS.ProcessEnv;
}): void {
	if (!isHostedMigrateTarget(options.target)) {
		return;
	}

	const env = options.env ?? process.env;
	const identity = resolveHostedMigrationIdentity(env);
	const registry = loadMigrationRolloutRegistry();

	if (!identity.targetReleaseSha) {
		options.fail(
			'Hosted migration requires CELEBRA_TARGET_RELEASE_SHA (authorized target release Git identity). Branch name, worktree path, UI banner, and credential presence alone cannot authorize hosted mutation.',
		);
	}

	let targetReleaseMigrationVersions: string[];
	try {
		targetReleaseMigrationVersions = listMigrationVersionsAtGitSha(identity.targetReleaseSha);
	} catch (error: unknown) {
		options.fail(
			`Unable to resolve target-release migration membership for ${identity.targetReleaseSha}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	const compatibility = evaluateMigrationDeploymentCompatibility({
		target: options.target,
		targetReleaseSha: identity.targetReleaseSha,
		deployedAppSha: identity.deployedAppSha,
		deployedAppCapabilities: identity.deployedAppCapabilities,
		dbAppliedVersions: options.dbAppliedVersions,
		candidateVersions: options.candidateVersions,
		targetReleaseMigrationVersions,
		registry,
	});
	assertCompatibilityOrFail(compatibility, options.fail);

	const readiness = evaluateAppDatabaseReadiness({
		deployedAppCapabilities: identity.deployedAppCapabilities,
		dbAppliedVersions: options.dbAppliedVersions,
		candidateVersions: options.candidateVersions,
		registry,
	});
	assertCompatibilityOrFail(readiness, options.fail);

	console.info('✅ Migration / deployment compatibility contract passed.');
	console.info(`   Target release: ${identity.targetReleaseSha}`);
	if (identity.deployedAppSha) {
		console.info(`   Deployed app: ${identity.deployedAppSha}`);
	}
	if (identity.deployedAppCapabilities.length > 0) {
		console.info(`   Deployed capabilities: ${identity.deployedAppCapabilities.join(', ')}`);
	}
	for (const [version, phase] of Object.entries(compatibility.phaseByVersion)) {
		console.info(`   Candidate ${version}: phase=${phase}`);
	}
}
