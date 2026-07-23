#!/usr/bin/env node
/** The sole public managed-invitation release command. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { confirm, select } from '@inquirer/prompts';
import { applyLocalInvitation, type LocalApplyResult } from './apply-local-invitation.ts';
import { exportInvitationPackage, type InvitationPackageData } from './invitation-package.ts';
import { runImportEngine } from './invitation-import-engine.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import {
	buildStatusReport,
	parseTargets,
	checkUnknownFlags,
	type InvitationUpdateTarget,
} from './invitation-update-options.ts';
import { readFastInvitationInventory } from './invitation-status-inventory.ts';
import { evaluateInvitationReadiness } from './invitation-readiness.ts';
import { LOCAL_DB_URL } from '../db/db-target-config.ts';
import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	getProdDbUrl,
	requireProductionConfirmation,
} from '../db/db-workflow-lib.ts';
import {
	createPendingPreviewApprovalArtifact,
	finalizePreviewApprovalArtifact,
	verifyPreviewApprovalArtifact,
} from './preview-approval-service.ts';
import {
	formatStatusReport,
	formatDryRunPlan,
	formatApplyConfirmation,
	formatApplyResult,
	type StatusReportData,
	type OperationalPlanData,
} from './invitation-update-presenter.ts';
import { runProductionLegacyAdoption } from './legacy-production-adoption-service.ts';
import { establishPreviewProvenanceBaseline } from './preview-provenance-baseline-service.ts';

type Target = InvitationUpdateTarget;
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
	environment: Target;
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

export function printHelp(): void {
	console.log(`
invitation:update — Unified managed invitation update/release CLI

Usage:
  pnpm invitation:update                                             Interactive wizard (TTY only)
  pnpm invitation:update --status [--slug <slug>] [--targets <targets>] [--json]
  pnpm invitation:update --slug <slug> --targets <targets> --dry-run|--apply [--non-interactive] [--source-dir <dir>]
  pnpm invitation:update --artifact <path> --evidence <path> --apply
  pnpm invitation:update --adoption-plan --slug romina-rios-chaparro --targets production --package <path> --approval-artifact <path> [--adoption-manifest <path>] [--json]
  pnpm invitation:update --adoption-apply --slug romina-rios-chaparro --targets production --package <path> --approval-artifact <path> --adoption-manifest <path> [--json]
  pnpm invitation:update --preview-provenance --slug romina-rios-chaparro --targets preview --package <path> --approval-artifact <path> --dry-run|--apply [--json]

Options:
  --status                     Read-only inventory status check
  --targets <targets>          Target environments: local, preview, production, all
  --slug <slug>                Invitation slug (e.g. romina-rios-chaparro)
  --source-dir <dir>           Directory containing source assets (optional if assets exist in DB/Storage)
  --dry-run                    Simulate changes without performing writes
  --apply                      Perform actual database and storage updates
  --non-interactive            Skip interactive prompts for non-TTY execution
  --json                       Format output as JSON
  --owner-user-id <uuid>       Required only when creating a new hosted invitation; optional assertion for an existing target owner
  --adoption-plan              Read-only plan for the isolated Production legacy adoption
  --adoption-apply             Apply the isolated Production legacy adoption after exact confirmation
  --approval-artifact <path>   Exact approved Preview artifact required for legacy adoption
  --adoption-manifest <path>   Exact immutable adoption manifest required for legacy adoption apply
  --preview-provenance         Establish the Preview provenance baseline without changing content
  --help, -h                   Show this help message
`);
}

// eslint-disable-next-line complexity -- CLI handles mode dispatch, interactive prompts, and hosted environment flow gates.
export async function main(argv = process.argv.slice(2)): Promise<void> {
	const args = argv;
	checkUnknownFlags(args);
	const json = args.includes('--json');
	const nonInteractive = args.includes('--non-interactive');
	const isTTY = Boolean(process.stdout.isTTY);

	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	const adoptionPlan = args.includes('--adoption-plan');
	const adoptionApply = args.includes('--adoption-apply');
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
			slug !== 'romina-rios-chaparro' ||
			targets.length !== 1 ||
			targets[0] !== 'preview' ||
			!packagePath ||
			!approvalArtifactPath
		) {
			throw new Error('La baseline de provenance requiere Preview, Romina, paquete, aprobación y --dry-run o --apply.');
		}
		const result = await establishPreviewProvenanceBaseline({ packagePath, approvalArtifactPath, apply });
		if (json) console.log(JSON.stringify(result, null, 2));
		else console.log(`Provenance de Preview: ${result.status === 'BASELINED' ? 'registrada' : result.status === 'IN_SYNC' ? 'ya verificada' : 'planificada'}.`);
		return;
	}
	if (adoptionPlan || adoptionApply) {
		if (adoptionPlan && adoptionApply) {
			throw new Error('Elija exactamente una operación de adopción: --adoption-plan o --adoption-apply.');
		}
		if (args.includes('--status') || args.includes('--dry-run') || args.includes('--apply')) {
			throw new Error('La adopción legacy no se combina con los modos normales de actualización.');
		}
		const slug = value(args, '--slug');
		const targets = parseTargets(value(args, '--targets'));
		const packagePath = value(args, '--package');
		const approvalArtifactPath = value(args, '--approval-artifact');
		const manifestPath = value(args, '--adoption-manifest');
		if (
			slug !== 'romina-rios-chaparro' ||
			targets.length !== 1 ||
			targets[0] !== 'production' ||
			!packagePath ||
			!approvalArtifactPath ||
			(adoptionApply && !manifestPath)
		) {
			throw new Error(
				'La adopción legacy requiere exactamente Production, Romina, --package, --approval-artifact y, al aplicar, --adoption-manifest.',
			);
		}
		const planned = await runProductionLegacyAdoption({
			packagePath,
			approvalArtifactPath,
			manifestPath,
			apply: false,
		});
		if (!adoptionApply || planned.status === 'IN_SYNC') {
			if (json) console.log(JSON.stringify(planned, null, 2));
			else {
				console.log(`Adopción legacy de Romina: ${planned.status === 'IN_SYNC' ? 'ya sincronizada' : 'planificada'}.`);
				console.log(`Manifiesto: ${planned.manifestPath}`);
				console.log(`Hash del plan: ${planned.planHash}`);
			}
			return;
		}
		const { url } = getProdDbUrl();
		await requireProductionConfirmation(
			new URL(url).hostname,
			`ADOPT romina-rios-chaparro ${planned.packageHash}`,
		);
		const applied = await runProductionLegacyAdoption({
			packagePath,
			approvalArtifactPath,
			manifestPath,
			apply: true,
		});
		if (json) console.log(JSON.stringify(applied, null, 2));
		else console.log(`Adopción legacy de Romina: ${applied.status === 'ADOPTED' ? 'completada' : 'ya sincronizada'}.`);
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
			if (targets.length === 0) {
				targets = parseTargets(
					await select({
						message: 'Selecciona el entorno de destino',
						choices: [
							{ name: 'Local (127.0.0.1:54322)', value: 'local' },
							{ name: 'Preview', value: 'preview' },
							{ name: 'Producción', value: 'production' },
							{ name: 'Local y Preview', value: 'all' },
						],
					}),
				);
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
		}
	}

	// Default targets to local if interactive or unassigned
	if (targets.length === 0 && (slug || statusMode)) {
		targets = ['local'];
	}

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

	const ownerUserId = value(args, '--owner-user-id');
	const reports: StageReport[] = [];
	const resolvedPackage = packagePath ? resolve(packagePath) : undefined;
	let confirmationPackage: InvitationPackageData = resolvedPackage
		? (JSON.parse(readFileSync(resolvedPackage, 'utf8')) as InvitationPackageData)
		: (await exportInvitationPackage({ slug, sourceDir: sourceDir ?? '', dryRun: true }))
				.packageData;

	let localResult: LocalApplyResult | undefined;
	if (targets.includes('local')) {
		localResult = await applyLocalInvitation({
			slug,
			sourceDir,
			ownerUserId,
			apply: false,
		});
	}

	// Prepare operational plan for presentation & confirmation
	const planData: OperationalPlanData = {
		invitation: slug,
		targets,
		isZeroDrift: localResult ? localResult.isZeroDrift : false,
		plannedOperations: localResult ? localResult.plannedOperations : 0,
		expectedDatabaseWrites: {
			inserts: localResult ? localResult.databaseInserts : 0,
			updates: localResult ? localResult.databaseUpdates : 0,
			deletes: localResult ? localResult.databaseDeletes : 0,
		},
		expectedStorageMutations: {
			uploads: localResult ? localResult.storageUploads : 0,
			overwrites: localResult ? localResult.storageOverwrites : 0,
			moves: localResult ? localResult.storageMoves : 0,
			deletes: localResult ? localResult.storageDeletes : 0,
		},
		actions: localResult ? localResult.actions : [],
		publishedVersion: localResult?.publishedVersion,
	};

	// Handle Dry-Run Mode
	if (dryRun) {
		if (targets.includes('local') && localResult) {
			reports.push({
				stage: 'apply',
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
		}

		for (const target of targets.filter((candidate) => candidate !== 'local')) {
			try {
				const targetDbUrl =
					target === 'preview'
						? getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
						: getProdDbUrl().url;
				if (!targetDbUrl)
					throw new Error(
						`${target === 'preview' ? 'PREVIEW_DB_URL' : 'Production database credentials'} is not configured.`,
					);
				const result = await runImportEngine({
					...{ packagePath: resolvedPackage },
					target,
					targetDbUrl,
					dryRun: true,
				});
				reports.push({
					stage: 'plan',
					environment: target,
					status: result.isZeroDrift ? 'IN_SYNC' : 'SKIPPED',
					plannedOperations: result.plannedMutations,
					completedOperations: 0,
					assetCounts: assetCounts(result.actions),
					publishedVersion: result.publishedVersion,
					packageHash: result.packageHash,
				});
			} catch (error) {
				reports.push({
					stage: 'plan',
					environment: target,
					status: 'BLOCKED',
					reasonCode:
						target === 'preview' ? 'PREVIEW_PLAN_BLOCKED' : 'PRODUCTION_PLAN_BLOCKED',
					reason: error instanceof Error ? error.message : String(error),
					remainingAction:
						'Resolve the reported hosted prerequisite and re-run the target-scoped dry-run.',
				});
			}
		}

		if (json) {
			const status = reports.some((report) => report.status === 'BLOCKED')
				? 'BLOCKED'
				: reports.length > 0 && reports.every((report) => report.status === 'IN_SYNC')
					? 'IN_SYNC'
					: 'SKIPPED';
			console.log(
				JSON.stringify({ invitation: slug, reports, plan: planData, status }, null, 2),
			);
		} else {
			console.log(formatDryRunPlan(planData));
		}
		return;
	}

	// Handle Apply Mode
	if (apply) {
		if (targets.includes('local') && localResult?.isZeroDrift) {
			reports.push({
				stage: 'apply',
				environment: 'local',
				status: 'IN_SYNC',
				plannedOperations: 0,
				completedOperations: 0,
				databaseInserts: 0,
				databaseUpdates: 0,
				databaseDeletes: 0,
				storageUploads: 0,
				storageOverwrites: 0,
				storageMoves: 0,
				storageDeletes: 0,
				assetCounts: assetCounts(localResult.actions),
				publishedVersion: localResult.publishedVersion,
			});
			if (json) {
				console.log(
					JSON.stringify(
						{
							invitation: slug,
							reports,
							plan: planData,
							status: 'IN_SYNC',
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
						status: 'IN_SYNC',
						environment: targets.join(', '),
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						publishedVersion: localResult.publishedVersion,
						reason: 'La invitación ya está sincronizada. No hay cambios por aplicar.',
					}),
				);
			}
			return;
		}

		if (isTTY && !nonInteractive) {
			console.log(formatApplyConfirmation(planData));
			const confirmed = await confirm({
				message: `¿Aplicar la actualización administrada de "${slug}" en ${targets.join(', ')}?`,
				default: false,
			});
			if (!confirmed) {
				const cancelResult = {
					invitation: slug,
					reports: [],
					status: 'CANCELLED' as const,
					reason: 'OPERATOR_CANCELLED',
				};
				if (json) {
					console.log(JSON.stringify(cancelResult, null, 2));
				} else {
					console.log(
						formatApplyResult({
							invitation: slug,
							status: 'CANCELLED',
							environment: targets.join(', '),
							completedOperations: 0,
							databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
							storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
							reason: 'Cancelado por el operador.',
						}),
					);
				}
				return;
			}
		}

		if (targets.includes('local')) {
			const executedLocal = await applyLocalInvitation({
				slug,
				sourceDir,
				ownerUserId,
				apply: true,
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

			if (!json) {
				console.log(
					formatApplyResult({
						invitation: slug,
						status: executedLocal.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
						environment: 'local',
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
					}),
				);
			}
		}

		if ((targets.includes('preview') || targets.includes('production')) && !resolvedPackage) {
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

		if (targets.includes('preview')) {
			const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
			if (!dbUrl) {
				reports.push({
					stage: 'promote',
					environment: 'preview',
					status: 'UNVERIFIED',
					reasonCode: 'PREVIEW_CREDENTIALS_UNAVAILABLE',
					reason: 'PREVIEW_DB_URL is not configured.',
					remainingAction: 'Configure Preview credentials, then re-run the plan.',
				});
			} else {
				const result = await runImportEngine({
					...{ packageData: confirmationPackage },
					target: 'preview',
					targetDbUrl: dbUrl,
					dryRun: false,
				});
				const approvalState = 'pending_hosted_validation';
				createPendingPreviewApprovalArtifact({
					packageHash: result.packageHash,
					sourceHash: confirmationPackage.sourceHash,
					metadataHash: confirmationPackage.metadataHash,
					assetManifestHash: confirmationPackage.assetManifestHash,
					slug,
					previewProjectRef: result.projectRef,
					route: result.route,
					projectionHash: result.projectionHash,
					expectedAssetHashes: result.verifiedAssetHashes,
				});
				reports.push({
					stage: 'promote',
					environment: 'preview',
					status: result.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
					plannedOperations: result.plannedMutations,
					completedOperations: result.executedMutations,
					assetCounts: assetCounts(result.actions),
					publishedVersion: result.publishedVersion,
					packageHash: result.packageHash,
					approvalState,
					remainingAction: !result.isZeroDrift
						? 'Complete hosted Preview QA and approve this exact package.'
						: undefined,
				});
			}
		}

		if (targets.includes('production')) {
			const previewBlocked = reports.some(
				(report) =>
					report.environment === 'preview' &&
					['UNVERIFIED', 'BLOCKED', 'FAILED'].includes(report.status),
			);
			if (previewBlocked) {
				reports.push({
					stage: 'promote',
					environment: 'production',
					status: 'NOT_RUN',
					reasonCode: 'PREVIEW_PREREQUISITE_BLOCKED',
					remainingAction: 'Resolve Preview verification before resuming Production.',
				});
				if (json)
					console.log(
						JSON.stringify(
							{
								invitation: slug,
								reports,
								remainingAction:
									'Resolve Preview verification before resuming Production.',
							},
							null,
							2,
						),
					);
				return;
			}
			const pkg = confirmationPackage;
			verifyPreviewApprovalArtifact({
				packageHash: pkg.packageHash,
				sourceHash: pkg.sourceHash,
				metadataHash: pkg.metadataHash,
				projectionHash: pkg.projectionHash,
				assetManifestHash: pkg.assetManifestHash,
				slug: pkg.invitation.slug,
				route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}`,
			});
			const { url } = getProdDbUrl();
			await requireProductionConfirmation(
				new URL(url).hostname,
				`PROMOTE ${slug} ${pkg.packageHash}`,
			);
			const result = await runImportEngine({
				...{ packageData: confirmationPackage },
				target: 'production',
				targetDbUrl: url,
				ownerUserId,
				dryRun: false,
			});
			reports.push({
				stage: 'promote',
				environment: 'production',
				status: result.isZeroDrift ? 'IN_SYNC' : 'UPDATED',
				plannedOperations: result.plannedMutations,
				completedOperations: result.executedMutations,
				assetCounts: assetCounts(result.actions),
				publishedVersion: result.publishedVersion,
				packageHash: result.packageHash,
				approvalState: 'approved',
			});
		}

		if (json) {
			console.log(JSON.stringify({ invitation: slug, reports }, null, 2));
		}
	}
}

if (process.argv[1]?.endsWith('invitation-update-cli.ts')) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
