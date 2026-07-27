/**
 * branch-lane-diagnosis.ts — Read-only diagnosis helpers for branch-lane / database-parity.
 *
 * Pure classification and planning. Does not mutate databases. Verified disposable remediation
 * is orchestrated separately (branch-lane-disposable-remediate.ts) using these conclusions —
 * never prompt the user to "investigate" when evidence can be gathered automatically.
 */

import { createFinding, type Finding } from './branch-lane-status.ts';

export type LocalDriftClassification =
	| 'disposable_stale_or_incomplete'
	| 'local_unversioned_drift'
	| 'migration_history_mismatch'
	| 'aligned'
	| 'inconclusive';

export interface AdditiveSchemaSummary {
	addedTables: string[];
	/** Qualified as table.column when both are known. */
	addedColumns: string[];
	destructiveOps: boolean;
	additiveOnly: boolean;
}

export interface LocalDisposableDriftEvidence {
	workspaceLatestVersion: string | null;
	persistentLocalLatestVersion: string | null;
	disposableLatestVersion: string | null;
	persistentHasVersions: readonly string[];
	disposableHasVersions: readonly string[];
	/** Columns present on persistent-local but missing from disposable (table.column). */
	columnsInPersistentMissingFromDisposable: readonly string[];
	/** Columns present on disposable but missing from persistent-local. */
	columnsInDisposableMissingFromPersistent: readonly string[];
	/** Columns expected from parsing workspace migration SQL for versions under review. */
	columnsExpectedByMigrationFiles: readonly string[];
	migrationVersionsDefiningExpectedColumns: readonly string[];
}

export interface LocalDriftDiagnosis {
	classification: LocalDriftClassification;
	finding: Finding;
	/** Steps the agent must run automatically before any user prompt. */
	automaticReadOnlySteps: string[];
	/**
	 * Automated disposable-test remediation steps (reset + apply migrations).
	 * These are low-risk **writes** to disposable-test only — not read-only diagnosis.
	 * They must still run without asking the user whether to investigate, after target verification.
	 */
	automaticDisposableRemediationSteps: string[];
	requiresHumanInput: boolean;
	minimumRemediationSequence: string[];
}

export interface PendingMigrationSummary {
	version: string;
	schema: AdditiveSchemaSummary;
}

export interface GitOnlyPromotionInput {
	/** Exact lane wording context. */
	sourceBranch: string;
	targetBranch: string;
	sourceSha: string;
	targetSha: string;
	pendingRemoteMigrations: readonly PendingMigrationSummary[];
	/**
	 * Whether head application code depends on pending schema objects.
	 * Use 'unknown' when not yet determined — fail closed for Git-only offer.
	 */
	headAppReferencesPendingSchema: boolean | 'unknown';
}

export interface BackupRequirementInput {
	productionMigratePlanned: boolean;
	/** ISO timestamp of newest usable Production guest/RSVP dump, if any. */
	latestBackupCapturedAt: string | null;
	/**
	 * When true, `pnpm db:prod:migrate` creates a pre-migration backup automatically.
	 * A separate backup authorization is then only needed for independent coverage gaps.
	 */
	migrateWorkflowIncludesAutomaticBackup: boolean;
	/** True when inventory has no usable guest/RSVP dump at all. */
	backupInventoryEmpty: boolean;
	/** True when newest dump is corrupt/empty (e.g. tiny stub). */
	latestBackupUnusable: boolean;
}

export interface BackupRequirementResult {
	/** Whether a fresh pre-migration Production backup is required by policy/risk. */
	freshPreMigrationBackupRequired: boolean;
	/**
	 * Whether the agent must separately request `pnpm db:prod:backup` authorization
	 * (false when migrate workflow will create the backup as part of authorized migrate).
	 */
	separateBackupAuthorizationRequired: boolean;
	reason: string;
	finding: Finding | null;
}

