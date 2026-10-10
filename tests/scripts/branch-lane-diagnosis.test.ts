import { describe, it, expect } from '@jest/globals';
import { createFinding } from '../../scripts/db/branch-lane-status';
import {
	buildConsolidatedAuthorizationPlan,
	buildNineSectionReport,
	createMissingCredentialsFinding,
	diagnoseLocalDisposableDrift,
	evaluateGitOnlyPromotionAlternative,
	evaluateProductionBackupRequirement,
	formatLaneDirection,
	listPendingReadOnlySteps,
	mayRequestUserInput,
	summarizeMigrationSql,
} from '../../scripts/db/branch-lane-diagnosis';
import {
	executeVerifiedDisposableRebuild,
	verifyDisposableRebuildTarget,
} from '../../scripts/db/branch-lane-disposable-remediate';
import { DISPOSABLE_DB_URL, LOCAL_DB_URL } from '../../scripts/db/db-target-config';
const MIGRATION_SQL = `
begin;
alter table public.managed_invitation_release_provenance
	add column if not exists managed_projection jsonb,
	add column if not exists applied_draft_updated_at timestamptz;
commit;
`;

describe('migration SQL summarizer', () => {
	it('detects additive columns and non-destructive shape', () => {
		const summary = summarizeMigrationSql(MIGRATION_SQL);
		expect(summary.addedColumns).toEqual([
			'managed_invitation_release_provenance.applied_draft_updated_at',
			'managed_invitation_release_provenance.managed_projection',
		]);
		expect(summary.destructiveOps).toBe(false);
		expect(summary.additiveOnly).toBe(true);
	});

	it('flags destructive operations', () => {
		const summary = summarizeMigrationSql(
			'alter table public.t drop column obsolete; alter table public.t add column x int;',
		);
		expect(summary.destructiveOps).toBe(true);
		expect(summary.additiveOnly).toBe(false);
	});
});

describe('local vs disposable drift diagnosis', () => {
	it('classifies disposable stale when missing columns are explained by migrations', () => {
		const diagnosis = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260726170000',
			persistentHasVersions: ['20260726170000', '20260727180000'],
			disposableHasVersions: ['20260726170000'],
			columnsInPersistentMissingFromDisposable: [
				'managed_invitation_release_provenance.managed_projection',
				'managed_invitation_release_provenance.applied_draft_updated_at',
			],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
				'managed_invitation_release_provenance.applied_draft_updated_at',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		expect(diagnosis.classification).toBe('disposable_stale_or_incomplete');
		expect(diagnosis.finding.status).toBe('Fail');
		expect(diagnosis.requiresHumanInput).toBe(false);
		expect(diagnosis.automaticDisposableRemediationSteps).toContain('verify-disposable-target');
		expect(diagnosis.automaticDisposableRemediationSteps).toContain('disposable-reset');
	});

	it('does not request user input while automatic disposable remediation remains', () => {
		const diagnosis = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260726170000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260726170000'],
			columnsInPersistentMissingFromDisposable: [
				'managed_invitation_release_provenance.managed_projection',
			],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		expect(
			mayRequestUserInput({
				remainingAutomaticSteps: diagnosis.automaticDisposableRemediationSteps,
				blockingFindings: [diagnosis.finding],
			}),
		).toBe(false);
	});

	it('classifies unversioned local drift as Hard blocked', () => {
		const diagnosis = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260727180000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260727180000'],
			columnsInPersistentMissingFromDisposable: ['public.mystery.extra_col'],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		expect(diagnosis.classification).toBe('local_unversioned_drift');
		expect(diagnosis.finding.status).toBe('Hard blocked');
		expect(diagnosis.requiresHumanInput).toBe(true);
	});

	it('reports aligned when histories and columns match', () => {
		const diagnosis = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260727180000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260727180000'],
			columnsInPersistentMissingFromDisposable: [],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [],
			migrationVersionsDefiningExpectedColumns: [],
		});
		expect(diagnosis.classification).toBe('aligned');
		expect(diagnosis.finding.status).toBe('Pass');
	});
});

