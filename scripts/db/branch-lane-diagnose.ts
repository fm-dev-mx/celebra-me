/**
 * branch-lane-diagnose.ts — CLI for structured branch-lane diagnosis (JSON).
 *
 * Default mode is evidence-in / classification-out (no DB mutation).
 * Use --evidence-json <path> for dry runs and tests.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	buildConsolidatedAuthorizationPlan,
	diagnoseLocalDisposableDrift,
	evaluateGitOnlyPromotionAlternative,
	evaluateProductionBackupRequirement,
	formatLaneDirection,
	listPendingReadOnlySteps,
	mayRequestUserInput,
	summarizeMigrationSql,
	type BackupRequirementInput,
	type GitOnlyPromotionInput,
	type LocalDisposableDriftEvidence,
	type LocalDriftDiagnosis,
	type PendingMigrationSummary,
} from './branch-lane-diagnosis.ts';
import type { Finding } from './branch-lane-status.ts';

interface EvidenceFile {
	localDrift?: LocalDisposableDriftEvidence;
	gitOnly?: GitOnlyPromotionInput;
	backup?: BackupRequirementInput;
	pendingMigrationsSql?: Record<string, string>;
	completedCheckIds?: string[];
	previewMigrateNeeded?: boolean;
	productionMigrateNeeded?: boolean;
	gitWriteNeeded?: boolean;
}

function printUsage(): void {
	console.log(`Usage:
  tsx scripts/db/branch-lane-diagnose.ts --evidence-json <path> [--json]

Reads structured non-secret evidence and emits diagnosis JSON.
Does not mutate databases. Does not print credentials.
`);
}

function pendingFromEvidence(evidence: EvidenceFile): PendingMigrationSummary[] {
	return Object.entries(evidence.pendingMigrationsSql ?? {}).map(([version, sql]) => ({
		version,
		schema: summarizeMigrationSql(sql),
	}));
}

function remediationSteps(localDrift: LocalDriftDiagnosis | null): string[] {
	if (!localDrift || localDrift.requiresHumanInput) return [];
	return localDrift.automaticDisposableRemediationSteps;
}

function buildDiagnosisReport(evidence: EvidenceFile) {
	const pendingFromSql = pendingFromEvidence(evidence);
	const localDrift = evidence.localDrift
		? diagnoseLocalDisposableDrift(evidence.localDrift)
		: null;

	const gitOnly = evidence.gitOnly
		? evaluateGitOnlyPromotionAlternative({
				...evidence.gitOnly,
				pendingRemoteMigrations:
					evidence.gitOnly.pendingRemoteMigrations.length > 0
						? evidence.gitOnly.pendingRemoteMigrations
						: pendingFromSql,
			})
		: null;

	const backup = evidence.backup ? evaluateProductionBackupRequirement(evidence.backup) : null;

	const laneDirection = evidence.gitOnly
		? formatLaneDirection({
				operation: 'fast-forward',
				sourceBranch: evidence.gitOnly.sourceBranch,
				targetBranch: evidence.gitOnly.targetBranch,
				sourceSha: evidence.gitOnly.sourceSha,
				targetSha: evidence.gitOnly.targetSha,
			})
		: null;

	const remaining = listPendingReadOnlySteps(evidence.completedCheckIds ?? []);
	const blocking: Finding[] = [
		...(localDrift ? [localDrift.finding] : []),
		...(gitOnly ? [gitOnly] : []),
		...(backup?.finding ? [backup.finding] : []),
	];
	const autoRemediation = remediationSteps(localDrift);
	const remainingAutomaticSteps = [
		...remaining.filter((id) => id !== 'checkpoint-write'),
		...autoRemediation,
	];

	const authorizationPlan =
		laneDirection && gitOnly && backup
			? buildConsolidatedAuthorizationPlan({
					laneDirection,
					localDrift,
					gitOnlyPromotion: gitOnly,
					backup,
					previewMigrateNeeded: evidence.previewMigrateNeeded ?? false,
					productionMigrateNeeded: evidence.productionMigrateNeeded ?? false,
					gitWriteNeeded: evidence.gitWriteNeeded ?? false,
					remainingAutomaticSteps,
				})
			: null;

	return {
		localDrift,
		gitOnlyPromotion: gitOnly,
		backup,
		laneDirection,
		remainingAutomaticSteps: [...remaining, ...autoRemediation],
		mayRequestUserInput: mayRequestUserInput({
			remainingAutomaticSteps,
			blockingFindings: blocking,
		}),
		authorizationPlan,
	};
}

function main(): number {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printUsage();
		return 0;
	}
	const idx = args.indexOf('--evidence-json');
	if (idx === -1 || !args[idx + 1]) {
		printUsage();
		return 2;
	}
	const path = resolve(args[idx + 1]!);
	const evidence = JSON.parse(readFileSync(path, 'utf8')) as EvidenceFile;
	console.log(JSON.stringify(buildDiagnosisReport(evidence), null, 2));
	return 0;
}

if (process.argv[1]?.replaceAll('\\', '/').includes('branch-lane-diagnose')) {
	process.exit(main());
}
