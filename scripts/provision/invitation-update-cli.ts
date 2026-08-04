#!/usr/bin/env node
/** The sole public managed-invitation release command. */
/* eslint-disable max-lines, no-useless-assignment -- Managed release CLI handles mode dispatch, per-target planning, and interactive wizard. */
import { confirm, select } from '@inquirer/prompts';
import { applyLocalInvitation, type LocalApplyResult } from './apply-local-invitation.ts';
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
	parseMutationTargets,
	parseTargets,
	checkUnknownFlags,
	validateUpdateOptions,
	type InvitationUpdateTarget,
} from './invitation-update-options.ts';
import { verifyPreviewWriteAuthorization } from './preview-write-auth.ts';
import { readFastInvitationInventory } from './invitation-status-inventory.ts';
import { evaluateInvitationReadiness } from './invitation-readiness.ts';
import { LOCAL_DB_URL, redactCredentials } from '../db/db-target-config.ts';
import { getSecretFromEnvOrFiles, PREVIEW_SECRET_FILES } from '../db/db-workflow-lib.ts';
import { finalizePreviewApprovalArtifact } from './preview-approval-service.ts';
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
import { runPreviewApply } from './preview-apply.ts';
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

export function printHelp(): void {
	console.log(`
invitation:update — Unified managed invitation update/release CLI

Usage:
  pnpm invitation:update                                             Interactive wizard (TTY only)
  pnpm invitation:update --status [--slug <slug>] [--targets <targets>] [--json]
  pnpm invitation:update --slug <slug> --targets local|preview|local,preview --dry-run|--apply [--non-interactive] [--source-dir <dir>|--package <path>]
  pnpm invitation:update --artifact <path> --evidence <path> --apply
  pnpm invitation:update --preview-provenance --slug <slug> --targets preview --package <path> --dry-run [--json]
  pnpm invitation:update --preview-provenance --slug <slug> --targets preview --package <path> --approval-artifact <path> --apply [--json]

Options:
  --asset-policy <policy>     Asset handling policy: verify, missing (default), sync
  --prune-assets               Enable explicit removal of unreferenced managed assets (requires confirmation)
  --status                     Local inventory status (remotes unprobed; use pnpm dbs for matrix)
  --targets <targets>          Mutations: local, preview, local,preview. --targets all and Production mutations are rejected.
                               Status only: local, preview, production, all (all includes Production read-only).
  --slug <slug>                Invitation slug (e.g. romina-rios-chaparro)
  --source-dir <dir>           Directory containing source assets (optional if assets exist in DB/Storage)
  --package <path>             Immutable package; mutually exclusive with --source-dir
  --allow-stale-package        Allow --package whose sourceHash differs from the current managed definition (intentional only)
  --dry-run                    Simulate changes without performing writes
  --apply                      Perform actual database and storage updates
  --non-interactive            Skip interactive prompts for non-TTY execution
  --confirm-destructive        Destructive operations acknowledgement required for non-interactive apply when plan contains deletions or overwrites
  --conflict-resolutions <path> JSON { "resolutions": { "<path>": "package"|"target" } } (required when apply has merge conflicts)
  --field-selections <path>    JSON { "resolutions": { "<path>": "package"|"target" } } selective apply (deselected paths keep target)
  --verbose                    Show full field values and plan IDs in terminal output
  --json                       Format output as JSON
  --owner-user-id <uuid>       Optional override/assertion; new invites default to a dedicated host ({hostLoginAlias}@clientes.celebra.invalid)
  --approval-artifact <path>   Exact approved Preview artifact required for --preview-provenance apply
  --preview-provenance         Establish the Preview provenance baseline without changing content (specialized)
  --help, -h                   Show this help message

Production managed-content promotion uses:
  pnpm invitation:promote -- --slug <slug> --package <path> --dry-run|--apply
`);
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
		const approvalArtifactPath = value(args, '--approval-artifact');
		const apply = args.includes('--apply');
		if (
			args.includes('--status') ||
			(!apply && !args.includes('--dry-run')) ||
			!slug ||
			targets.length !== 1 ||
			targets[0] !== 'preview' ||
			!packagePath ||
			(apply && !approvalArtifactPath)
		) {
			throw new Error(
				'La reconstrucción de baseline requiere Preview, slug, paquete, aprobación y --dry-run o --apply.',
			);
		}
		const result = await establishPreviewProvenanceBaseline({
			packagePath,
			approvalArtifactPath,
			apply,
		});
		if (json) console.log(JSON.stringify(result, null, 2));
		else
			console.log(
				`Provenance de Preview: ${result.status === 'BASELINED' ? 'registrada' : result.status === 'IN_SYNC' ? 'ya verificada' : result.status === 'EVIDENCE_UNAVAILABLE' ? 'sin evidencia suficiente' : 'planificada'}.`,
			);
		return;
	}

	const artifact = value(args, '--artifact');
	const evidence = value(args, '--evidence');
	if (artifact || evidence) {
		if (!artifact || !evidence || !args.includes('--apply'))
			throw new Error('Approval requires --artifact <path> --evidence <path> --apply.');
		const result = {
			approval: finalizePreviewApprovalArtifact(artifact, evidence).approvalState,
		};
		if (json) console.log(JSON.stringify(result, null, 2));
		else console.log(`Aprobación completada: ${result.approval}`);
		return;
	}

	let statusMode = args.includes('--status');
	let apply = args.includes('--apply');
	let dryRun = args.includes('--dry-run');

	const modeCount = (statusMode ? 1 : 0) + (apply ? 1 : 0) + (dryRun ? 1 : 0);
	if (modeCount > 1) {
		throw new Error(
			'Conflicting mode options specified. Choose exactly one of --status, --dry-run, or --apply.',
		);
	}

	if (args.length === 0 && !isTTY) {
		throw new Error('Non-TTY execution requires explicit options and --non-interactive.');
	}

	let slug = value(args, '--slug');
	const rekeyFrom = value(args, '--rekey-from');
	let targets = parseTargets(value(args, '--targets'));
	const sourceDir = value(args, '--source-dir');
	const packagePath = value(args, '--package');

	// Interactive Wizard Flow
	if (modeCount === 0) {
		if (!isTTY && !nonInteractive) {
			throw new Error(
				'Non-TTY execution requires --non-interactive and explicit mode flags (--status, --dry-run, or --apply).',
			);
		}

		if (isTTY && !nonInteractive && !json) {
			console.log('=== Celebra-me Managed Invitation Update Wizard ===\n');
			if (!slug) {
				slug = await select({
					message: 'Selecciona la invitación administrada',
					choices: listInvitationDefinitions()
						.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
						.map((definition) => ({
							name: `${definition.title} · ${definition.slug}`,
							value: definition.slug,
						})),
				});
			}
			const operation = await select({
				message: 'Selecciona la operación a realizar',
				choices: [
					{ name: '1. Ver estado e inventario (status)', value: 'status' },
					{ name: '2. Simular cambios sin escribir (dry-run)', value: 'dry-run' },
					{ name: '3. Aplicar actualización (apply)', value: 'apply' },
				],
			});

			if (operation === 'status') statusMode = true;
			else if (operation === 'dry-run') dryRun = true;
			else if (operation === 'apply') apply = true;

			if (targets.length === 0) {
				const choices = statusMode
					? [
							{ name: 'Local (127.0.0.1:54322)', value: 'local' },
							{ name: 'Preview', value: 'preview' },
							{ name: 'Producción (solo lectura)', value: 'production' },
							{ name: 'Todos los entornos (solo lectura)', value: 'all' },
						]
					: [
							{ name: 'Local (127.0.0.1:54322)', value: 'local' },
							{ name: 'Preview', value: 'preview' },
							{ name: 'Local y Preview', value: 'local,preview' },
						];
				const selected = await select({
					message: 'Selecciona el entorno de destino',
					choices,
				});
				targets = statusMode ? parseTargets(selected) : parseMutationTargets(selected);
			}

			if (!statusMode) {
				const scopeChoice = await select({
					message: '¿Qué deseas actualizar?',
					choices: [
						{ name: 'Solo contenido', value: 'content-only' },
						{ name: 'Contenido y fotografías', value: 'content-and-assets' },
						{ name: 'Solo fotografías', value: 'assets-only' },
					],
				});
				args.push('--update-scope', scopeChoice);

				if (scopeChoice === 'content-only') {
					args.push('--asset-policy', 'preserve');
				} else {
					const policyChoice = await select({
						message: '¿Cómo deseas manejar las fotografías y otros archivos?',
						choices: [
							{
								name: 'Verificar y reutilizar los existentes (verify)',
								value: 'verify',
							},
							{
								name: 'Subir únicamente los archivos faltantes (missing)',
								value: 'missing',
							},
							{
								name: 'Sincronizar archivos faltantes y modificados (sync)',
								value: 'sync',
							},
						],
					});
					args.push('--asset-policy', policyChoice);
				}
			}
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
	const assetPolicy = parseAssetPolicy(rawAssetPolicy);

	// Default targets to local if interactive or unassigned
	if (targets.length === 0 && (slug || statusMode)) {
		targets = ['local'];
	}

	const requestedTargets = value(args, '--targets') ?? targets.join(',');
	targets = statusMode ? parseTargets(requestedTargets) : parseMutationTargets(requestedTargets);
	if (targets.length === 0 && (slug || statusMode)) {
		targets = ['local'];
	}
	validateUpdateOptions({ slug, targets, rekeyFrom, isMutation: !statusMode });

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

	getInvitationDefinition(slug);
	verifyPreviewWriteAuthorization({
		slug,
		targets,
		apply,
		isInteractive: !nonInteractive && isTTY,
		operation: 'apply',
	});
	if (apply && targets.includes('preview') && isTTY && !nonInteractive) {
		const previewConfirmed = await confirm({
			message: `¿Confirma la escritura administrada en Preview para "${slug}"?`,
			default: false,
		});
		if (!previewConfirmed) {
			throw new Error(
				'PREVIEW_WRITE_CANCELLED: El operador canceló la escritura en Preview.',
			);
		}
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
					localResult = await applyLocalInvitation({
						slug,
						rekeyFrom,
						sourceDir,
						ownerUserId,
						apply: false,
						updateScope,
						assetPolicy,
						pruneAssets,
						conflictResolutions,
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
					targetDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
				} catch {
					targetDbUrl = undefined;
				}

				if (!targetDbUrl) {
					reports.push({
						stage: 'plan',
						environment: 'preview',
						status: 'BLOCKED',
						reasonCode: 'PREVIEW_CREDENTIALS_UNAVAILABLE',
						reason: 'Credenciales de preview no configuradas.',
						remainingAction:
							'Configurar credenciales de preview y reejecutar el comando.',
					});
					targetPlans.push({
						target: 'preview',
						status: 'BLOQUEADO',
						reason: 'No se realizó una inspección remota (credenciales de preview no configuradas).',
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
						const previewReason =
							'No fue posible inspeccionar Preview de forma segura. Revise credenciales, identidad del proyecto, conectividad y estado remoto antes de volver a planificar.';
						reports.push({
							stage: 'plan',
							environment: 'preview',
							status: 'BLOCKED',
							reasonCode: 'PREVIEW_PLAN_BLOCKED',
							reason: previewReason,
							remainingAction: `Detalle técnico sanitizado: ${errMsg}`,
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

		// Check if ALL selected targets are already in sync (0 operations)
		if (isZeroDrift) {
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
			affectedTargets: targetPlans
				.filter(
					(tp) =>
						tp.expectedDatabaseWrites.deletes > 0 ||
						tp.expectedStorageMutations.deletes > 0 ||
						tp.expectedStorageMutations.overwrites > 0,
				)
				.map((tp) => tp.target),
		};

		// ── CONFIRMATION GATES (INTERACTIVE & NON-INTERACTIVE) ─────────────────────
		if (isTTY && !nonInteractive) {
			console.log(formatApplyConfirmation(planData, presenterOptions));
			const confirmed = await confirm({
				message: `¿Aplicar la actualización administrada de "${slug}" en ${targets.join(', ')}?`,
				default: false,
			});
			if (!confirmed) {
				targetResults.push(...buildCancellationResults(targets, targetPlans));
				const cancelResult = {
					invitation: slug,
					reports,
					targetResults,
					status: 'CANCELLED' as const,
					reason: 'OPERATOR_CANCELLED',
				};
				if (json) {
					console.log(JSON.stringify(cancelResult, null, 2));
				} else {
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
				}
				return;
			}
		} else if (
			nonInteractive &&
			destInfo.hasDestructive &&
			!args.includes('--confirm-destructive')
		) {
			throw new Error(
				`El plan contiene operaciones destructivas (${destInfo.databaseDeletes} eliminaciones DB, ${destInfo.storageDeletes} eliminaciones Storage, ${destInfo.storageOverwrites} sobrescrituras Storage). La ejecución no interactiva requiere --confirm-destructive.`,
			);
		}

		// Execute retained target plans in deterministic order through the shared lifecycle core.
		const executionSummary = await executeTargetPlans({
			targets,
			targetPlans,
			sanitizeError: (error) =>
				sanitizeMessage(error instanceof Error ? error.message : String(error)),
			executeTarget: async (target) => {
				if (target === 'local') {
					const executedLocal = await applyLocalInvitation({
						slug,
						rekeyFrom,
						sourceDir,
						ownerUserId,
						apply: true,
						plan: localResult?.plan,
						updateScope,
						assetPolicy,
						pruneAssets,
						conflictResolutions,
					});
					reports.push({
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

				if (target === 'preview') {
					if (!resolvedPackage) {
						const packaged = await exportInvitationPackage({
							slug,
							sourceDir: sourceDir ?? '',
							dryRun: false,
						});
						confirmationPackage = packaged.packageData;
						reports.push({
							stage: 'package',
							environment: 'local',
							status: 'UPDATED',
							packageHash: packaged.stats.packageHash,
						});
					}
					const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
					if (!dbUrl) {
						throw Object.assign(new Error('PREVIEW_DB_URL no configurada.'), {
							mutationStarted: false,
						}) as LifecycleExecutionError;
					}
					const previewPlan = executionPlans.get('preview');
					if (!previewPlan) {
						throw Object.assign(new Error('No existe un plan confirmado de Preview.'), {
							mutationStarted: false,
						}) as LifecycleExecutionError;
					}
					const result = await runPreviewApply({
						packageData: confirmationPackage,
						targetDbUrl: dbUrl,
						plan: previewPlan,
						assetPolicy,
						pruneAssets,
						updateScope,
						conflictResolutions,
					});
					reports.push({
						stage: 'promote',
						environment: 'preview',
						status: result.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
						plannedOperations: result.plannedMutations,
						completedOperations: result.executedMutations,
						databaseInserts: result.plan.physicalDatabaseOps.inserts,
						databaseUpdates: result.plan.physicalDatabaseOps.updates,
						databaseDeletes: result.plan.physicalDatabaseOps.deletes,
						storageUploads: result.plan.storageOps.uploads,
						storageOverwrites: result.plan.storageOps.overwrites,
						storageMoves: result.plan.storageOps.moves,
						storageDeletes: result.plan.storageOps.deletes,
						assetCounts: assetCounts(result.actions),
						publishedVersion: result.publishedVersion,
						packageHash: result.packageHash,
						approvalState: 'pending_hosted_validation',
					});
					return {
						executionPlanId: result.plan.planId,
						receiptPlanId: result.receipt?.planId ?? '',
						result: {
							target: 'preview',
							planId: result.plan.planId,
							status: result.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
							completedOperations: result.executedMutations,
							databaseWrites: result.plan.physicalDatabaseOps,
							storageMutations: result.plan.storageOps,
							publishedVersion: result.publishedVersion,
							functionalChanges: result.functionalChanges,
						},
					};
				}

				throw new Error(
					'PRODUCTION_PROMOTION_REQUIRED: Production apply moved to pnpm invitation:promote. invitation:update cannot mutate Production.',
				);
			},
		});
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
		}
	}
}

if (process.argv[1]?.endsWith('invitation-update-cli.ts')) {
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
