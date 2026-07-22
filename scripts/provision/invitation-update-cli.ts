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
// eslint-disable-next-line complexity -- The CLI owns the explicit target gate and never delegates safety decisions to services.
async function main(): Promise<void> {
	const args = process.argv.slice(2); const json = args.includes('--json'); const statusMode = args.includes('--status'); const apply = args.includes('--apply'); const dryRun = args.includes('--dry-run');
	const artifact = value(args, '--artifact'); const evidence = value(args, '--evidence');
	if (artifact || evidence) { if (!artifact || !evidence || !apply) throw new Error('Approval requires --artifact <path> --evidence <path> --apply.'); print({ approval: finalizePreviewApprovalArtifact(artifact, evidence).approvalState }, json); return; }
	if (statusMode) {
		const report = buildStatusReport(args) as Record<string, unknown>;
		const selected = parseTargets(value(args, '--targets'));
		const targets = selected.length > 0 ? selected : ['local', 'preview', 'production'];
		if (targets.includes('local')) report.inventory = { local: readFastInvitationInventory(LOCAL_DB_URL, listInvitationDefinitions().map((definition) => definition.slug)) };
		print(report, json);
		return;
	}
	if (!process.stdout.isTTY && !args.includes('--non-interactive')) throw new Error('Non-TTY execution requires --non-interactive.');
	if ((apply ? 1 : 0) + (dryRun ? 1 : 0) !== 1) throw new Error('Specify exactly one of --dry-run or --apply.');
	let slug = value(args, '--slug'); const sourceDir = value(args, '--source-dir'); const packagePath = value(args, '--package'); const resume = args.includes('--resume'); let targets = parseTargets(value(args, '--targets'));
	if (!slug && process.stdout.isTTY && !args.includes('--non-interactive')) slug = await select({ message: 'Selecciona la invitación administrada', choices: listInvitationDefinitions().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((definition) => ({ name: `${definition.title} · ${definition.slug}`, value: definition.slug })) });
	if (targets.length === 0 && process.stdout.isTTY && !args.includes('--non-interactive')) targets = parseTargets(await select({ message: 'Selecciona el entorno', choices: [{ name: 'Local', value: 'local' }, { name: 'Preview', value: 'preview' }, { name: 'Producción', value: 'production' }, { name: 'Local y Preview', value: 'all' }] }));
	if (!slug || targets.length === 0 || (!resume && !sourceDir) || (resume && !packagePath)) throw new Error('Non-interactive mode requires --slug, --targets, --source-dir (or --resume --package), and --dry-run or --apply.');
	if (apply && process.stdout.isTTY && !args.includes('--non-interactive') && !await confirm({ message: `¿Aplicar la actualización administrada de ${slug} en ${targets.join(', ')}?`, default: false })) {
		print({ invitation: slug, reports: [], status: 'NOT_RUN', reason: 'OPERATOR_CANCELLED' }, json);
		return;
	}
	const allowOverwrite = args.includes('--allow-divergent-overwrite'); const overwriteToken = value(args, '--confirm-overwrite');
	if (allowOverwrite !== Boolean(overwriteToken)) throw new Error('Divergent overwrite requires both --allow-divergent-overwrite and --confirm-overwrite <target:slug:package-hash>.');
	getInvitationDefinition(slug);
	const ownerUserId = value(args, '--owner-user-id'); const reports: StageReport[] = []; let resolvedPackage = packagePath ? resolve(packagePath) : undefined;
	let confirmationPackage: InvitationPackageData = resolvedPackage
		? JSON.parse(readFileSync(resolvedPackage, 'utf8')) as InvitationPackageData
		: (await exportInvitationPackage({ slug, sourceDir: sourceDir!, dryRun: true })).packageData;
	if (allowOverwrite) {
		if (targets.length !== 1) throw new Error('Divergent overwrite must name exactly one target.');
		const expectedToken = `${targets[0]}:${slug}:${confirmationPackage.packageHash}`;
		if (overwriteToken !== expectedToken) throw new Error(`Overwrite confirmation must exactly equal ${expectedToken}.`);
	}
	if (targets.includes('local')) {
		const local = await applyLocalInvitation({ slug, sourceDir: sourceDir!, ownerUserId, apply, allowDivergentOverwrite: allowOverwrite });
		reports.push({ stage: 'apply', environment: 'local', status: local.isZeroDrift ? 'IN_SYNC' : apply ? 'UPDATED' : 'SKIPPED', plannedChanges: local.plannedMutations, completedChanges: local.executedMutations, assetCounts: assetCounts(local.actions), publishedVersion: local.publishedVersion });
	}
	if ((targets.includes('preview') || targets.includes('production')) && !resolvedPackage) {
		const packaged = await exportInvitationPackage({ slug, sourceDir: sourceDir!, dryRun: !apply });
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