const READ_ONLY_STEP_IDS = [
	'git-discovery',
	'branch-parity',
	'local-audit',
	'local-disposable-drift-diagnosis',
	'preview-audit',
	'prod-audit',
	'git-only-compatibility',
	'backup-requirement-eval',
	'checkpoint-write',
] as const;

export type ReadOnlyStepId = (typeof READ_ONLY_STEP_IDS)[number];

/**
 * Extract additive / destructive schema signals from migration SQL (best-effort).
 * Sufficient for promote gating; not a full SQL parser.
 */
export function summarizeMigrationSql(sql: string): AdditiveSchemaSummary {
	const addedTables: string[] = [];
	const addedColumns: string[] = [];
	const createTable = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][\w]*)/gi;
	const destructive =
		/\b(drop\s+table|drop\s+column|alter\s+column|rename\s+column|rename\s+to)\b/i.test(sql);

	let match: RegExpExecArray | null;
	while ((match = createTable.exec(sql)) !== null) {
		addedTables.push(match[1]!);
	}

	// Handle multi-column ALTER TABLE ... ADD COLUMN a ..., ADD COLUMN b ...
	const alterParts = sql.split(/alter\s+table/i);
	for (const part of alterParts.slice(1)) {
		const tableMatch = /(?:if\s+exists\s+)?(?:public\.)?([a-zA-Z_][\w]*)/i.exec(part);
		if (!tableMatch) continue;
		const table = tableMatch[1]!;
		const colRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][\w]*)/gi;
		let colMatch: RegExpExecArray | null;
		while ((colMatch = colRe.exec(part)) !== null) {
			addedColumns.push(`${table}.${colMatch[1]}`);
		}
	}

	const additiveOnly =
		!destructive &&
		(addedTables.length > 0 || addedColumns.length > 0 || sql.trim().length > 0);
	return {
		addedTables: [...new Set(addedTables)].sort(),
		addedColumns: [...new Set(addedColumns)].sort(),
		destructiveOps: destructive,
		additiveOnly: additiveOnly && !destructive,
	};
}

function setHasAll(haystack: readonly string[], needles: readonly string[]): boolean {
	const set = new Set(haystack);
	return needles.every((n) => set.has(n));
}

function baseReadOnlySteps(): string[] {
	return [
		'local-disposable-drift-diagnosis',
		'compare-migration-histories',
		'parse-migration-sql-expectations',
	];
}

function diagnosisShell(
	partial: Omit<LocalDriftDiagnosis, 'automaticReadOnlySteps'> & {
		automaticReadOnlySteps?: string[];
	},
): LocalDriftDiagnosis {
	return {
		...partial,
		automaticReadOnlySteps: partial.automaticReadOnlySteps ?? baseReadOnlySteps(),
	};
}

/**
 * Classify persistent-local vs disposable schema discrepancy from structured evidence.
 */
