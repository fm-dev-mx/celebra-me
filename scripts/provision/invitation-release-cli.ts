#!/usr/bin/env node
/** The sole public managed-invitation release command (Local → Preview → approve → Production). */
/* eslint-disable max-lines, no-useless-assignment -- Managed release CLI handles mode dispatch, per-target planning, and interactive wizard. */
import { confirm, select } from '@inquirer/prompts';
import { type LocalApplyResult } from './apply-local-invitation.ts';
import { exportInvitationPackage, type InvitationPackageData } from './invitation-package.ts';
import { runImportEngine } from './invitation-import-engine.ts';
import { assertEngineResult } from './invitation-engine-result.ts';
import { PackageInputError, resolveInvitationPackageInput } from './invitation-package-input.ts';
import {
	buildCancellationResults,
	buildPreflightBlockedResults,
	deriveLifecycleExitCode,
	deriveLifecycleFinalStatus,
	executeTargetPlans,
	type LifecycleExecutionError,
} from './invitation-lifecycle-execution.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import { parseAssetPolicy } from './asset-reconciliation.ts';
import type { UpdateScope } from './semantic-delta.ts';
import {
	buildStatusReport,
	parseReleaseMutationTargets,
	parseTargets,
	checkUnknownFlags,
	validateUpdateOptions,
	type InvitationUpdateTarget,
} from './invitation-update-options.ts';
import {
	authorizePreviewWriteApply,
	verifyPreviewWriteAuthorization,
} from './preview-write-auth.ts';
import { readFastInvitationInventory } from './invitation-status-inventory.ts';
import { evaluateInvitationReadiness } from './invitation-readiness.ts';
import { LOCAL_DB_URL, redactCredentials } from '../db/db-target-config.ts';
import { assertPreviewDbUrl, getPreviewDbUrl, getProdDbUrl } from '../db/db-workflow-lib.ts';
import { approvePreviewArtifactFromLiveVerification } from './preview-approval-service.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import {
	PREVIEW_LIVE_CHECKLIST_KEYS,
	verifyPreviewArtifactLive,
} from './preview-live-verification.ts';
import {
	assertContentSchemaCurrent,
	planAndApplyLocalContent,
	planAndApplyPreviewContent,
} from './invitation-content-apply.ts';
import {
	formatStatusReport,
	formatDryRunPlan,
	formatApplyConfirmation,
	formatApplyResult,
	consolidateTargetFunctionalChanges,
	type StatusReportData,
	type OperationalPlanData,
	type TargetPlanData,
	type TargetApplyResultData,
} from './invitation-update-presenter.ts';
import { establishPreviewProvenanceBaseline } from './preview-provenance-baseline-service.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import {
	loadConflictResolutionsFile,
	mergePathPolicies,
	suggestConflictResolutionsFile,
} from './conflict-resolutions.ts';
import { promptFieldSelection } from './invitation-update-field-selection.ts';
import {
	MergeConflictError,
	listDriftConflicts,
	type ConflictResolutions,
} from './semantic-delta.ts';
import { runDestinationReleaseWizard } from './invitation-release-wizard.ts';
import { runPromotionPreflight } from './invitation-promote.ts';
import {
	formatPromotionPlanCompact,
	toPublicPromotionReport,
} from './invitation-promotion-format.ts';
import { resolvePromotionUpdateScope } from './invitation-promotion-orchestrator.ts';
import { operatorSymbol, writeHuman } from '../db/operator-cli-ux.ts';
import { isTargetDivergenceConflictMessage } from './promotion-comparison.ts';

function mergeConflictsFromError(error: unknown): TargetPlanData['mergeConflicts'] {
	let current: unknown = error;
	while (current) {
		if (current instanceof MergeConflictError) {
			return listDriftConflicts(current.deltas).map((delta) => ({
				path: delta.path,
				previousCanonicalValue: delta.previousCanonicalValue,
				packageValue: delta.currentCanonicalValue,
				targetValue: delta.currentTargetValue,
			}));
		}
		if (current instanceof Error && 'cause' in current && current.cause) {
			current = current.cause;
			continue;
		}
		break;
	}
	return undefined;
}

function collectPlanConflicts(
	targetPlans: TargetPlanData[],
): NonNullable<TargetPlanData['mergeConflicts']> {
	const byPath = new Map<string, NonNullable<TargetPlanData['mergeConflicts']>[number]>();
	for (const plan of targetPlans) {
		for (const conflict of plan.mergeConflicts ?? []) {
			byPath.set(conflict.path, conflict);
		}
	}
	return Array.from(byPath.values());
}

type StageStatus =
	| 'UPDATED'
	| 'IN_SYNC'
	| 'SKIPPED'
	| 'BLOCKED'
	| 'FAILED'
	| 'NOT_RUN'
	| 'UNVERIFIED'
	| 'CANCELLED';

interface StageReport {
	stage: string;
	environment: InvitationUpdateTarget;
	status: StageStatus;
	reason?: string;
	reasonCode?: string;
	remainingAction?: string;
	plannedOperations?: number;
	completedOperations?: number;
	databaseInserts?: number;
	databaseUpdates?: number;
	databaseDeletes?: number;
	storageUploads?: number;
	storageOverwrites?: number;
	storageMoves?: number;
	storageDeletes?: number;
	assetCounts?: { created: number; replaced: number; reused: number };
	publishedVersion?: number;
	packageHash?: string;
	approvalState?: string;
}

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function assetCounts(actions: Array<{ resource: string; action: string }>): {
	created: number;
	replaced: number;
	reused: number;
} {
	const assets = actions.filter((action) => action.resource === 'invitation_assets');
	return {
		created: assets.filter((action) => action.action === 'create').length,
		replaced: assets.filter((action) => action.action === 'replace').length,
		reused: assets.filter((action) => action.action === 'reuse').length,
	};
}

