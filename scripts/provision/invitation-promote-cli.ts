#!/usr/bin/env node
/**
 * invitation-promote-cli.ts — Public owner-only Production promotion entrypoint.
 *
 * TTY with no args: interactive discovery + guided apply.
 * Agents may run read-only preflight. Apply requires owner TTY confirmation
 * via the shared Production owner boundary / promotion orchestrator.
 */
import { parseAssetPolicy } from './asset-reconciliation.ts';
import { loadConflictResolutionsFile } from './conflict-resolutions.ts';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import {
	OperatorError,
	inquirerTheme,
	operatorSymbol,
	renderOperatorError,
	writeHuman,
} from '../db/operator-cli-ux.ts';
import { PackageInputError, resolveInvitationPackageInput } from './invitation-package-input.ts';
import {
	runPromotionPreflight,
	type PromotionApplyReport,
	type PromotionPreflightReport,
} from './invitation-promote.ts';
import {
	parseInvitationPromoteCliArgs,
	printInvitationPromoteHelp,
	type InvitationPromoteCliArgs,
} from './invitation-promote-cli-args.ts';
import {
	discoverInvitationPromotionCandidates,
	type InvitationPromotionCandidate,
} from './invitation-promotion-candidates.ts';
import {
	formatPromotionPlanCompact,
	formatPromotionResult,
} from './invitation-promotion-format.ts';
import { orchestrateInvitationPromotion } from './invitation-promotion-orchestrator.ts';

/**
 * The preflight report retains the connection string only for the in-process
 * apply flow. CLI output is an operator artifact and must never serialize it.
 */
export function toPublicPromotionReport(
	report: PromotionPreflightReport | PromotionApplyReport,
): Omit<PromotionPreflightReport | PromotionApplyReport, 'targetDbUrl'> {
	const { targetDbUrl: _targetDbUrl, ...publicReport } = report;
	return publicReport;
}

function isTty(): boolean {
	return Boolean(process.stdin.isTTY && process.stderr.isTTY);
}

function printHumanReport(
	report: PromotionPreflightReport | PromotionApplyReport,
	options: {
		verbose?: boolean;
		deliveryScope?: string;
		title?: string;
		route?: string;
		/** Skip plan compact when the orchestrator already printed it. */
		omitPlan?: boolean;
	} = {},
): void {
	if (options.verbose) {
		writeHuman('\n=== invitation:promote ===');
		writeHuman(`Status:              ${report.status}`);
		if (report.blockCode) writeHuman(`Block code:          ${report.blockCode}`);
		if (report.reason) writeHuman(`Reason:              ${report.reason}`);
		writeHuman(`Invitation:          ${report.slug}`);
		writeHuman(`Package hash:        ${report.packageHash}`);
		writeHuman(`Source hash:         ${report.sourceHash}`);
		writeHuman(`Projection hash:     ${report.projectionHash}`);
		writeHuman(`Asset manifest hash: ${report.assetManifestHash}`);
		if (report.approval) {
			writeHuman(`Approval state:      ${report.approval.approvalState}`);
			writeHuman(`Approved at:         ${report.approval.approvedAt ?? '(n/a)'}`);
			writeHuman(`Approved by:         ${report.approval.approvedBy ?? '(n/a)'}`);
		}
		writeHuman(`Schema state:        ${report.schema.state}`);
		writeHuman(`Backup detail:       ${report.backup.detail}`);
		writeHuman(`Safe managed changes: ${report.divergence.safeManagedChanges.length}`);
		writeHuman(`Target-owned diffs:   ${report.divergence.targetOwnedDifferences.length}`);
		writeHuman(`Managed divergences:  ${report.divergence.managedDivergences.length}`);
		writeHuman(`Conflicts:           ${report.divergence.conflicts.length}`);
		if (report.engineResult) {
			writeHuman(`Plan ID:             ${report.engineResult.plan.planId}`);
			writeHuman(`Planned mutations:   ${report.engineResult.plannedMutations}`);
		}
		if ('verification' in report && report.verification) {
			writeHuman(`Verification:        ${report.verification.ok ? 'PASSED' : 'FAILED'}`);
			writeHuman(`Verification detail: ${report.verification.detail}`);
		}
		writeHuman('');
		return;
	}

	if (!options.omitPlan) {
		writeHuman(
			formatPromotionPlanCompact(report, {
				title: options.title,
				route: options.route,
				deliveryScope: options.deliveryScope,
			}),
		);
	}
	if (report.status === 'BLOCKED' && report.reason) {
		writeHuman(`${operatorSymbol('fail')} ${report.reason}`);
	}
	if ('verification' in report && report.verification) {
		writeHuman(formatPromotionResult(report));
	}
}