// Classification matrix intentionally branches on several independent evidence axes.
// eslint-disable-next-line complexity -- diagnostic decision tree
export function diagnoseLocalDisposableDrift(
	evidence: LocalDisposableDriftEvidence,
): LocalDriftDiagnosis {
	const missingOnDisposable = evidence.columnsInPersistentMissingFromDisposable;
	const missingOnPersistent = evidence.columnsInDisposableMissingFromPersistent;
	const expected = evidence.columnsExpectedByMigrationFiles;
	const persistentHasExpectedMigrations = setHasAll(
		evidence.persistentHasVersions,
		evidence.migrationVersionsDefiningExpectedColumns,
	);
	const disposableHasExpectedMigrations = setHasAll(
		evidence.disposableHasVersions,
		evidence.migrationVersionsDefiningExpectedColumns,
	);

	if (
		missingOnDisposable.length === 0 &&
		missingOnPersistent.length === 0 &&
		evidence.persistentLocalLatestVersion === evidence.disposableLatestVersion
	) {
		return diagnosisShell({
			classification: 'aligned',
			finding: createFinding({
				id: 'local-disposable-aligned',
				status: 'Pass',
				cause: 'Persistent-local and disposable reference schemas match for audited objects.',
				impact: 'Local audit drift is not blocking.',
				owner: 'agent',
				remediation: 'Continue remaining read-only audits.',
				nextStep: 'Proceed to remote audits and compatibility evaluation.',
			}),
			automaticDisposableRemediationSteps: [],
			requiresHumanInput: false,
			minimumRemediationSequence: [],
		});
	}

	const missingExplainedByMigrations =
		expected.length > 0 && missingOnDisposable.every((c) => expected.includes(c));

	if (missingOnDisposable.length > 0 && missingExplainedByMigrations) {
		return diagnosisShell({
			classification: 'disposable_stale_or_incomplete',
			finding: createFinding({
				id: 'local-disposable-stale',
				status: 'Fail',
				cause:
					`Disposable reference is stale or incomplete relative to persistent-local` +
					` (missing columns: ${missingOnDisposable.join(', ') || 'unknown'};` +
					` disposable latest=${evidence.disposableLatestVersion ?? 'none'},` +
					` workspace latest=${evidence.workspaceLatestVersion ?? 'none'};` +
					` disposable has expected versions=${disposableHasExpectedMigrations}).`,
				impact: 'Local audit fails until the disposable canonical reference is rebuilt.',
				owner: 'agent',
				remediation:
					'After conclusive disposable-test target verification, automatically rebuild disposable-test (pnpm db:disposable:reset) and re-run local audit. Do not ask the user whether to investigate. This remediation is a disposable-only write, not read-only diagnosis.',
				nextStep:
					'Verify disposable identity, run disposable remediation, then re-audit persistent-local before any authorization prompts.',
			}),
			automaticDisposableRemediationSteps: [
				'verify-disposable-target',
				'disposable-start',
				'disposable-reset',
				'disposable-apply-migrations',
				'local-audit-rerun',
			],
			requiresHumanInput: false,
			minimumRemediationSequence: [
				'Verify disposable-test identity (port/container/classify)',
				'Rebuild disposable-test from workspace migrations',
				'Re-run pnpm db:local:audit',
				'If still failing, classify residual drift',
			],
		});
	}

	if (
		missingOnDisposable.length > 0 &&
		expected.length > 0 &&
		!missingExplainedByMigrations &&
		persistentHasExpectedMigrations
	) {
		return diagnosisShell({
			classification: 'local_unversioned_drift',
			finding: createFinding({
				id: 'local-unversioned-drift',
				status: 'Hard blocked',
				cause:
					`Persistent-local has schema objects not explained by workspace migrations` +
					` (${missingOnDisposable.join(', ')}), while disposable (rebuilt from migrations) lacks them.`,
				impact: 'Cannot clear database-parity; unversioned drift must be reconciled via migrations.',
				owner: 'human',
				remediation:
					'Capture the drift, add a corrective versioned migration (do not mutate applied files), apply through approved paths, then resume branch-lane.',
				nextStep: 'Owner authors corrective migration; agent will re-diagnose on resume.',
			}),
			automaticDisposableRemediationSteps: [],
			requiresHumanInput: true,
			minimumRemediationSequence: [
				'Document drifting objects',
				'Add corrective migration (never edit applied migration content)',
				'Re-run local diagnosis',
			],
		});
	}

	const disposableBehindWorkspace =
		(evidence.disposableLatestVersion ?? '') < (evidence.workspaceLatestVersion ?? '');
	const persistentBehindWorkspace =
		(evidence.persistentLocalLatestVersion ?? '') < (evidence.workspaceLatestVersion ?? '');

	if (
		evidence.persistentLocalLatestVersion !== evidence.disposableLatestVersion ||
		!persistentHasExpectedMigrations ||
		!disposableHasExpectedMigrations
	) {
		const remediationSteps = disposableBehindWorkspace
			? [
					'verify-disposable-target',
					'disposable-reset',
					'disposable-apply-migrations',
					'local-audit-rerun',
				]
			: [];
		return diagnosisShell({
			classification: 'migration_history_mismatch',
			finding: createFinding({
				id: 'local-migration-history-mismatch',
				status: 'Fail',
				cause:
					`Migration histories differ between persistent-local` +
					` (latest=${evidence.persistentLocalLatestVersion ?? 'none'}) and disposable` +
					` (latest=${evidence.disposableLatestVersion ?? 'none'}).`,
				impact: 'Schema comparison is not trustworthy until histories align with workspace.',
				owner: 'agent',
				remediation:
					'Finish read-only comparison of version lists; after target verification, remediate disposable if it is behind workspace; do not mutate persistent-local without authorization.',
				nextStep:
					'Complete automatic history alignment diagnosis / verified disposable remediation.',
			}),
			automaticDisposableRemediationSteps: remediationSteps,
			requiresHumanInput:
				!disposableBehindWorkspace &&
				(persistentBehindWorkspace || missingOnPersistent.length > 0),
			minimumRemediationSequence: [
				'Align disposable with workspace migrations (verified target only)',
				'Re-audit',
				'If persistent-local is behind workspace, authorize local migrate separately',
			],
		});
	}

	return diagnosisShell({
		classification: 'inconclusive',
		finding: createFinding({
			id: 'local-disposable-inconclusive',
			status: 'Needs manual action',
			cause: 'Insufficient structured evidence to classify persistent-local vs disposable drift.',
			impact: 'Cannot safely continue promote clearance.',
			owner: 'human',
			remediation:
				'Provide audit JSON / column lists or run pnpm db:branch:diagnose with reachable local databases.',
			nextStep: 'Re-run diagnosis with complete evidence, then resume branch-lane.',
		}),
		automaticDisposableRemediationSteps: [],
		requiresHumanInput: true,
		minimumRemediationSequence: [
			'Collect complete migration version lists and column diffs',
			'Re-run diagnoseLocalDisposableDrift',
		],
	});
}