describe('git-only promotion compatibility', () => {
	const base = {
		sourceBranch: 'develop',
		targetBranch: 'main',
		sourceSha: 'fd5ee470e8f4b69c48dbadeb1f00ae8e3840fd53',
		targetSha: '70a8aefcc40229324f597817e3abb6ce049659b1',
	};

	it('Hard blocks incompatible Git-only promote when head requires pending schema', () => {
		const finding = evaluateGitOnlyPromotionAlternative({
			...base,
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: true,
		});
		expect(finding.status).toBe('Hard blocked');
		expect(finding.cause).toContain('develop');
		expect(finding.cause).toContain('main');
	});

	it('Hard blocks when compatibility is unknown and schema-changing migrations pending', () => {
		const finding = evaluateGitOnlyPromotionAlternative({
			...base,
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: 'unknown',
		});
		expect(finding.status).toBe('Hard blocked');
	});

	it('allows Needs decision only when compatibility is demonstrated', () => {
		const finding = evaluateGitOnlyPromotionAlternative({
			...base,
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: false,
		});
		expect(finding.status).toBe('Needs decision');
	});

	it('Passes when no pending remote migrations', () => {
		const finding = evaluateGitOnlyPromotionAlternative({
			...base,
			pendingRemoteMigrations: [],
			headAppReferencesPendingSchema: false,
		});
		expect(finding.status).toBe('Pass');
	});
});

describe('production backup requirement reasoning', () => {
	it('does not require separate backup solely for calendar age when migrate auto-backups', () => {
		const result = evaluateProductionBackupRequirement({
			productionMigratePlanned: true,
			latestBackupCapturedAt: '2026-07-26T23:32:13.816Z',
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: false,
			latestBackupUnusable: false,
		});
		expect(result.freshPreMigrationBackupRequired).toBe(true);
		expect(result.separateBackupAuthorizationRequired).toBe(false);
		expect(result.finding?.status).toBe('Pass');
		expect(result.reason).toMatch(/immediately before migrate/i);
		expect(result.reason).not.toMatch(/calendar date alone/i);
	});

	it('requires separate backup authorization when inventory is empty', () => {
		const result = evaluateProductionBackupRequirement({
			productionMigratePlanned: true,
			latestBackupCapturedAt: null,
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: true,
			latestBackupUnusable: false,
		});
		expect(result.separateBackupAuthorizationRequired).toBe(true);
		expect(result.finding?.status).toBe('Needs authorization');
	});
});

describe('lane direction wording', () => {
	it('includes source, target, and SHAs for fast-forward', () => {
		const text = formatLaneDirection({
			operation: 'fast-forward',
			sourceBranch: 'develop',
			targetBranch: 'main',
			sourceSha: 'fd5ee470e8f4b69c48dbadeb1f00ae8e3840fd53',
			targetSha: '70a8aefcc40229324f597817e3abb6ce049659b1',
		});
		expect(text).toContain('develop@fd5ee470e8f4');
		expect(text).toContain('main@70a8aefcc402');
		expect(text).toContain('source develop');
		expect(text).toContain('target main');
	});
});