function sanitizeMessage(message: string): string {
	const translated = message.includes('PRECONDITION_FAILED')
		? 'El origen, el paquete o el estado del destino cambió después de confirmar el plan. Genere y confirme un plan nuevo.'
		: message.includes('INVALID_ENGINE_RESULT')
			? 'El motor no devolvió el plan y recibo confirmados. No se puede acreditar la ejecución; revise el resultado antes de reintentar.'
			: message.includes('Final target verification failed')
				? 'La verificación final del destino no coincidió con el plan. Revise el estado antes de reintentar.'
				: message;
	return redactCredentials(translated)
		.replace(/\b[a-f0-9]{64}\b/gi, (hash) => `${hash.slice(0, 8)}…`)
		.replace(/[A-Za-z]:\\[^\s"']+/g, '[ruta interna]');
}

async function runProductionPreflightDispatch(input: {
	slug: string;
	definition: ReturnType<typeof getInvitationDefinition>;
	ownerUserId?: string;
	pruneAssets: boolean;
	backupManifestPath?: string;
	json: boolean;
	verbose: boolean;
	packageInput: Awaited<ReturnType<typeof resolveInvitationPackageInput>>;
	assetPolicy: ReturnType<typeof parseAssetPolicy> | undefined;
	conflictResolutions: ReturnType<typeof loadConflictResolutionsFile> | undefined;
	updateScope?: UpdateScope;
}): Promise<void> {
	const preflight = await runPromotionPreflight({
		packageData: input.packageInput.packageData,
		ownerUserId: input.ownerUserId,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		backupManifestPath: input.backupManifestPath,
		requireBackup: false,
		getProductionDbUrl: getProdDbUrl,
	});
	if (input.json) {
		console.log(JSON.stringify(toPublicPromotionReport(preflight), null, 2));
	} else if (input.verbose) {
		writeHuman(`\n=== invitation:release (Production) ===`);
		writeHuman(`Status: ${preflight.status}`);
		if (preflight.reason) writeHuman(`Reason: ${preflight.reason}`);
		writeHuman(`Schema: ${preflight.schema.state}`);
	} else {
		writeHuman(
			formatPromotionPlanCompact(preflight, {
				title: input.definition.title,
				route: `/${input.definition.eventType}/${input.definition.slug}`,
				deliveryScope: input.definition.deliveryScope,
			}),
		);
		if (preflight.status === 'PROMOTABLE') {
			writeHuman(
				`${operatorSymbol('info')} Para aplicar: pnpm prod:apply -- --slug ${input.slug} --apply`,
			);
		}
		if (preflight.status === 'BLOCKED' && preflight.blockCode === 'SCHEMA_INCOMPATIBLE') {
			writeHuman(
				`${operatorSymbol('warn')} Schema incompatible. Incluya schema en pnpm prod:apply -- --schema --slug ${input.slug} (invitation:release nunca migra).`,
			);
		}
	}
	if (preflight.status === 'BLOCKED') process.exitCode = 1;
}

async function runProductionReleaseDispatch(input: {
	slug: string;
	definition: ReturnType<typeof getInvitationDefinition>;
	sourceDir?: string;
	packagePath?: string;
	allowStalePackage: boolean;
	ownerUserId?: string;
	assetPolicyRaw?: string;
	pruneAssets: boolean;
	updateScope?: UpdateScope;
	conflictResolutionsPath?: string;
	backupManifestPath?: string;
	apply: boolean;
	json: boolean;
	verbose: boolean;
}): Promise<void> {
	let packageInput;
	try {
		packageInput = await resolveInvitationPackageInput({
			slug: input.slug,
			sourceDir: input.sourceDir,
			packagePath: input.packagePath,
			allowStalePackage: input.allowStalePackage,
		});
	} catch (error) {
		const message =
			error instanceof PackageInputError
				? error.safeReason
				: error instanceof Error
					? error.message
					: String(error);
		if (input.json) {
			console.log(
				JSON.stringify(
					{
						status: 'BLOCKED',
						blockCode: 'PRODUCTION_PLAN_BLOCKED',
						reason: message,
						slug: input.slug,
					},
					null,
					2,
				),
			);
		} else {
			writeHuman(`${operatorSymbol('fail')} ${message}`);
		}
		process.exitCode = 1;
		return;
	}

	const assetPolicy = input.assetPolicyRaw ? parseAssetPolicy(input.assetPolicyRaw) : undefined;
	const conflictResolutions = input.conflictResolutionsPath
		? loadConflictResolutionsFile(input.conflictResolutionsPath)
		: undefined;
	const updateScope = resolvePromotionUpdateScope({
		updateScope: input.updateScope,
		deliveryScope: input.definition.deliveryScope,
	});

	if (!input.apply) {
		await runProductionPreflightDispatch({
			...input,
			packageInput,
			assetPolicy,
			conflictResolutions,
			updateScope,
		});
		return;
	}

	const command = `pnpm prod:apply -- --slug ${input.slug} --apply`;
	const message = `Production apply moved to pnpm prod:apply. Use: ${command}`;
	if (input.json) {
		console.log(
			JSON.stringify({
				status: 'BLOCKED',
				blockCode: 'USE_PROD_APPLY',
				reason: message,
				slug: input.slug,
			}),
		);
	} else {
		writeHuman(`${operatorSymbol('fail')} ${message}`);
	}
	process.exitCode = 1;
}

export function printHelp(): void {
	console.log(`
invitation:release — Sole managed invitation release CLI

Usage:
  pnpm invitation:release                                             Interactive destination wizard (TTY): Update Local | Prepare Preview | Release to Production
  pnpm invitation:release --status [--slug <slug>] [--targets <targets>] [--json]
  pnpm invitation:release --slug <slug> --targets local|preview|local,preview --dry-run|--apply [--non-interactive] [--source-dir <dir>|--package <path>]
  pnpm invitation:release --slug <slug> --targets production --dry-run
  pnpm prod:apply -- --slug <slug> --apply
  pnpm invitation:release --package-hash <hash> --approve
  pnpm invitation:release --preview-provenance --slug <slug> --targets preview --package <path> --dry-run [--json]
  pnpm invitation:release --preview-provenance --slug <slug> --targets preview --package <path> --apply [--json]

Options:
  --asset-policy <policy>     Asset handling policy: verify, missing (default), sync, preserve
  --prune-assets               Enable explicit removal of unreferenced managed assets (requires confirmation)
  --status                     Local inventory status (remotes unprobed; use pnpm dbs for matrix)
  --targets <targets>          Mutations: local, preview, local,preview, or production (exclusive).
                               Status only: local, preview, production, all (all includes Production read-only).
  --slug <slug>                Invitation slug (e.g. romina-rios-chaparro)
  --rekey-from <slug>          Explicit identity rekey from a prior slug (Local/Preview only; never Production)
  --source-dir <dir>           Directory containing source assets (optional if assets exist in DB/Storage)
  --package <path>             Immutable package; mutually exclusive with --source-dir
  --allow-stale-package        Allow --package whose sourceHash differs from the current managed definition (intentional only)
  --dry-run                    Simulate changes without performing writes
  --apply                      Perform actual database and storage updates
  --non-interactive            Skip interactive prompts for non-TTY execution
  --confirm-destructive        Destructive operations acknowledgement required for non-interactive apply when plan contains deletions or overwrites
  --acknowledge-discard-unpublished-draft
                               Discard unpublished target-draft edits that diverge from both the package and published content, then apply the package
  --conflict-resolutions <path> JSON { "resolutions": { "<path>": "package"|"target" } } (required when apply has merge conflicts)
  --field-selections <path>    JSON { "resolutions": { "<path>": "package"|"target" } } selective apply (deselected paths keep target)
  --backup-manifest <path>     Optional critical backup manifest for Production promote
  --verbose                    Show full field values and plan IDs in terminal output
  --json                       Format output as JSON
  --owner-user-id <uuid>       Optional override/assertion; new invites default to a dedicated host ({hostLoginAlias}@clientes.celebra.invalid)
  --package-hash <hash>        Shared-store package hash for direct live Preview approval
  --approve                    Run live Preview checks, then request one Cancel-default owner approval
  --preview-provenance         Establish the Preview provenance baseline without changing content (specialized)
  --help, -h                   Show this help message

Legacy filesystem approval import is retired; approvals are created and finalized in the shared Preview store.
Schema BEHIND/DRIFT: run pnpm db:migrate (never auto-migrates from this command).

Production dry-run: --targets production --dry-run. Owner apply: pnpm prod:apply -- --slug <slug> --apply.
`);
}

async function executeLocalTargetPlan(input: {
	slug: string;
	isTTY: boolean;
	nonInteractive: boolean;
	executionPlans: Map<InvitationUpdateTarget, OperationalPlan>;
	rekeyFrom?: string;
	sourceDir?: string;
	ownerUserId?: string;
	updateScope?: UpdateScope;
	assetPolicy?: ReturnType<typeof parseAssetPolicy>;
	pruneAssets: boolean;
	conflictResolutions?: ReturnType<typeof loadConflictResolutionsFile>;
	acknowledgeDiscardUnpublishedDraft?: boolean;
	reports: StageReport[];
}): Promise<{
	executionPlanId: string;
	receiptPlanId: string;
	result: TargetApplyResultData;
}> {
	if (input.isTTY && !input.nonInteractive) {
		const confirmed = await confirm({
			message: `¿Aplicar la release administrada de "${input.slug}" en Local?`,
			default: false,
		});
		if (!confirmed) {
			throw Object.assign(new Error('OPERATOR_CANCELLED'), {
				mutationStarted: false,
				cancelled: true,
			}) as LifecycleExecutionError;
		}
	}
	const localPlan = input.executionPlans.get('local');
	if (!localPlan) {
		throw Object.assign(new Error('No existe un plan confirmado de Local.'), {
			mutationStarted: false,
		}) as LifecycleExecutionError;
	}
	const executedLocal = await planAndApplyLocalContent({
		slug: input.slug,
		apply: true,
		plan: localPlan,
		rekeyFrom: input.rekeyFrom,
		sourceDir: input.sourceDir,
		ownerUserId: input.ownerUserId,
		updateScope: input.updateScope,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		conflictResolutions: input.conflictResolutions,
		acknowledgeDiscardUnpublishedDraft: input.acknowledgeDiscardUnpublishedDraft,
	});
	input.reports.push({
		stage: 'apply',
		environment: 'local',
		status: executedLocal.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
		plannedOperations: executedLocal.plannedOperations,
		completedOperations: executedLocal.completedOperations,
		databaseInserts: executedLocal.databaseInserts,
		databaseUpdates: executedLocal.databaseUpdates,
		databaseDeletes: executedLocal.databaseDeletes,
		storageUploads: executedLocal.storageUploads,
		storageOverwrites: executedLocal.storageOverwrites,
		storageMoves: executedLocal.storageMoves,
		storageDeletes: executedLocal.storageDeletes,
		assetCounts: assetCounts(executedLocal.actions),
		publishedVersion: executedLocal.publishedVersion,
	});
	return {
		executionPlanId: executedLocal.plan.planId,
		receiptPlanId: executedLocal.receipt?.planId ?? '',
		result: {
			target: 'local',
			planId: executedLocal.plan.planId,
			status: executedLocal.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
			completedOperations: executedLocal.completedOperations,
			databaseWrites: {
				inserts: executedLocal.databaseInserts,
				updates: executedLocal.databaseUpdates,
				deletes: executedLocal.databaseDeletes,
			},
			storageMutations: {
				uploads: executedLocal.storageUploads,
				overwrites: executedLocal.storageOverwrites,
				moves: executedLocal.storageMoves,
				deletes: executedLocal.storageDeletes,
			},
			publishedVersion: executedLocal.publishedVersion,
			functionalChanges: executedLocal.functionalChanges,
		},
	};
}

async function executePreviewTargetPlan(input: {
	slug: string;
	isTTY: boolean;
	nonInteractive: boolean;
	resolvedPackage: unknown;
	sourceDir?: string;
	confirmationPackage: InvitationPackageData | undefined;
	executionPlans: Map<InvitationUpdateTarget, OperationalPlan>;
	assetPolicy?: ReturnType<typeof parseAssetPolicy>;
	pruneAssets: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ReturnType<typeof loadConflictResolutionsFile>;
	acknowledgeDiscardUnpublishedDraft?: boolean;
	rekeyFrom?: string;
	ownerUserId?: string;
	reports: StageReport[];
}): Promise<{
	executionPlanId: string;
	receiptPlanId: string;
	result: TargetApplyResultData;
	confirmationPackage?: InvitationPackageData;
}> {
	try {
		await authorizePreviewWriteApply({
			slug: input.slug,
			operation: 'apply',
			confirmPrompt: `Confirm release invitation "${input.slug}" in Preview? Type YES to proceed: `,
			isInteractive: !input.nonInteractive && input.isTTY,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('PREVIEW_WRITE_CANCELLED')) {
			throw Object.assign(new Error('OPERATOR_CANCELLED'), {
				mutationStarted: false,
				cancelled: true,
			}) as LifecycleExecutionError;
		}
		throw error;
	}
	let currentConfirmationPackage = input.confirmationPackage;
	if (!input.resolvedPackage) {
		const packaged = await exportInvitationPackage({
			slug: input.slug,
			sourceDir: input.sourceDir ?? '',
			dryRun: false,
		});
		currentConfirmationPackage = packaged.packageData;
		input.reports.push({
			stage: 'package',
			environment: 'local',
			status: 'UPDATED',
			packageHash: packaged.stats.packageHash,
		});
	}
	let dbUrl: string;
	try {
		const resolved = getPreviewDbUrl();
		assertPreviewDbUrl(resolved.url);
		dbUrl = resolved.url;
	} catch {
		throw Object.assign(
			new Error('PREVIEW_DB_URL no configurada o perímetro inválido.'),
			{ mutationStarted: false },
		) as LifecycleExecutionError;
	}
	const previewPlan = input.executionPlans.get('preview');
	if (!previewPlan) {
		throw Object.assign(new Error('No existe un plan confirmado de Preview.'), {
			mutationStarted: false,
		}) as LifecycleExecutionError;
	}
	if (!currentConfirmationPackage) {
		throw Object.assign(new Error('No existe un paquete de confirmación resuelto para Preview.'), {
			mutationStarted: false,
		}) as LifecycleExecutionError;
	}
	const result = await planAndApplyPreviewContent({
		packageData: currentConfirmationPackage,
		targetDbUrl: dbUrl,
		apply: true,
		plan: previewPlan,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		acknowledgeDiscardUnpublishedDraft: input.acknowledgeDiscardUnpublishedDraft,
		rekeyFrom: input.rekeyFrom,
		ownerUserId: input.ownerUserId,
	});
	const appliedPlan = result.plan;
	if (!appliedPlan) {
		throw Object.assign(new Error('Preview apply returned no plan.'), {
			mutationStarted: true,
		}) as LifecycleExecutionError;
	}
	input.reports.push({
		stage: 'promote',
		environment: 'preview',
		status: result.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
		plannedOperations: result.plannedMutations,
		completedOperations: result.executedMutations,
		databaseInserts: appliedPlan.physicalDatabaseOps.inserts,
		databaseUpdates: appliedPlan.physicalDatabaseOps.updates,
		databaseDeletes: appliedPlan.physicalDatabaseOps.deletes,
		storageUploads: appliedPlan.storageOps.uploads,
		storageOverwrites: appliedPlan.storageOps.overwrites,
		storageMoves: appliedPlan.storageOps.moves,
		storageDeletes: appliedPlan.storageOps.deletes,
		assetCounts: assetCounts(result.actions),
		publishedVersion: result.publishedVersion,
		packageHash: result.packageHash,
		approvalState: 'pending_hosted_validation',
	});
	return {
		executionPlanId: appliedPlan.planId,
		receiptPlanId: result.receipt?.planId ?? '',
		result: {
			target: 'preview',
			planId: appliedPlan.planId,
			status: result.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
			completedOperations: result.executedMutations,
			databaseWrites: appliedPlan.physicalDatabaseOps,
			storageMutations: appliedPlan.storageOps,
			publishedVersion: result.publishedVersion,
			functionalChanges: result.functionalChanges,
		},
		confirmationPackage: currentConfirmationPackage,
	};
}

// eslint-disable-next-line complexity -- CLI handles mode dispatch, interactive prompts, and hosted environment flow gates.
export async function main(argv = process.argv.slice(2)): Promise<void> {
	const args = argv;
	checkUnknownFlags(args);
	const json = args.includes('--json');
	const nonInteractive = args.includes('--non-interactive');
	const verbose = args.includes('--verbose');
	const presenterOptions = { verbose };
	const isTTY = Boolean(process.stdout.isTTY);

	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	const previewProvenance = args.includes('--preview-provenance');
	if (previewProvenance) {
		const slug = value(args, '--slug');
		const targets = parseTargets(value(args, '--targets'));
		const packagePath = value(args, '--package');
		const apply = args.includes('--apply');
		if (
			args.includes('--status') ||
			(!apply && !args.includes('--dry-run')) ||
			!slug ||
			targets.length !== 1 ||
			targets[0] !== 'preview' ||
			!packagePath
		) {
			throw new Error(
				'La reconstrucción de baseline requiere Preview, slug, paquete y --dry-run o --apply.',
			);
		}
		if (apply) {
			await authorizePreviewWriteApply({
				slug,
				operation: 'provenance-baseline',
				confirmPrompt: `Confirm Preview provenance baseline for "${slug}"? Type YES to proceed: `,
				isInteractive: !nonInteractive && isTTY,
			});
		}
		const result = await establishPreviewProvenanceBaseline({
			packagePath,
			apply,
		});
		if (json) console.log(JSON.stringify(result, null, 2));
		else
			console.log(
				`Provenance de Preview: ${result.status === 'BASELINED' ? 'registrada' : result.status === 'IN_SYNC' ? 'ya verificada' : result.status === 'EVIDENCE_UNAVAILABLE' ? 'sin evidencia suficiente' : 'planificada'}.`,
			);
		return;
	}

	const packageHash = value(args, '--package-hash');
	const approve = args.includes('--approve');
	if (packageHash || approve || args.includes('--artifact')) {
		if (args.includes('--artifact')) {
			throw new Error(
				'--artifact was removed. Import legacy approvals once, then use --package-hash <hash> --approve.',
			);
		}
		if (!packageHash || !approve || args.includes('--apply')) {
			throw new Error('Direct Preview approval requires --package-hash <hash> --approve.');
		}
		const pending = getDefaultPreviewApprovalStore().get(packageHash);
		if (!pending) {
			throw new Error(
				`No pending Preview approval exists in the shared store for package ${packageHash}.`,
			);
		}
		const live = await verifyPreviewArtifactLive(pending);
		if (!json) {
			console.log(`Verificación Preview en vivo · ${pending.slug}`);
			for (const key of PREVIEW_LIVE_CHECKLIST_KEYS) {
				console.log(`  ${live.checklistResults[key] ? 'OK' : 'FALLO'}  ${key}`);
			}
		}
		if (!live.ok) {
			const failed = PREVIEW_LIVE_CHECKLIST_KEYS.filter((key) => !live.checklistResults[key]);
			throw new Error(`LIVE_PREVIEW_VERIFICATION_FAILED: ${failed.join(', ')}.`);
		}
		verifyPreviewWriteAuthorization({
			slug: pending.slug,
			targets: ['preview'],
			apply: true,
			operation: 'approve',
			isInteractive: !nonInteractive && isTTY,
		});
		if (!nonInteractive && isTTY) {
			const decision = await select({
				message: `¿Aprobar la release verificada de Preview para "${pending.slug}"?`,
				default: 'cancel',
				choices: [
					{ name: 'Cancelar', value: 'cancel' as const },
					{ name: 'Aprobar Preview', value: 'approve' as const },
				],
			});
			if (decision !== 'approve') {
				throw new Error(
					'PREVIEW_WRITE_CANCELLED: Operator cancelled the Preview approval.',
				);
			}
		}
		const finalized = approvePreviewArtifactFromLiveVerification({
			packageHash,
			reviewedBy: process.env.USERNAME?.trim() || process.env.USER?.trim() || 'preview-owner',
			live,
		});
		const result = {
			approval: finalized.approvalState,
			packageHash: finalized.packageHash,
			slug: finalized.slug,
		};
		if (json) console.log(JSON.stringify(result, null, 2));
		else
			console.log(
				`Aprobación completada: ${result.approval} · ${result.slug} · ${result.packageHash.slice(0, 16)}`,
			);
		return;
	}

	const statusMode = args.includes('--status');
	const apply = args.includes('--apply');
	const dryRun = args.includes('--dry-run');

	const modeCount = (statusMode ? 1 : 0) + (apply ? 1 : 0) + (dryRun ? 1 : 0);
	if (modeCount > 1) {
		throw new Error(
			'Conflicting mode options specified. Choose exactly one of --status, --dry-run, or --apply.',
		);
	}

	if (args.length === 0 && !isTTY) {
		throw new Error('Non-TTY execution requires explicit options and --non-interactive.');
	}

	const slug = value(args, '--slug');
	const rekeyFrom = value(args, '--rekey-from');
	let targets = parseTargets(value(args, '--targets'));
	const sourceDir = value(args, '--source-dir');
	const packagePath = value(args, '--package');

	// Interactive destination wizard (no --status/--dry-run/--apply). Automation keeps flags.
	if (modeCount === 0) {
		if (!isTTY && !nonInteractive) {
			throw new Error(
				'Non-TTY execution requires --non-interactive and explicit mode flags (--status, --dry-run, or --apply).',
			);
		}

		if (isTTY && !nonInteractive && !json) {
			// Ignore leftover --targets from shell history; destination menu owns the outcome.
			await runDestinationReleaseWizard({ slug });
			return;
		}
	}

	const rawScope = value(args, '--update-scope');
	const updateScope: UpdateScope =
		rawScope === 'content-and-assets' || rawScope === 'assets-only' ? rawScope : 'content-only';

	const conflictResolutionsPath = value(args, '--conflict-resolutions');
	const fieldSelectionsPath = value(args, '--field-selections');
	let conflictResolutions: ConflictResolutions | undefined;
	const fileConflictResolutions = conflictResolutionsPath
		? loadConflictResolutionsFile(conflictResolutionsPath)
		: undefined;
	const fileFieldSelections = fieldSelectionsPath
		? loadConflictResolutionsFile(fieldSelectionsPath, 'selección de campos')
		: undefined;
	conflictResolutions = mergePathPolicies(fileFieldSelections, fileConflictResolutions);

	const rawAssetPolicy =
		value(args, '--asset-policy') ?? (updateScope === 'content-only' ? 'preserve' : 'missing');
	const pruneAssets = args.includes('--prune-assets');
	const acknowledgeDiscardUnpublishedDraft = args.includes(
		'--acknowledge-discard-unpublished-draft',
	);
	const assetPolicy = parseAssetPolicy(rawAssetPolicy);
	if (assetPolicy === 'preserve' && updateScope === 'content-and-assets') {
		throw new Error(
			'Asset policy "preserve" conflicts with update scope "content-and-assets". Choose verify, missing, or sync.',
		);
	}

	// Default targets to local if interactive or unassigned
	if (targets.length === 0 && (slug || statusMode)) {
		targets = ['local'];
	}

	const requestedTargets = value(args, '--targets') ?? targets.join(',');
	targets = statusMode
		? parseTargets(requestedTargets)
		: parseReleaseMutationTargets(requestedTargets);
	if (targets.length === 0 && (slug || statusMode)) {
		targets = ['local'];
	}
	validateUpdateOptions({
		slug,
		targets,
		rekeyFrom,
		isMutation: !statusMode,
		allowProductionMutation: true,
	});

	if (statusMode) {
		const statusReportOptions = {
			slug,
			targets: targets.length > 0 ? targets : undefined,
			includeLegacy: args.includes('--include-legacy'),
			includeArchived: args.includes('--include-archived'),
			includeDemos: args.includes('--include-demos'),
		};
		const report = buildStatusReport(statusReportOptions) as StatusReportData &
			Record<string, unknown>;

		if (targets.includes('local')) {
			const definitions = listInvitationDefinitions();
			const definitionSlugs = slug ? [slug] : definitions.map((d) => d.slug);
			const fastInventory = readFastInvitationInventory(LOCAL_DB_URL, definitionSlugs, slug);
			report.inventory = { local: fastInventory };

			if (fastInventory.verified) {
				for (const def of report.definitions) {
					const match = fastInventory.rows.find((r) => r.slug === def.slug);
					if (match) {
						def.environments.local = {
							status: match.status,
							managedStatus:
								match.status === 'MANAGED' ? 'MANAGED' : 'UNAPPLIED_DEFINITION',
							syncStatus: 'UNEVALUATED',
							reason:
								match.status === 'MANAGED'
									? 'Persistent-local database record and release provenance verified.'
									: 'Persistent-local database record exists but lacks provenance.',
						};
						if (targets.length === 1 && targets[0] === 'local') {
							def.classification = match.status;
						}
					}
				}
			}

			if (slug) {
				try {
					report.readiness = await evaluateInvitationReadiness({ slug });
				} catch {
					// Readiness check failure is captured in inventory report without crashing status.
				}
			}
		}

		if (json) {
			console.log(JSON.stringify(report, null, 2));
		} else {
			console.log(formatStatusReport(report));
		}
		return;
	}

	if ((apply ? 1 : 0) + (dryRun ? 1 : 0) !== 1) {
		throw new Error('Specify exactly one of --dry-run or --apply.');
	}

	if (!slug || targets.length === 0) {
		throw new Error(
			'Non-interactive mode requires --slug, --targets, and --dry-run or --apply.',
		);
	}

	const definition = getInvitationDefinition(slug);

	// ── Production promote (approved Preview → Production) ───────────────────
	if (targets.length === 1 && targets[0] === 'production') {
		await runProductionReleaseDispatch({
			slug,
			definition,
			sourceDir,
			packagePath,
			allowStalePackage: args.includes('--allow-stale-package'),
			ownerUserId: value(args, '--owner-user-id'),
			assetPolicyRaw: value(args, '--asset-policy'),
			pruneAssets: args.includes('--prune-assets'),
			updateScope: (() => {
				const raw = value(args, '--update-scope');
				return raw === 'content-and-assets' ||
					raw === 'assets-only' ||
					raw === 'content-only'
					? raw
					: undefined;
			})(),
			conflictResolutionsPath: value(args, '--conflict-resolutions'),
			backupManifestPath: value(args, '--backup-manifest'),
			apply: Boolean(apply),
			json,
			verbose,
		});
		return;
	}

	const ownerUserId = value(args, '--owner-user-id');
	const reports: StageReport[] = [];
	let targetPlans: TargetPlanData[] = [];
	// Used by apply presentation and exit-code derivation after executeTargetPlans.
	const targetResults: TargetApplyResultData[] = [];
	const executionPlans = new Map<InvitationUpdateTarget, OperationalPlan>();
	let packageInput;
	try {
		packageInput = await resolveInvitationPackageInput({
			slug,
			sourceDir,
			packagePath,
			allowStalePackage: args.includes('--allow-stale-package'),
		});
	} catch (error) {
		const inputError =
			error instanceof PackageInputError
				? error
				: new PackageInputError(
						'PACKAGE_INVALID',
						'No fue posible resolver un paquete válido. Corrija el origen y vuelva a ejecutar el preflight.',
						error,
					);
		const technicalDetail = sanitizeMessage(
			inputError.technicalCause instanceof Error
				? inputError.technicalCause.message
				: String(inputError.technicalCause ?? inputError.code),
		);
		const blockedPlans: TargetPlanData[] = targets.map((target) => ({
			target,
			status: 'BLOQUEADO',
			reason: inputError.safeReason,
			plannedOperations: 0,
			expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			actions: [],
		}));
		const inputReports: StageReport[] = targets.map((target) => ({
			stage: 'package',
			environment: target,
			status: 'BLOCKED',
			reasonCode: inputError.code,
			reason: inputError.safeReason,
			remainingAction: `Detalle técnico sanitizado: ${technicalDetail}`,
		}));
		if (apply) {
			const blockedResults = buildPreflightBlockedResults(targets, blockedPlans) ?? [];
			if (json) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							status: 'BLOQUEADO',
							reasonCode: inputError.code,
							reason: inputError.safeReason,
							targetPlans: blockedPlans,
							targetResults: blockedResults,
							reports: inputReports,
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					formatApplyResult({
						invitation: slug,
						status: 'BLOQUEADO',
						environment: targets.join(', '),
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: inputError.safeReason,
						targetResults: blockedResults,
					}),
				);
			}
		} else {
			const blockedPlan: OperationalPlanData = {
				invitation: slug,
				targets,
				isZeroDrift: false,
				plannedOperations: 0,
				expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
				targetPlans: blockedPlans,
			};
			if (json) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							status: 'BLOCKED',
							reasonCode: inputError.code,
							reason: inputError.safeReason,
							reports: inputReports,
							plan: blockedPlan,
						},
						null,
						2,
					),
				);
			} else {
				console.error(formatDryRunPlan(blockedPlan, presenterOptions));
			}
		}
		process.exitCode = 1;
		return;
	}
	const resolvedPackage = packageInput.packagePath;
	let confirmationPackage: InvitationPackageData = packageInput.packageData;

	let localResult: LocalApplyResult | undefined;
	let isZeroDrift = false;
	let plannedOperations = 0;
	let planData: OperationalPlanData | undefined;
	let selectionPassDone = Boolean(fileFieldSelections);

	// ── PREFLIGHT INSPECTION PHASE FOR ALL SELECTED TARGETS ─────────────────────
	while (true) {
		reports.length = 0;
		targetPlans = [];
		executionPlans.clear();
		localResult = undefined;

		for (const target of targets) {
			if (target === 'local') {
				try {
					assertContentSchemaCurrent({ target: 'local', dbUrl: LOCAL_DB_URL });
					localResult = await planAndApplyLocalContent({
						slug,
						apply: false,
						rekeyFrom,
						updateScope,
						assetPolicy,
						pruneAssets,
						conflictResolutions,
						acknowledgeDiscardUnpublishedDraft,
					});
					executionPlans.set('local', localResult.plan);
					targetPlans.push({
						target: 'local',
						planId: localResult.plan?.planId,
						status: localResult.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS PENDIENTES',
						plannedOperations: localResult.plannedOperations,
						expectedDatabaseWrites: {
							inserts: localResult.databaseInserts,
							updates: localResult.databaseUpdates,
							deletes: localResult.databaseDeletes,
						},
						expectedStorageMutations: {
							uploads: localResult.storageUploads,
							overwrites: localResult.storageOverwrites,
							moves: localResult.storageMoves,
							deletes: localResult.storageDeletes,
						},
						actions: localResult.actions,
						functionalChanges: localResult.functionalChanges,
						publishedVersion: localResult.publishedVersion,
					});
					reports.push({
						stage: 'plan',
						environment: 'local',
						status: localResult.isZeroDrift ? 'IN_SYNC' : 'SKIPPED',
						plannedOperations: localResult.plannedOperations,
						completedOperations: 0,
						databaseInserts: localResult.databaseInserts,
						databaseUpdates: localResult.databaseUpdates,
						databaseDeletes: localResult.databaseDeletes,
						storageUploads: localResult.storageUploads,
						storageOverwrites: localResult.storageOverwrites,
						storageMoves: localResult.storageMoves,
						storageDeletes: localResult.storageDeletes,
						assetCounts: assetCounts(localResult.actions),
						publishedVersion: localResult.publishedVersion,
					});
				} catch (error) {
					const errMsg = sanitizeMessage(
						error instanceof Error ? error.message : String(error),
					);
					targetPlans.push({
						target: 'local',
						status: 'BLOQUEADO',
						reason: errMsg,
						mergeConflicts: mergeConflictsFromError(error),
						plannedOperations: 0,
						expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						expectedStorageMutations: {
							uploads: 0,
							overwrites: 0,
							moves: 0,
							deletes: 0,
						},
						actions: [],
					});
					reports.push({
						stage: 'plan',
						environment: 'local',
						status: 'BLOCKED',
						reasonCode: 'LOCAL_PLAN_BLOCKED',
						reason: errMsg,
					});
				}
			} else if (target === 'preview') {
				let targetDbUrl: string | undefined;
				try {
					const resolved = getPreviewDbUrl();
					assertPreviewDbUrl(resolved.url);
					targetDbUrl = resolved.url;
				} catch {
					targetDbUrl = undefined;
				}

				if (!targetDbUrl) {
					reports.push({
						stage: 'plan',
						environment: 'preview',
						status: 'BLOCKED',
						reasonCode: 'PREVIEW_CREDENTIALS_UNAVAILABLE',
						reason: 'Credenciales de preview no configuradas o perímetro inválido.',
						remainingAction:
							'Configurar PREVIEW_DB_URL del proyecto Preview canónico y reejecutar el comando.',
					});
					targetPlans.push({
						target: 'preview',
						status: 'BLOQUEADO',
						reason: 'No se realizó una inspección remota (credenciales de preview no configuradas o perímetro inválido).',
						plannedOperations: 0,
						expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						expectedStorageMutations: {
							uploads: 0,
							overwrites: 0,
							moves: 0,
							deletes: 0,
						},
						actions: [],
					});
				} else {
					try {
						assertContentSchemaCurrent({ target: 'preview', dbUrl: targetDbUrl });
						const engineOptions = resolvedPackage
							? {
									packagePath: resolvedPackage,
									target: 'preview' as const,
									targetDbUrl,
									dryRun: true,
									assetPolicy,
									pruneAssets,
									updateScope,
									conflictResolutions,
									acknowledgeDiscardUnpublishedDraft,
									rekeyFrom,
									ownerUserId,
								}
							: {
									packageData: confirmationPackage,
									target: 'preview' as const,
									targetDbUrl,
									dryRun: true,
									assetPolicy,
									pruneAssets,
									updateScope,
									conflictResolutions,
									acknowledgeDiscardUnpublishedDraft,
									rekeyFrom,
									ownerUserId,
								};
						const result = await runImportEngine(engineOptions);
						assertEngineResult(result, undefined, 'Preview', false);
						executionPlans.set('preview', result.plan);
						reports.push({
							stage: 'plan',
							environment: 'preview',
							status: result.isZeroDrift ? 'IN_SYNC' : 'SKIPPED',
							plannedOperations: result.plannedMutations,
							completedOperations: 0,
							assetCounts: assetCounts(result.actions),
							publishedVersion: result.publishedVersion,
							packageHash: result.packageHash,
						});
						targetPlans.push({
							target: 'preview',
							planId: result.plan.planId,
							status: result.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS PENDIENTES',
							plannedOperations: result.plannedMutations,
							expectedDatabaseWrites: result.plan.physicalDatabaseOps,
							expectedStorageMutations: result.plan.storageOps,
							actions: result.actions,
							functionalChanges: result.functionalChanges,
							publishedVersion: result.publishedVersion,
						});
					} catch (error) {
						const errMsg = sanitizeMessage(
							error instanceof Error ? error.message : String(error),
						);
						const previewReason = isTargetDivergenceConflictMessage(errMsg)
							? errMsg
							: 'No fue posible inspeccionar Preview de forma segura. Revise credenciales, identidad del proyecto, conectividad y estado remoto antes de volver a planificar.';
						reports.push({
							stage: 'plan',
							environment: 'preview',
							status: 'BLOCKED',
							reasonCode: isTargetDivergenceConflictMessage(errMsg)
								? 'TARGET_DIVERGENCE_CONFLICT'
								: 'PREVIEW_PLAN_BLOCKED',
							reason: previewReason,
							remainingAction: isTargetDivergenceConflictMessage(errMsg)
								? errMsg
								: `Detalle técnico sanitizado: ${errMsg}`,
						});
						targetPlans.push({
							target: 'preview',
							status: 'BLOQUEADO',
							reason: previewReason,
							mergeConflicts: mergeConflictsFromError(error),
							plannedOperations: 0,
							expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
							expectedStorageMutations: {
								uploads: 0,
								overwrites: 0,
								moves: 0,
								deletes: 0,
							},
							actions: [],
						});
					}
				}
			}
		}

		isZeroDrift = targetPlans.every((tp) => tp.status === 'SIN CAMBIOS');
		plannedOperations = targetPlans.reduce((sum, tp) => sum + tp.plannedOperations, 0);

		// Operational plan for presentation
		planData = {
			planId: localResult?.plan?.planId,
			invitation: slug,
			targets,
			isZeroDrift,
			plannedOperations,
			expectedDatabaseWrites: {
				inserts: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedDatabaseWrites.inserts,
					0,
				),
				updates: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedDatabaseWrites.updates,
					0,
				),
				deletes: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedDatabaseWrites.deletes,
					0,
				),
			},
			expectedStorageMutations: {
				uploads: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedStorageMutations.uploads,
					0,
				),
				overwrites: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedStorageMutations.overwrites,
					0,
				),
				moves: targetPlans.reduce(
					(sum, tp) => sum + (tp.expectedStorageMutations.moves ?? 0),
					0,
				),
				deletes: targetPlans.reduce(
					(sum, tp) => sum + tp.expectedStorageMutations.deletes,
					0,
				),
			},
			actions: localResult ? localResult.actions : [],
			functionalChanges: consolidateTargetFunctionalChanges(targetPlans),
			publishedVersion: localResult?.publishedVersion,
			targetPlans,
		};

		const hasBlockedTarget = targetPlans.some(
			(tp) => tp.status === 'BLOQUEADO' || tp.status === 'NO EVALUADO',
		);
		if (
			!selectionPassDone &&
			isTTY &&
			!nonInteractive &&
			!json &&
			!isZeroDrift &&
			!hasBlockedTarget &&
			(planData.functionalChanges?.length ?? 0) > 0
		) {
			selectionPassDone = true;
			const selectedPolicy = await promptFieldSelection({ plan: planData });
			if (selectedPolicy) {
				conflictResolutions = mergePathPolicies(selectedPolicy, conflictResolutions);
				continue;
			}
		}
		break;
	}

	// ── HANDLE DRY-RUN MODE ──────────────────────────────────────────────────
	if (dryRun) {
		const allConflicts = collectPlanConflicts(targetPlans);
		const suggestedResolutions =
			allConflicts.length > 0 ? suggestConflictResolutionsFile(allConflicts) : undefined;
		if (json) {
			const status = reports.some((report) => report.status === 'BLOCKED')
				? 'BLOCKED'
				: reports.length > 0 && reports.every((report) => report.status === 'IN_SYNC')
					? 'IN_SYNC'
					: 'SKIPPED';
			console.log(
				JSON.stringify(
					{
						invitation: slug,
						reports,
						plan: planData,
						status,
						suggestedConflictResolutions: suggestedResolutions,
					},
					null,
					2,
				),
			);
		} else {
			console.log(formatDryRunPlan(planData, presenterOptions));
			if (suggestedResolutions) {
				console.log('');
				console.log(
					'Resoluciones sugeridas (guarde en un archivo y use --conflict-resolutions):',
				);
				console.log(JSON.stringify(suggestedResolutions, null, 2));
			}
		}
		if (targetPlans.some((tp) => tp.status === 'BLOQUEADO' || tp.status === 'NO EVALUADO')) {
			process.exitCode = 1;
		}
		return;
	}

	// ── HANDLE APPLY MODE ────────────────────────────────────────────────────
	if (apply) {
		// Merge conflicts require an explicit --conflict-resolutions file before apply
		const planConflicts = collectPlanConflicts(targetPlans);
		const onlyMergeBlocks =
			planConflicts.length > 0 &&
			targetPlans
				.filter((tp) => tp.status === 'BLOQUEADO' || tp.status === 'NO EVALUADO')
				.every((tp) => (tp.mergeConflicts?.length ?? 0) > 0);
		if (onlyMergeBlocks && !conflictResolutions) {
			console.error(
				'Hay conflictos de merge. Proporcione --conflict-resolutions <archivo.json> con elecciones "package" o "target" por path.',
			);
			console.log(JSON.stringify(suggestConflictResolutionsFile(planConflicts), null, 2));
			process.exitCode = 1;
			return;
		}

		// Mandatory Preflight Block Check BEFORE any mutation or confirmation prompt
		const blockedTarget = targetPlans.find(
			(tp) => tp.status === 'BLOQUEADO' || tp.status === 'NO EVALUADO',
		);
		const blockedResults = buildPreflightBlockedResults(targets, targetPlans);
		if (blockedResults) {
			const blockingReason =
				blockedTarget?.reason ??
				blockedResults.find((result) => result.reason)?.reason ??
				'El preflight obligatorio no concluyó correctamente.';
			const shortHash = confirmationPackage.packageHash
				? confirmationPackage.packageHash.slice(0, 8)
				: undefined;
			if (json) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							status: 'BLOQUEADO',
							reasonCode: 'PREFLIGHT_BLOCKED',
							reason: blockingReason,
							packageHashShort: shortHash,
							targetPlans,
							targetResults: blockedResults,
							reports,
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					formatApplyResult({
						invitation: slug,
						status: 'BLOQUEADO',
						environment: targets.join(', '),
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: blockingReason,
						targetResults: blockedResults,
					}),
				);
			}
			process.exitCode = 1;
			return;
		}

		// Content already in sync: skip apply only when Preview is not selected.
		// Preview still needs runPreviewApply so the shared pending approval artifact exists
		// (promote requires it even when content mutations are zero).
		if (isZeroDrift && !targets.includes('preview')) {
			for (const tp of targetPlans) {
				targetResults.push({
					target: tp.target,
					planId: tp.planId,
					status: 'SIN CAMBIOS',
					completedOperations: 0,
					databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					publishedVersion: tp.publishedVersion,
					functionalChanges: tp.functionalChanges,
				});
			}
			if (json) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							reports,
							plan: planData,
							targetResults,
							status: 'SIN CAMBIOS',
							reason: 'La invitación ya está sincronizada. No hay cambios por aplicar.',
						},
						null,
						2,
					),
				);
			} else {
				console.log(
					formatApplyResult({
						invitation: slug,
						status: 'SIN CAMBIOS',
						environment: targets.join(', '),
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: 'La invitación ya está sincronizada. No hay cambios por aplicar.',
						targetResults,
					}),
				);
			}
			return;
		}

		const destInfo = {
			hasDestructive: targetPlans.some(
				(tp) =>
					tp.expectedDatabaseWrites.deletes > 0 ||
					tp.expectedStorageMutations.deletes > 0 ||
					tp.expectedStorageMutations.overwrites > 0,
			),
			databaseDeletes: targetPlans.reduce(
				(s, tp) => s + tp.expectedDatabaseWrites.deletes,
				0,
			),
			storageDeletes: targetPlans.reduce(
				(s, tp) => s + tp.expectedStorageMutations.deletes,
				0,
			),
			storageOverwrites: targetPlans.reduce(
				(s, tp) => s + tp.expectedStorageMutations.overwrites,
				0,
			),
		};

		// ── PLAN REVIEW (authorization happens once per target write below) ──────
		console.log(formatApplyConfirmation(planData, presenterOptions));
		if (nonInteractive && destInfo.hasDestructive && !args.includes('--confirm-destructive')) {
			throw new Error(
				`El plan contiene operaciones destructivas (${destInfo.databaseDeletes} eliminaciones DB, ${destInfo.storageDeletes} eliminaciones Storage, ${destInfo.storageOverwrites} sobrescrituras Storage). La ejecución no interactiva requiere --confirm-destructive.`,
			);
		}

		const emitCancellation = (): void => {
			targetResults.push(...buildCancellationResults(targets, targetPlans));
			const cancelResult = {
				invitation: slug,
				reports,
				targetResults,
				status: 'CANCELLED' as const,
				reason: 'OPERATOR_CANCELLED',
			};
			if (json) console.log(JSON.stringify(cancelResult, null, 2));
			else
				console.log(
					formatApplyResult({
						planId: localResult?.plan?.planId,
						invitation: slug,
						status: 'CANCELLED',
						environment: targets.join(', '),
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: 'Cancelado por el operador.',
						functionalChanges: planData.functionalChanges,
						targetResults,
					}),
				);
		};

		// Execute retained target plans in deterministic order through the shared lifecycle core.
		// Exactly one environment-appropriate authorization immediately before each write.
		const executionSummary = await executeTargetPlans({
			targets,
			targetPlans,
			sanitizeError: (error) =>
				sanitizeMessage(error instanceof Error ? error.message : String(error)),
			executeTarget: async (target) => {
				if (target === 'local') {
					return executeLocalTargetPlan({
						slug,
						isTTY,
						nonInteractive,
						executionPlans,
						rekeyFrom,
						sourceDir,
						ownerUserId,
						updateScope,
						assetPolicy,
						pruneAssets,
						conflictResolutions,
						acknowledgeDiscardUnpublishedDraft,
						reports,
					});
				}

				if (target === 'preview') {
					const previewRes = await executePreviewTargetPlan({
						slug,
						isTTY,
						nonInteractive,
						resolvedPackage,
						sourceDir,
						confirmationPackage,
						executionPlans,
						assetPolicy,
						pruneAssets,
						updateScope,
						conflictResolutions,
						acknowledgeDiscardUnpublishedDraft,
						rekeyFrom,
						ownerUserId,
						reports,
					});
					if (previewRes.confirmationPackage) {
						confirmationPackage = previewRes.confirmationPackage;
					}
					return {
						executionPlanId: previewRes.executionPlanId,
						receiptPlanId: previewRes.receiptPlanId,
						result: previewRes.result,
					};
				}

				throw new Error(
					'PRODUCTION_PROMOTION_REQUIRED: Use --targets production for owner-only Production promote via invitation:release.',
				);
			},
		});
		if (
			executionSummary.targetResults.some((result) =>
				(result.reason ?? '').includes('OPERATOR_CANCELLED'),
			)
		) {
			emitCancellation();
			return;
		}
		targetResults.push(...executionSummary.targetResults);
		const executionFailed = executionSummary.executionFailed;

		if (executionFailed || deriveLifecycleExitCode(targetResults) !== 0) process.exitCode = 1;

		// PRESENTATION FOR APPLY RESULT (HUMAN AND JSON)
		if (json) {
			console.log(
				JSON.stringify({ invitation: slug, reports, targetResults, targetPlans }, null, 2),
			);
		} else {
			console.log(
				formatApplyResult({
					invitation: slug,
					status: deriveLifecycleFinalStatus(targetResults),
					environment: targets.join(', '),
					completedOperations: targetResults.reduce(
						(sum, tr) => sum + tr.completedOperations,
						0,
					),
					databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					targetResults,
				}),
			);
			const pendingPreview = reports.find(
				(report) =>
					report.environment === 'preview' &&
					report.approvalState === 'pending_hosted_validation' &&
					typeof report.packageHash === 'string',
			);
			if (pendingPreview?.packageHash) {
				console.log('');
				console.log(
					`Aprobación Preview pendiente (package-hash ${pendingPreview.packageHash}).`,
				);
				console.log(
					'Verifique y apruebe Preview en vivo; después promueva con el mismo comando:\n' +
						`  pnpm invitation:release -- --package-hash ${pendingPreview.packageHash} --approve\n` +
						`  pnpm invitation:release -- --slug ${slug} --targets production --dry-run`,
				);
			}
		}
	}
}

if (
	typeof process.argv[1] === 'string' &&
	/invitation-release-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1])
) {
	main().catch((error: unknown) => {
		const message = sanitizeMessage(error instanceof Error ? error.message : String(error));
		const argv = process.argv.slice(2);
		const slug = value(argv, '--slug') ?? 'no especificada';
		if (argv.includes('--apply')) {
			let failedTargets: InvitationUpdateTarget[] = [];
			try {
				failedTargets = parseTargets(value(argv, '--targets'));
			} catch {
				// The invalid target selection itself is the preflight failure.
			}
			const targetResults: TargetApplyResultData[] = failedTargets.map((target) => ({
				target,
				status: 'BLOQUEADO',
				reason: message,
				completedOperations: 0,
				databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			}));
			if (argv.includes('--json')) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							status: 'BLOQUEADO',
							reasonCode: 'PREFLIGHT_OR_EXECUTION_FAILED',
							reason: message,
							targetResults,
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					formatApplyResult({
						invitation: slug,
						status: 'BLOQUEADO',
						environment: failedTargets.join(', ') || 'no especificado',
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: message,
						targetResults,
					}),
				);
			}
		} else {
			console.error(message);
		}
		process.exitCode = 1;
	});
}