/**
 * Git-only promote alternative: only offer when remotes can safely run the head app
 * against the current remote schema. Incompatible deployments are Hard blocked.
 */
export function evaluateGitOnlyPromotionAlternative(input: GitOnlyPromotionInput): Finding {
	const direction = formatLaneDirection({
		operation: 'fast-forward',
		sourceBranch: input.sourceBranch,
		targetBranch: input.targetBranch,
		sourceSha: input.sourceSha,
		targetSha: input.targetSha,
	});

	if (input.pendingRemoteMigrations.length === 0) {
		return createFinding({
			id: 'git-only-promotion-ok',
			status: 'Pass',
			cause: `No pending remote migrations for ${direction}.`,
			impact: 'Git-only promotion does not leave schema behind application requirements.',
			owner: 'agent',
			remediation: 'Git-only path is schema-compatible.',
			nextStep: 'Authorization may proceed for Git writes after other clearances.',
		});
	}

	const destructive = input.pendingRemoteMigrations.some((m) => m.schema.destructiveOps);
	const hasSchemaChanges = input.pendingRemoteMigrations.some(
		(m) =>
			m.schema.addedColumns.length > 0 ||
			m.schema.addedTables.length > 0 ||
			m.schema.destructiveOps,
	);

	if (destructive || input.headAppReferencesPendingSchema === true) {
		return createFinding({
			id: 'git-only-promotion-incompatible',
			status: 'Hard blocked',
			cause:
				`Pending migrations required by head are not applied on remotes;` +
				` Git-only ${direction} would deploy an incompatible application.`,
			impact: 'Production/Preview would run head code against an older schema.',
			owner: 'agent',
			remediation:
				'Do not offer Git-only promotion. Authorize remote migrate(s) before or with promote.',
			nextStep: 'Exclude Git-only alternative from authorization prompts.',
			paths: input.pendingRemoteMigrations.map(
				(m) => `supabase/migrations/${m.version}_*.sql`,
			),
		});
	}

	if (input.headAppReferencesPendingSchema === 'unknown' && hasSchemaChanges) {
		return createFinding({
			id: 'git-only-promotion-compatibility-unknown',
			status: 'Hard blocked',
			cause:
				`Pending schema-changing migrations exist and head↔schema compatibility was not demonstrated` +
				` for ${direction}.`,
			impact: 'Cannot treat Git-only promote as an acceptable exception.',
			owner: 'agent',
			remediation:
				'Complete automatic code/schema compatibility scan, or require remote migrate before promote.',
			nextStep:
				'Finish compatibility diagnosis automatically; do not prompt for Git-only accept.',
		});
	}

	// Additive migrations with demonstrated non-dependency — still Needs decision, not auto-accept
	return createFinding({
		id: 'git-only-promotion-optional',
		status: 'Needs decision',
		cause:
			`Remotes still lack pending additive migrations, but head app was demonstrated not to require them` +
			` for ${direction}.`,
		impact: 'Git-only promote leaves migrations pending; owner must accept residual migrate debt.',
		owner: 'human',
		remediation: 'Prefer remote migrate then promote; Git-only only with explicit acceptance.',
		nextStep: 'Include as secondary option only after primary migrate+promote plan.',
	});
}