describe('authorization deferral until diagnosis stable', () => {
	it('omits only exact already-authorized Git scope and retains database authority boundaries', () => {
		const laneDirection = 'develop@source -> main@target via PR';
		const base = {
			laneDirection,
			gitOnlyPromotion: evaluateGitOnlyPromotionAlternative({
				sourceBranch: 'develop',
				targetBranch: 'main',
				sourceSha: 'aaa',
				targetSha: 'bbb',
				pendingRemoteMigrations: [],
				headAppReferencesPendingSchema: false,
			}),
			backup: evaluateProductionBackupRequirement({
				productionMigratePlanned: false,
				latestBackupCapturedAt: null,
				migrateWorkflowIncludesAutomaticBackup: false,
				backupInventoryEmpty: false,
				latestBackupUnusable: false,
			}),
			previewMigrateNeeded: false,
			productionMigrateNeeded: false,
			gitWriteNeeded: true,
		};
		expect(buildConsolidatedAuthorizationPlan(base).items.map((item) => item.id)).toContain(
			'git-ff-promote',
		);
		expect(
			buildConsolidatedAuthorizationPlan({
				...base,
				alreadyAuthorizedGitDirection: laneDirection,
			}).readyForUserPrompt,
		).toBe(false);
		expect(
			buildConsolidatedAuthorizationPlan({
				...base,
				alreadyAuthorizedGitDirection: 'different scope',
			}).readyForUserPrompt,
		).toBe(true);
		const withDatabase = buildConsolidatedAuthorizationPlan({
			...base,
			alreadyAuthorizedGitDirection: laneDirection,
			previewMigrateNeeded: true,
			productionMigrateNeeded: true,
		});
		expect(withDatabase.items.map((item) => item.id)).toEqual([
			'preview-migrate',
			'prod-migrate',
		]);
	});
	it('defers consolidated auth while automatic steps remain', () => {
		const gitOnly = evaluateGitOnlyPromotionAlternative({
			sourceBranch: 'develop',
			targetBranch: 'main',
			sourceSha: 'aaa',
			targetSha: 'bbb',
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: true,
		});
		const backup = evaluateProductionBackupRequirement({
			productionMigratePlanned: true,
			latestBackupCapturedAt: '2026-07-26T00:00:00.000Z',
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: false,
			latestBackupUnusable: false,
		});
		const localDrift = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260726170000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260726170000'],
			columnsInPersistentMissingFromDisposable: [
				'managed_invitation_release_provenance.managed_projection',
			],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		const plan = buildConsolidatedAuthorizationPlan({
			laneDirection: formatLaneDirection({
				operation: 'fast-forward',
				sourceBranch: 'develop',
				targetBranch: 'main',
				sourceSha: 'aaa',
				targetSha: 'bbb',
			}),
			localDrift,
			gitOnlyPromotion: gitOnly,
			backup,
			previewMigrateNeeded: true,
			productionMigrateNeeded: true,
			gitWriteNeeded: true,
			remainingAutomaticSteps: localDrift.automaticDisposableRemediationSteps,
		});
		expect(plan.readyForUserPrompt).toBe(false);
		expect(plan.items).toEqual([]);
		expect(plan.deferredReason).toMatch(/Automatic investigation/i);
	});

	it('emits consolidated auth after blockers are diagnosed and automatic work is done', () => {
		const gitOnly = evaluateGitOnlyPromotionAlternative({
			sourceBranch: 'develop',
			targetBranch: 'main',
			sourceSha: 'fd5ee470aaaa',
			targetSha: '70a8aefcbbbb',
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: true,
		});
		const backup = evaluateProductionBackupRequirement({
			productionMigratePlanned: true,
			latestBackupCapturedAt: '2026-07-26T00:00:00.000Z',
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: false,
			latestBackupUnusable: false,
		});
		const plan = buildConsolidatedAuthorizationPlan({
			laneDirection: formatLaneDirection({
				operation: 'fast-forward',
				sourceBranch: 'develop',
				targetBranch: 'main',
				sourceSha: 'fd5ee470aaaa',
				targetSha: '70a8aefcbbbb',
			}),
			localDrift: null,
			gitOnlyPromotion: gitOnly,
			backup,
			previewMigrateNeeded: true,
			productionMigrateNeeded: true,
			gitWriteNeeded: true,
			remainingAutomaticSteps: [],
		});
		expect(plan.readyForUserPrompt).toBe(true);
		expect(plan.items.map((i) => i.id)).toEqual([
			'preview-migrate',
			'prod-migrate',
			'git-ff-promote',
		]);
		expect(plan.excludedAlternatives.some((a) => /Git-only/i.test(a))).toBe(true);
	});

	it('surfaces Needs manual action when automatic resolution is impossible', () => {
		const localDrift = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260727180000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260727180000'],
			columnsInPersistentMissingFromDisposable: ['public.mystery.extra_col'],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		const gitOnly = createFinding({
			id: 'git-only-promotion-incompatible',
			status: 'Hard blocked',
			cause: 'incompatible',
			impact: 'blocked',
			owner: 'agent',
			remediation: 'migrate first',
			nextStep: 'exclude git-only',
		});
		const backup = evaluateProductionBackupRequirement({
			productionMigratePlanned: false,
			latestBackupCapturedAt: null,
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: false,
			latestBackupUnusable: false,
		});
		const plan = buildConsolidatedAuthorizationPlan({
			laneDirection: 'fast-forward main@b to develop@a (source develop, target main)',
			localDrift,
			gitOnlyPromotion: gitOnly,
			backup,
			previewMigrateNeeded: true,
			productionMigrateNeeded: true,
			gitWriteNeeded: true,
			remainingAutomaticSteps: [],
		});
		expect(plan.items[0]?.status).toBe('Needs manual action');
		expect(plan.excludedAlternatives).toEqual(
			expect.arrayContaining([expect.stringMatching(/Git-only/i)]),
		);
	});
});
describe('status vocabulary stability', () => {
	it('listPendingReadOnlySteps omits completed ids', () => {
		const pending = listPendingReadOnlySteps(['git-discovery', 'branch-parity']);
		expect(pending[0]).toBe('local-audit');
		expect(pending).not.toContain('git-discovery');
	});

	it('final report statuses stay within the established set', () => {
		const statuses = [
			diagnoseLocalDisposableDrift({
				workspaceLatestVersion: '1',
				persistentLocalLatestVersion: '1',
				disposableLatestVersion: '1',
				persistentHasVersions: ['1'],
				disposableHasVersions: ['1'],
				columnsInPersistentMissingFromDisposable: [],
				columnsInDisposableMissingFromPersistent: [],
				columnsExpectedByMigrationFiles: [],
				migrationVersionsDefiningExpectedColumns: [],
			}).finding.status,
			evaluateGitOnlyPromotionAlternative({
				sourceBranch: 'develop',
				targetBranch: 'main',
				sourceSha: 'a',
				targetSha: 'b',
				pendingRemoteMigrations: [],
				headAppReferencesPendingSchema: false,
			}).status,
		];
		for (const status of statuses) {
			expect([
				'Pass',
				'Needs decision',
				'Needs authorization',
				'Needs manual action',
				'Fail',
				'Hard blocked',
				'Skipped',
			]).toContain(status);
		}
	});
});