async function promptCandidateSelection(
	candidates: InvitationPromotionCandidate[],
): Promise<InvitationPromotionCandidate | null> {
	const ready = candidates.filter((candidate) => candidate.selectable);
	const inSync = candidates.filter((candidate) => candidate.disposition === 'in-sync');
	const attention = candidates.filter((candidate) => candidate.disposition === 'attention');

	writeHuman(`${operatorSymbol('info')} Buscando releases administradas…`);
	writeHuman(
		`${operatorSymbol('info')} Listas: ${ready.length} · Sincronizadas: ${inSync.length} · Atención: ${attention.length}`,
	);
	if (inSync.length > 0) {
		writeHuman(
			`${operatorSymbol('ok')} Ya sincronizadas: ${inSync
				.map((candidate) => candidate.slug)
				.join(', ')}`,
		);
	}
	for (const candidate of attention.slice(0, 8)) {
		writeHuman(
			`${operatorSymbol('warn')} ${candidate.title} (${candidate.slug}): ${candidate.reason}`,
		);
		for (const step of candidate.remediation) {
			writeHuman(`  → ${step}`);
		}
	}
	if (attention.length > 8) {
		writeHuman(
			`${operatorSymbol('info')} … y ${attention.length - 8} caso(s) de atención adicionales.`,
		);
	}
	if (ready.length === 0) {
		writeHuman(
			`${operatorSymbol('info')} No hay releases listas para promover. Resuelva Atención y vuelva a ejecutar.`,
		);
	}

	const { select } = await import('@inquirer/prompts');
	const choice = await select({
		message:
			ready.length === 0
				? 'No hay candidatas listas — Cancelar para salir'
				: 'Seleccione una invitación para promover a Production',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			...ready.map((candidate) => ({
				name: `${candidate.title} · ${candidate.route} · ${candidate.reason}`,
				value: candidate.slug,
			})),
		],
		theme: inquirerTheme(),
	});
	if (choice === 'cancel') return null;
	return ready.find((candidate) => candidate.slug === choice) ?? null;
}

async function resolvePackageForArgs(parsed: InvitationPromoteCliArgs) {
	if (!parsed.slug) {
		throw new OperatorError({
			title: 'Falta el slug',
			cause: 'Fuera del modo interactivo debe indicar --slug <slug>.',
			code: 'SLUG_REQUIRED',
			remediation: [
				'Ejecute pnpm invitation:promote en una TTY para elegir la invitación.',
				'O pase --slug <slug> de forma explícita.',
			],
			retryCommand: 'pnpm invitation:promote',
		});
	}
	return resolveInvitationPackageInput({
		slug: parsed.slug,
		sourceDir: parsed.sourceDir,
		packagePath: parsed.packagePath,
		allowStalePackage: parsed.allowStalePackage,
	});
}

async function runGuidedPromote(parsed: InvitationPromoteCliArgs): Promise<void> {
	if (!isTty()) {
		throw new OperatorError({
			title: 'Se requiere una TTY interactiva',
			cause: 'Sin argumentos, invitation:promote solo puede ejecutarse en una terminal interactiva.',
			code: 'TTY_REQUIRED',
			remediation: [
				'Ejecute el comando en una TTY del propietario.',
				'Para automatización de solo lectura use --slug y --dry-run o --json.',
			],
			retryCommand: 'pnpm invitation:promote -- --slug <slug> --dry-run',
		});
	}

	const summary = await discoverInvitationPromotionCandidates({
		approvalsDirs: parsed.approvalsDir
			? [parsed.approvalsDir, '.agent/tmp/approvals']
			: undefined,
	});
	const selected = await promptCandidateSelection(summary.candidates);
	if (!selected) {
		writeHuman(
			`${operatorSymbol('info')} Cancelado. No se realizó ninguna escritura en Production.`,
		);
		return;
	}
	if (!selected.packageInput) {
		throw new OperatorError({
			title: 'Release no disponible',
			cause: selected.reason,
			code: 'PRODUCTION_PLAN_BLOCKED',
			remediation: ['Corrija la definición o el paquete y vuelva a intentar.'],
			retryCommand: 'pnpm invitation:promote',
		});
	}

	writeHuman(`${operatorSymbol('ok')} Seleccionada: ${selected.title} (${selected.slug})`);

	const report = await orchestrateInvitationPromotion({
		packageData: selected.packageInput.packageData,
		approvalsDirs: parsed.approvalsDir
			? [parsed.approvalsDir, '.agent/tmp/approvals']
			: undefined,
		backupManifestPath: parsed.backupManifestPath,
		deliveryScope: selected.deliveryScope,
		title: selected.title,
		route: selected.route,
		quiet: parsed.json,
	});

	if (parsed.json) {
		process.stdout.write(`${JSON.stringify(toPublicPromotionReport(report), null, 2)}\n`);
	} else {
		printHumanReport(report, {
			verbose: parsed.verbose,
			deliveryScope: selected.deliveryScope,
			title: selected.title,
			route: selected.route,
			omitPlan: true,
		});
	}
	if (report.status === 'BLOCKED' || report.status === 'APPLIED_BUT_VERIFICATION_FAILED') {
		process.exitCode = 1;
	}
}