/**
 * Backup requirements based on risk/policy — not calendar-day freshness alone.
 */
export function evaluateProductionBackupRequirement(
	input: BackupRequirementInput,
): BackupRequirementResult {
	if (!input.productionMigratePlanned) {
		return {
			freshPreMigrationBackupRequired: false,
			separateBackupAuthorizationRequired: false,
			reason: 'No Production migration planned; pre-migration backup gate does not apply.',
			finding: null,
		};
	}

	if (input.backupInventoryEmpty || input.latestBackupUnusable) {
		const finding = createFinding({
			id: 'prod-backup-coverage-gap',
			status: 'Needs authorization',
			cause: input.backupInventoryEmpty
				? 'No usable Production guest/RSVP backup inventory exists.'
				: 'Newest Production backup artifact is unusable.',
			impact: 'Migration window lacks independent recovery coverage.',
			owner: 'human',
			remediation: 'Authorize pnpm db:prod:backup before Production migrate.',
			nextStep: 'Approve Production backup, then migrate.',
		});
		return {
			freshPreMigrationBackupRequired: true,
			separateBackupAuthorizationRequired: true,
			reason: finding.cause,
			finding,
		};
	}

	if (input.migrateWorkflowIncludesAutomaticBackup) {
		return {
			freshPreMigrationBackupRequired: true,
			separateBackupAuthorizationRequired: false,
			reason:
				'A fresh pre-migration Production backup is required to capture state immediately before migrate;' +
				' pnpm db:prod:migrate performs that backup automatically once migrate is authorized.' +
				(input.latestBackupCapturedAt
					? ` Existing dump at ${input.latestBackupCapturedAt} is inventory coverage, not a substitute for the pre-migrate snapshot.`
					: ''),
			finding: createFinding({
				id: 'prod-backup-via-migrate-workflow',
				status: 'Pass',
				cause: 'Fresh pre-migration backup will be created by the authorized Production migrate workflow.',
				impact: 'No separate backup authorization is required solely because of calendar age.',
				owner: 'agent',
				remediation:
					'Request Production migrate authorization; backup is part of that path.',
				nextStep:
					'Consolidate migrate (+ embedded backup) into the final authorization prompt.',
			}),
		};
	}

	const finding = createFinding({
		id: 'prod-backup-before-migrate',
		status: 'Needs authorization',
		cause: 'Production migrate is planned and the migrate path does not auto-backup; a fresh pre-migration dump is required.',
		impact: 'Cannot safely mutate Production without a pre-migrate recovery point.',
		owner: 'human',
		remediation: 'Authorize pnpm db:prod:backup immediately before migrate.',
		nextStep: 'Approve backup, then migrate.',
	});
	return {
		freshPreMigrationBackupRequired: true,
		separateBackupAuthorizationRequired: true,
		reason: finding.cause,
		finding,
	};
}