describe('diagnose dry-run composition', () => {
	it('emits deferred auth for correctable local failure without user prompt', () => {
		const localDrift = diagnoseLocalDisposableDrift({
			workspaceLatestVersion: '20260727180000',
			persistentLocalLatestVersion: '20260727180000',
			disposableLatestVersion: '20260726170000',
			persistentHasVersions: ['20260727180000'],
			disposableHasVersions: ['20260726170000'],
			columnsInPersistentMissingFromDisposable: [
				'managed_invitation_release_provenance.managed_projection',
			],
			columnsInDisposableMissingFromPersistent: [],
			columnsExpectedByMigrationFiles: [
				'managed_invitation_release_provenance.managed_projection',
			],
			migrationVersionsDefiningExpectedColumns: ['20260727180000'],
		});
		const gitOnly = evaluateGitOnlyPromotionAlternative({
			sourceBranch: 'develop',
			targetBranch: 'main',
			sourceSha: 'fd5ee470aaaa',
			targetSha: '70a8aefcbbbb',
			pendingRemoteMigrations: [
				{ version: '20260727180000', schema: summarizeMigrationSql(MIGRATION_SQL) },
			],
			headAppReferencesPendingSchema: true,
		});
		const backup = evaluateProductionBackupRequirement({
			productionMigratePlanned: true,
			latestBackupCapturedAt: '2026-07-26T00:00:00.000Z',
			migrateWorkflowIncludesAutomaticBackup: true,
			backupInventoryEmpty: false,
			latestBackupUnusable: false,
		});
		const remainingAutomaticSteps = [
			...listPendingReadOnlySteps(['git-discovery', 'branch-parity', 'local-audit']),
			...localDrift.automaticDisposableRemediationSteps,
		];
		expect(
			mayRequestUserInput({
				remainingAutomaticSteps,
				blockingFindings: [localDrift.finding, gitOnly],
			}),
		).toBe(false);
		const plan = buildConsolidatedAuthorizationPlan({
			laneDirection: formatLaneDirection({
				operation: 'fast-forward',
				sourceBranch: 'develop',
				targetBranch: 'main',
				sourceSha: 'fd5ee470aaaa',
				targetSha: '70a8aefcbbbb',
			}),
			localDrift,
			gitOnlyPromotion: gitOnly,
			backup,
			previewMigrateNeeded: true,
			productionMigrateNeeded: true,
			gitWriteNeeded: true,
			remainingAutomaticSteps,
		});
		expect(localDrift.classification).toBe('disposable_stale_or_incomplete');
		expect(plan.readyForUserPrompt).toBe(false);
		expect(gitOnly.status).toBe('Hard blocked');
	});
});

