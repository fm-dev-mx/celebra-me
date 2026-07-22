#!/usr/bin/env node
/** The sole public managed-invitation release command. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { confirm, select } from '@inquirer/prompts';
import { applyLocalInvitation } from './apply-local-invitation.ts';
import { exportInvitationPackage, type InvitationPackageData } from './invitation-package.ts';
import { runImportEngine } from './invitation-import-engine.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import { buildStatusReport, parseTargets, type InvitationUpdateTarget } from './invitation-update-options.ts';
import { readFastInvitationInventory } from './invitation-status-inventory.ts';
import { LOCAL_DB_URL } from '../db/db-target-config.ts';
import { getSecretFromEnvOrFiles, PREVIEW_SECRET_FILES, getProdDbUrl, requireProductionConfirmation } from '../db/db-workflow-lib.ts';
import { createPendingPreviewApprovalArtifact, finalizePreviewApprovalArtifact, verifyPreviewApprovalArtifact } from './preview-approval-service.ts';

type Target = InvitationUpdateTarget;
type StageStatus = 'UPDATED' | 'IN_SYNC' | 'SKIPPED' | 'BLOCKED' | 'FAILED' | 'NOT_RUN' | 'UNVERIFIED';
interface StageReport { stage: string; environment: Target; status: StageStatus; reason?: string; reasonCode?: string; remainingAction?: string; plannedChanges?: number; completedChanges?: number; assetCounts?: { created: number; replaced: number; reused: number }; publishedVersion?: number; packageHash?: string; approvalState?: string; }
function value(args: string[], flag: string): string | undefined { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; }
function print(result: unknown, json: boolean): void { if (json) console.log(JSON.stringify(result, null, 2)); else console.log(result); }
function assetCounts(actions: Array<{ resource: string; action: string }>): { created: number; replaced: number; reused: number } {
	const assets = actions.filter((action) => action.resource === 'invitation_assets');
	return { created: assets.filter((action) => action.action === 'create').length, replaced: assets.filter((action) => action.action === 'replace').length, reused: assets.filter((action) => action.action === 'reuse').length };
}
function importPackageInput(packagePath: string | undefined, packageData: InvitationPackageData): Pick<Parameters<typeof runImportEngine>[0], 'packagePath' | 'packageData'> {
	return packagePath ? { packagePath } : { packageData };
}

export function printHelp(): void {
	console.log(`
invitation:update — Unified managed invitation update/release CLI

Usage:
  pnpm invitation:update                                             Interactive wizard (TTY only)
  pnpm invitation:update --status [--targets <targets>] [--json]      Read-only status inventory check
  pnpm invitation:update --slug <slug> --targets <targets> --dry-run|--apply [--non-interactive] [--source-dir <dir>]
  pnpm invitation:update --artifact <path> --evidence <path> --apply

Options:
  --status                     Read-only inventory status check
  --targets <targets>          Target environments: local, preview, production, all
  --slug <slug>                Invitation slug (e.g. romina-rios-chaparro)
  --source-dir <dir>           Directory containing source assets (optional if assets exist in DB/Storage)
  --dry-run                    Simulate changes without performing writes
  --apply                      Perform actual database and storage updates
  --non-interactive            Skip interactive prompts for non-TTY execution
  --json                       Format output as JSON
  --help, -h                   Show this help message
`);
}

// eslint-disable-next-line complexity -- The CLI owns the explicit target gate and interactive wizard.
export async function main(argv = process.argv.slice(2)): Promise<void> {
	const args = argv;
	const json = args.includes('--json');
	const nonInteractive = args.includes('--non-interactive');
	const isTTY = Boolean(process.stdout.isTTY);

	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	const artifact = value(args, '--artifact');
	const evidence = value(args, '--evidence');
	if (artifact || evidence) {
		if (!artifact || !evidence || !args.includes('--apply')) throw new Error('Approval requires --artifact <path> --evidence <path> --apply.');
		print({ approval: finalizePreviewApprovalArtifact(artifact, evidence).approvalState }, json);
		return;
	}

	let statusMode = args.includes('--status');
	let apply = args.includes('--apply');
	let dryRun = args.includes('--dry-run');

	// Validate mode conflicts
	const modeCount = (statusMode ? 1 : 0) + (apply ? 1 : 0) + (dryRun ? 1 : 0);
	if (modeCount > 1) {
		throw new Error('Conflicting mode options specified. Choose exactly one of --status, --dry-run, or --apply.');
	}

	// Non-TTY no-argument failure check
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
			throw new Error('Non-TTY execution requires --non-interactive and explicit mode flags (--status, --dry-run, or --apply).');
		}

		if (isTTY && !nonInteractive) {
			console.log('=== Celebra-me Managed Invitation Update Wizard ===\n');
			if (!slug) {
				slug = await select({
					message: 'Selecciona la invitación administrada',
					choices: listInvitationDefinitions().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((definition) => ({ name: `${definition.title} · ${definition.slug}`, value: definition.slug })),
				});
			}
			if (targets.length === 0) {
				targets = parseTargets(await select({
					message: 'Selecciona el entorno de destino',
					choices: [
						{ name: 'Local (127.0.0.1:54322)', value: 'local' },
						{ name: 'Preview', value: 'preview' },
						{ name: 'Producción', value: 'production' },
						{ name: 'Local y Preview', value: 'all' },
					],
				}));
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

	if (statusMode) {
		const report = buildStatusReport(args) as Record<string, unknown>;
		const selected = targets.length > 0 ? targets : parseTargets(value(args, '--targets'));
		const activeTargets = selected.length > 0 ? selected : ['local', 'preview', 'production'];
		if (activeTargets.includes('local')) report.inventory = { local: readFastInvitationInventory(LOCAL_DB_URL, listInvitationDefinitions().map((definition) => definition.slug)) };
		print(report, json);
		return;
	}

	if (!process.stdout.isTTY && !nonInteractive) {
		throw new Error('Non-TTY execution requires --non-interactive.');
	}

	if ((apply ? 1 : 0) + (dryRun ? 1 : 0) !== 1) {
		throw new Error('Specify exactly one of --dry-run or --apply.');
	}

	if (!slug || targets.length === 0) {
		throw new Error('Non-interactive mode requires --slug, --targets, and --dry-run or --apply.');
	}

	getInvitationDefinition(slug);

	if (apply && isTTY && !nonInteractive) {
		const confirmed = await confirm({
			message: `¿Aplicar la actualización administrada de "${slug}" en ${targets.join(', ')}?`,
			default: false,
		});
		if (!confirmed) {
			print({ invitation: slug, reports: [], status: 'NOT_RUN', reason: 'OPERATOR_CANCELLED' }, json);
			return;
		}
	}

	const allowOverwrite = args.includes('--allow-divergent-overwrite');
	const overwriteToken = value(args, '--confirm-overwrite');
	if (allowOverwrite !== Boolean(overwriteToken)) throw new Error('Divergent overwrite requires both --allow-divergent-overwrite and --confirm-overwrite <target:slug:package-hash>.');

	const ownerUserId = value(args, '--owner-user-id');
	const reports: StageReport[] = [];
	let resolvedPackage = packagePath ? resolve(packagePath) : undefined;
	let confirmationPackage: InvitationPackageData = resolvedPackage
		? JSON.parse(readFileSync(resolvedPackage, 'utf8')) as InvitationPackageData
		: (await exportInvitationPackage({ slug, sourceDir: sourceDir ?? '', dryRun: true })).packageData;

	if (allowOverwrite) {
		if (targets.length !== 1) throw new Error('Divergent overwrite must name exactly one target.');
		const expectedToken = `${targets[0]}:${slug}:${confirmationPackage.packageHash}`;
		if (overwriteToken !== expectedToken) throw new Error(`Overwrite confirmation must exactly equal ${expectedToken}.`);
	}

	if (targets.includes('local')) {
		const local = await applyLocalInvitation({ slug, sourceDir, ownerUserId, apply, allowDivergentOverwrite: allowOverwrite });
		reports.push({ stage: 'apply', environment: 'local', status: local.isZeroDrift ? 'IN_SYNC' : apply ? 'UPDATED' : 'SKIPPED', plannedChanges: local.plannedMutations, completedChanges: local.executedMutations, assetCounts: assetCounts(local.actions), publishedVersion: local.publishedVersion });
	}

	if ((targets.includes('preview') || targets.includes('production')) && !resolvedPackage) {
		const packaged = await exportInvitationPackage({ slug, sourceDir: sourceDir ?? '', dryRun: !apply });
		confirmationPackage = packaged.packageData;
		resolvedPackage = packaged.packagePath ?? undefined;
		reports.push({ stage: 'package', environment: 'local', status: apply ? 'UPDATED' : 'SKIPPED', packageHash: packaged.stats.packageHash, reason: apply ? undefined : 'In-memory verified package used for hosted dry-run.' });
	}

	if (targets.includes('preview')) {
		const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		if (!dbUrl) { reports.push({ stage: 'promote', environment: 'preview', status: 'UNVERIFIED', reasonCode: 'PREVIEW_CREDENTIALS_UNAVAILABLE', reason: 'PREVIEW_DB_URL is not configured.', remainingAction: 'Configure Preview credentials, then re-run the plan.' }); }
		else { const result = await runImportEngine({ ...importPackageInput(resolvedPackage, confirmationPackage), target: 'preview', targetDbUrl: dbUrl, dryRun: !apply, allowDivergentOverwrite: allowOverwrite }); const approvalState = apply ? 'pending_hosted_validation' : undefined; if (apply && !result.isZeroDrift) createPendingPreviewApprovalArtifact({ packageHash: result.packageHash, slug, previewProjectRef: result.projectRef, route: result.route, projectionHash: result.projectionHash, expectedAssetHashes: result.verifiedAssetHashes }); reports.push({ stage: 'promote', environment: 'preview', status: result.isZeroDrift ? 'IN_SYNC' : apply ? 'UPDATED' : 'SKIPPED', plannedChanges: result.plannedMutations, completedChanges: result.executedMutations, assetCounts: assetCounts(result.actions), publishedVersion: result.publishedVersion, packageHash: result.packageHash, approvalState, remainingAction: apply && !result.isZeroDrift ? 'Complete hosted Preview QA and approve this exact package.' : undefined }); }
	}

	if (targets.includes('production')) {
		const previewBlocked = reports.some((report) => report.environment === 'preview' && ['UNVERIFIED', 'BLOCKED', 'FAILED'].includes(report.status));
		if (previewBlocked) { reports.push({ stage: 'promote', environment: 'production', status: 'NOT_RUN', reasonCode: 'PREVIEW_PREREQUISITE_BLOCKED', remainingAction: 'Resolve Preview verification before resuming Production.' }); print({ invitation: slug, reports, remainingAction: 'Resolve Preview verification before resuming Production.' }, json); return; }
		if (!ownerUserId) { reports.push({ stage: 'promote', environment: 'production', status: 'BLOCKED', reasonCode: 'OWNER_REQUIRED', reason: 'Production requires --owner-user-id.', remainingAction: 'Supply an eligible Production owner UUID.' }); }
		else {
			const pkg = confirmationPackage;
			verifyPreviewApprovalArtifact(pkg.packageHash, { slug: pkg.invitation.slug, route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}` });
			const { url } = getProdDbUrl();
			if (apply) await requireProductionConfirmation(new URL(url).hostname, `PROMOTE ${slug} ${pkg.packageHash}`);
			const result = await runImportEngine({ ...importPackageInput(resolvedPackage, confirmationPackage), target: 'production', targetDbUrl: url, ownerUserId, dryRun: !apply, allowDivergentOverwrite: allowOverwrite });
			reports.push({ stage: 'promote', environment: 'production', status: result.isZeroDrift ? 'IN_SYNC' : apply ? 'UPDATED' : 'SKIPPED', plannedChanges: result.plannedMutations, completedChanges: result.executedMutations, assetCounts: assetCounts(result.actions), publishedVersion: result.publishedVersion, packageHash: result.packageHash, approvalState: 'approved' });
		}
	}

	print({ invitation: slug, reports, remainingAction: targets.includes('preview') && !targets.includes('production') ? 'Complete hosted Preview QA and resume this exact package.' : undefined }, json);
}

if (process.argv[1]?.endsWith('invitation-update-cli.ts')) {
	main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