export function formatLaneDirection(input: {
	operation: 'fast-forward' | 'merge' | 'push';
	sourceBranch: string;
	targetBranch: string;
	sourceSha: string;
	targetSha: string;
}): string {
	const src = `${input.sourceBranch}@${shortSha(input.sourceSha)}`;
	const dst = `${input.targetBranch}@${shortSha(input.targetSha)}`;
	switch (input.operation) {
		case 'fast-forward':
			return `fast-forward ${dst} to ${src} (source ${input.sourceBranch}, target ${input.targetBranch})`;
		case 'merge':
			return `merge ${src} into ${dst} (source ${input.sourceBranch}, target ${input.targetBranch})`;
		case 'push':
			return `push ${src} to update remote ${input.targetBranch} (local ${shortSha(input.sourceSha)}, remote ${shortSha(input.targetSha)})`;
		default:
			return `${src} → ${dst}`;
	}
}

function shortSha(sha: string): string {
	return sha.length > 12 ? sha.slice(0, 12) : sha;
}

/**
 * True only when no further safe automatic investigation remains.
 * Never ask the user whether the agent should investigate.
 */
export function mayRequestUserInput(input: {
	remainingAutomaticSteps: readonly string[];
	blockingFindings: readonly Finding[];
}): boolean {
	if (input.remainingAutomaticSteps.length > 0) {
		return false;
	}
	return input.blockingFindings.some(
		(f) =>
			f.status === 'Needs decision' ||
			f.status === 'Needs authorization' ||
			f.status === 'Needs manual action' ||
			f.status === 'Hard blocked' ||
			f.status === 'Fail',
	);
}

export function listPendingReadOnlySteps(completedIds: readonly string[]): ReadOnlyStepId[] {
	const done = new Set(completedIds);
	return READ_ONLY_STEP_IDS.filter((id) => !done.has(id));
}

export function createMissingCredentialsFinding(input: {
	target: 'preview' | 'production' | 'persistent-local';
	secretLocations: readonly string[];
}): Finding {
	const locations = input.secretLocations.join(', ');
	return createFinding({
		id: `missing-${input.target}-credentials`,
		status: 'Needs manual action',
		cause: `Credentials for ${input.target} did not resolve.`,
		impact: `${input.target} audit/migrate cannot proceed until credentials exist.`,
		owner: 'human',
		remediation: `Provide credentials via documented env/secret files (${locations}); never paste secrets into chat.`,
		nextStep: `Add credentials at ${locations}, then re-invoke branch-lane (checkpoint will resume unaffected steps).`,
	});
}

export interface NineSectionReport {
	detectedOperation: string;
	currentState: string;
	plannedActions: string[];
	completedActions: string[];
	findings: Finding[];
	decisionOrAuthorizationRequired: string;
	manualActionRequired: string;
	nextStep: string;
	finalStatus: 'Pass' | 'partial' | 'unresolved' | 'Fail' | 'Hard blocked';
}

export function buildNineSectionReport(input: NineSectionReport): NineSectionReport {
	return input;
}

export interface AuthorizationPlanItem {
	id: string;
	status: 'Needs authorization' | 'Needs decision' | 'Needs manual action';
	action: string;
	reason: string;
}

/**
 * Build the final consolidated human prompt only after diagnosis is stable.
 */