describe('verified disposable remediation target guards', () => {
	it('rejects persistent-local URL as Hard blocked without executing', () => {
		const verification = verifyDisposableRebuildTarget({
			dbUrl: LOCAL_DB_URL,
			requireContainerNameMatch: false,
		});
		expect(verification.verified).toBe(false);
		expect(verification.status).toBe('Hard blocked');
		expect(verification.finding.id).toBe('disposable-rebuild-target-unverified');

		const result = executeVerifiedDisposableRebuild({
			dbUrl: LOCAL_DB_URL,
			verify: { requireContainerNameMatch: false },
			run: () => {
				throw new Error('must not run');
			},
		});
		expect(result.executed).toBe(false);
	});

	it('rejects unknown / remote-looking targets', () => {
		const verification = verifyDisposableRebuildTarget({
			dbUrl: 'postgresql://postgres:x@db.abcdefghijklmnop.supabase.co:5432/postgres',
			requireContainerNameMatch: false,
			classify: () => ({ target: 'production', reason: 'cloud' }),
		});
		expect(verification.verified).toBe(false);
		expect(verification.status).toBe('Hard blocked');
	});

	it('rejects when container identity cannot be proven', () => {
		const verification = verifyDisposableRebuildTarget({
			dbUrl: DISPOSABLE_DB_URL,
			resolveContainerName: () => 'wrong-container',
			requireContainerNameMatch: true,
		});
		expect(verification.verified).toBe(false);
		expect(verification.checks.some((c) => c.id === 'container-name' && !c.ok)).toBe(true);
	});

	it('executes governed reset only after verification passes', () => {
		const result = executeVerifiedDisposableRebuild({
			dbUrl: DISPOSABLE_DB_URL,
			verify: {
				resolveContainerName: () => 'celebra-me-test-db',
				requireContainerNameMatch: true,
			},
			run: (command, args) => {
				expect(command).toBe('npx');
				expect(args).toEqual(['tsx', 'scripts/db/disposable-test-env.ts', 'reset']);
				return { status: 0, stdout: 'ok', stderr: '' };
			},
		});
		expect(result.executed).toBe(true);
		expect(result.exitCode).toBe(0);
		expect(result.finding.status).toBe('Pass');
		expect(result.commandSummary).toContain('disposable-test-env.ts reset');
	});
});
describe('missing credentials and nine-section report', () => {
	it('maps missing credentials to Needs manual action with exact locations', () => {
		const finding = createMissingCredentialsFinding({
			target: 'preview',
			secretLocations: ['.env.preview.local'],
		});
		expect(finding.status).toBe('Needs manual action');
		expect(finding.remediation).toContain('.env.preview.local');
		expect(finding.nextStep).toContain('re-invoke branch-lane');
	});

	it('builds a nine-section report with stable final statuses', () => {
		const report = buildNineSectionReport({
			detectedOperation: 'promote-develop-to-main',
			currentState: 'develop ahead of main',
			plannedActions: ['diagnose', 'remediate disposable', 're-audit'],
			completedActions: ['parity'],
			findings: [
				createFinding({
					id: 'x',
					status: 'Fail',
					cause: 'c',
					impact: 'i',
					owner: 'agent',
					remediation: 'r',
					nextStep: 'n',
				}),
			],
			decisionOrAuthorizationRequired: 'none yet — continuing automatic remediation',
			manualActionRequired: 'none',
			nextStep: 'verify disposable target then remediate',
			finalStatus: 'partial',
		});
		expect(report.finalStatus).toBe('partial');
		expect(report.decisionOrAuthorizationRequired).toMatch(/none yet/i);
	});
});