async function runFlaggedPromote(parsed: InvitationPromoteCliArgs): Promise<void> {
	let packageInput;
	try {
		packageInput = await resolvePackageForArgs(parsed);
	} catch (error) {
		if (error instanceof OperatorError) throw error;
		const message =
			error instanceof PackageInputError
				? error.safeReason
				: error instanceof Error
					? error.message
					: String(error);
		if (parsed.json) {
			process.stdout.write(
				`${JSON.stringify(
					{
						status: 'BLOCKED',
						blockCode: 'PRODUCTION_PLAN_BLOCKED',
						reason: message,
						slug: parsed.slug,
					},
					null,
					2,
				)}\n`,
			);
		} else {
			writeHuman(`${operatorSymbol('fail')} ${message}`);
		}
		process.exitCode = 1;
		return;
	}

	const assetPolicy = parsed.assetPolicyRaw ? parseAssetPolicy(parsed.assetPolicyRaw) : undefined;
	const conflictResolutions = parsed.conflictResolutionsPath
		? loadConflictResolutionsFile(parsed.conflictResolutionsPath)
		: undefined;
	const approvalsDirs = parsed.approvalsDir
		? [parsed.approvalsDir, '.agent/tmp/approvals']
		: undefined;

	if (parsed.mode !== 'apply') {
		const preflight = await runPromotionPreflight({
			packageData: packageInput.packageData,
			ownerUserId: parsed.ownerUserId,
			approvalsDirs,
			assetPolicy,
			pruneAssets: parsed.pruneAssets,
			updateScope: parsed.updateScope,
			conflictResolutions,
			backupManifestPath: parsed.backupManifestPath,
			requireBackup: false,
			getProductionDbUrl: getProdDbUrl,
		});
		if (parsed.json) {
			process.stdout.write(
				`${JSON.stringify(toPublicPromotionReport(preflight), null, 2)}\n`,
			);
		} else {
			printHumanReport(preflight, { verbose: parsed.verbose });
			if (preflight.status === 'PROMOTABLE') {
				writeHuman(
					`${operatorSymbol('info')} Para aplicar: pnpm invitation:promote -- --slug ${parsed.slug} --apply`,
				);
			}
		}
		if (preflight.status === 'BLOCKED') process.exitCode = 1;
		return;
	}

	const report = await orchestrateInvitationPromotion({
		packageData: packageInput.packageData,
		ownerUserId: parsed.ownerUserId,
		approvalsDirs,
		assetPolicy,
		pruneAssets: parsed.pruneAssets,
		updateScope: parsed.updateScope,
		conflictResolutions,
		backupManifestPath: parsed.backupManifestPath,
		quiet: parsed.json,
	});

	if (parsed.json) {
		process.stdout.write(`${JSON.stringify(toPublicPromotionReport(report), null, 2)}\n`);
	} else {
		printHumanReport(report, { verbose: parsed.verbose, omitPlan: true });
	}
	if (report.status === 'BLOCKED' || report.status === 'APPLIED_BUT_VERIFICATION_FAILED') {
		process.exitCode = 1;
	}
}

export async function runInvitationPromoteCli(
	argv: string[] = process.argv.slice(2),
): Promise<void> {
	let parsed: InvitationPromoteCliArgs;
	try {
		parsed = parseInvitationPromoteCliArgs(argv);
	} catch (error: unknown) {
		renderOperatorError(error, {
			title: 'Argumentos inválidos',
			retryCommand: 'pnpm invitation:promote -- --help',
		});
		process.exitCode = 1;
		return;
	}

	if (parsed.help) {
		printInvitationPromoteHelp();
		return;
	}

	const guided =
		parsed.mode === 'guided' &&
		(parsed.interactiveForced === true ||
			(parsed.interactiveForced !== false && isTty() && !parsed.json));

	try {
		if (guided) {
			await runGuidedPromote(parsed);
			return;
		}
		if (parsed.mode === 'guided') {
			throw new OperatorError({
				title: 'Se requiere una TTY interactiva',
				cause: 'Sin --slug, invitation:promote solo puede ejecutarse en una TTY (o con --interactive).',
				code: 'TTY_REQUIRED',
				remediation: [
					'Ejecute en una terminal interactiva.',
					'O pase --slug <slug> con --dry-run / --apply.',
				],
				retryCommand: 'pnpm invitation:promote -- --slug <slug> --dry-run',
			});
		}
		await runFlaggedPromote(parsed);
	} catch (error: unknown) {
		renderOperatorError(error, {
			title: 'No se pudo completar la promoción',
			retryCommand: 'pnpm invitation:promote',
		});
		process.exitCode = 1;
	}
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /invitation-promote-cli\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void runInvitationPromoteCli().catch((error: unknown) => {
		renderOperatorError(error, {
			title: 'No se pudo completar la promoción',
			retryCommand: 'pnpm invitation:promote',
		});
		process.exitCode = 1;
	});
}