export function buildConsolidatedAuthorizationPlan(input: {
	laneDirection: string;
	localDrift?: LocalDriftDiagnosis | null;
	gitOnlyPromotion: Finding;
	backup: BackupRequirementResult;
	previewMigrateNeeded: boolean;
	productionMigrateNeeded: boolean;
	gitWriteNeeded: boolean;
	/** Automatic steps still outstanding (empty ⇒ diagnosis complete for prompting). */
	remainingAutomaticSteps?: readonly string[];
}): {
	readyForUserPrompt: boolean;
	deferredReason: string | null;
	items: AuthorizationPlanItem[];
	excludedAlternatives: string[];
} {
	const remaining = input.remainingAutomaticSteps ?? [];
	if (remaining.length > 0) {
		return {
			readyForUserPrompt: false,
			deferredReason:
				`Automatic investigation/repair still outstanding (${remaining.join(', ')}); ` +
				'defer Preview/Production/Git authorization until complete.',
			items: [],
			excludedAlternatives: [],
		};
	}

	if (
		input.localDrift?.classification === 'local_unversioned_drift' ||
		input.localDrift?.finding.status === 'Hard blocked'
	) {
		return {
			readyForUserPrompt: true,
			deferredReason: null,
			items: [
				{
					id: 'resolve-local-drift',
					status: 'Needs manual action',
					action: input.localDrift.minimumRemediationSequence.join(' → '),
					reason: input.localDrift.finding.cause,
				},
			],
			excludedAlternatives: [
				'Git-only promotion',
				'Preview/Production migrate authorization (blocked until local clearance)',
			],
		};
	}

	if (input.localDrift?.finding.status === 'Fail') {
		return {
			readyForUserPrompt: true,
			deferredReason: null,
			items: [
				{
					id: 'resolve-local-fail',
					status: 'Needs manual action',
					action: input.localDrift.finding.remediation,
					reason: input.localDrift.finding.cause,
				},
			],
			excludedAlternatives: [
				'Preview/Production/Git authorization until local Fail is cleared',
			],
		};
	}

	const items: AuthorizationPlanItem[] = [];
	const excludedAlternatives: string[] = [];

	if (input.previewMigrateNeeded) {
		items.push({
			id: 'preview-migrate',
			status: 'Needs authorization',
			action: 'Authorize pnpm db:preview:migrate for pending head migrations',
			reason: 'Preview is behind head migrations required for a migration-bearing promote.',
		});
	}
	if (input.productionMigrateNeeded) {
		if (input.backup.separateBackupAuthorizationRequired && input.backup.finding) {
			items.push({
				id: 'prod-backup',
				status: 'Needs authorization',
				action: 'Authorize pnpm db:prod:backup (pre-migration coverage gap)',
				reason: input.backup.reason,
			});
		}
		items.push({
			id: 'prod-migrate',
			status: 'Needs authorization',
			action: 'Authorize pnpm db:prod:migrate (includes automatic pre-migration backup when configured)',
			reason: `Production must receive pending migrations before or with ${input.laneDirection}.`,
		});
	}
	if (input.gitWriteNeeded) {
		items.push({
			id: 'git-ff-promote',
			status: 'Needs authorization',
			action: `Authorize ${input.laneDirection} and push of target branch when specified`,
			reason: 'Git writes require explicit current-task authorization.',
		});
	}

	if (
		input.gitOnlyPromotion.status === 'Hard blocked' ||
		input.gitOnlyPromotion.id === 'git-only-promotion-incompatible' ||
		input.gitOnlyPromotion.id === 'git-only-promotion-compatibility-unknown'
	) {
		excludedAlternatives.push(
			`Git-only promotion without remote migrate (${input.gitOnlyPromotion.status})`,
		);
	} else if (input.gitOnlyPromotion.status === 'Needs decision') {
		items.push({
			id: 'git-only-optional',
			status: 'Needs decision',
			action: 'Accept Git-only promote while leaving remote migrations pending (not recommended)',
			reason: input.gitOnlyPromotion.cause,
		});
	}

	return {
		readyForUserPrompt: items.length > 0,
		deferredReason: null,
		items,
		excludedAlternatives,
	};
}
