#!/usr/bin/env node
/**
 * invitation-promote-cli.ts — Public owner-only Production promotion entrypoint.
 *
 * Agents may run read-only preflight/status. Apply requires interactive owner
 * confirmation (or CONFIRM_PROD_MIGRATION matching the exact challenge).
 * There is no agent/non-interactive Production promotion mode.
 */
import { resolveInvitationPackageInput, PackageInputError } from './invitation-package-input.ts';
import { parseAssetPolicy } from './asset-reconciliation.ts';
import type { UpdateScope } from './semantic-delta.ts';
import { loadConflictResolutionsFile } from './conflict-resolutions.ts';
import {
	getProdDbUrl,
	requireProductionConfirmation,
} from '../db/db-workflow-lib.ts';
import {
	runPromotionApply,
	runPromotionPreflight,
	type PromotionApplyReport,
	type PromotionPreflightReport,
} from './invitation-promote.ts';

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
	console.log(`
pnpm invitation:promote — Owner-only Production managed-content promotion
=======================================================================

Promotes an exact Preview-approved release to Production using the managed
import/publication engine. Never runs schema migrations.

Usage:
  pnpm invitation:promote -- --slug <slug> [--package <path>|--source-dir <path>] [--dry-run]
  pnpm invitation:promote -- --slug <slug> --package <path> --apply --backup-manifest <path>

Modes:
  (default) / --dry-run   Read-only preflight (approval, schema, backup, Production divergence)
  --apply                 Owner-confirmed Production mutation + mandatory post-verification
  --help                  Show this help

Required:
  --slug <slug>           Managed invitation identity

Release identity (exactly one source preferred; package recommended for immutable release):
  --package <path>        Immutable approved package JSON
  --source-dir <path>     Rebuild from managed definition (still must match approval hashes)

Owner apply gates:
  --backup-manifest <path>  Verified critical backup manifest (or auto-discover newest under .backups/prod/)
  Interactive confirmation challenge: PROMOTE <slug> <packageHash>
  Or CONFIRM_PROD_MIGRATION with the exact same challenge string

Optional:
  --owner-user-id <uuid>  Owner assertion for new Production invitations
  --approvals-dir <path>  Extra approval artifact directory (default .agent/tmp/approvals)
  --asset-policy <name>   Asset reconciliation policy
  --prune-assets          Allow planned definition-owned asset deletes
  --update-scope <scope>  content-only | content-and-assets | assets-only
  --conflict-resolutions <file.json>
  --json                  Machine-readable output
  --allow-stale-package   Intentional historical package (still must match approval)

Agent boundaries:
  Agents may run dry-run/preflight with Production read credentials.
  Agents must NOT execute --apply. Owner-only confirmation is mandatory.
  Schema incompatibility → OWNER_ACTION_REQUIRED via pnpm db:prod:migrate (separate workflow).
`);
}

function printHumanReport(report: PromotionPreflightReport | PromotionApplyReport): void {
	console.log('\n=== invitation:promote ===');
	console.log(`Status:              ${report.status}`);
	if (report.blockCode) console.log(`Block code:          ${report.blockCode}`);
	if (report.reason) console.log(`Reason:              ${report.reason}`);
	console.log(`Invitation:          ${report.slug}`);
	console.log(`Package hash:        ${report.packageHash}`);
	console.log(`Source hash:         ${report.sourceHash}`);
	console.log(`Projection hash:     ${report.projectionHash}`);
	console.log(`Asset manifest hash: ${report.assetManifestHash}`);
	if (report.approval) {
		console.log(`Approval state:      ${report.approval.approvalState}`);
		console.log(`Approved at:         ${report.approval.approvedAt ?? '(n/a)'}`);
		console.log(`Approved by:         ${report.approval.approvedBy ?? '(n/a)'}`);
		console.log(
			`Intended Production: ${report.approval.intendedProductionProjectRef ?? '(n/a)'}`,
		);
	}
	if (report.productionProjectRef) {
		console.log(`Production project:  ${report.productionProjectRef}`);
	}
	console.log(`Schema state:        ${report.schema.state}`);
	console.log(`Schema detail:       ${report.schema.detail}`);
	console.log(`Backup status:       ${report.backup.acceptable ? 'OK' : 'BLOCKED'}`);
	console.log(`Backup command:      ${report.backup.canonicalCommand}`);
	console.log(`Backup detail:       ${report.backup.detail}`);
	console.log(
		`Safe managed changes: ${report.divergence.safeManagedChanges.length}`,
	);
	console.log(
		`Target-owned diffs:   ${report.divergence.targetOwnedDifferences.length}`,
	);
	console.log(
		`Managed divergences:  ${report.divergence.managedDivergences.length}`,
	);
	console.log(`Conflicts:           ${report.divergence.conflicts.length}`);
	for (const item of [
		...report.divergence.managedDivergences,
		...report.divergence.conflicts,
	].slice(0, 20)) {
		console.log(`  - [${item.classification}] ${item.path}: ${item.detail}`);
	}
	if (report.engineResult) {
		console.log(`Plan ID:             ${report.engineResult.plan.planId}`);
		console.log(`Planned mutations:   ${report.engineResult.plannedMutations}`);
		console.log(
			`Published version:   ${report.engineResult.publishedVersion ?? '(n/a)'}`,
		);
	}
	if ('applyResult' in report && report.applyResult) {
		console.log(`Applied plan ID:     ${report.applyResult.plan.planId}`);
		console.log(`Completed ops:       ${report.applyResult.executedMutations}`);
		console.log(`Receipt plan ID:     ${report.applyResult.receipt?.planId ?? '(n/a)'}`);
	}
	if ('verification' in report && report.verification) {
		console.log(`Verification:        ${report.verification.ok ? 'PASSED' : 'FAILED'}`);
		console.log(`Verification detail: ${report.verification.detail}`);
	}
	console.log('');
}

// eslint-disable-next-line complexity -- CLI mode dispatch and owner confirmation gates.
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	const slug = value(args, '--slug');
	if (!slug) {
		printHelp();
		console.error('ERROR: --slug is required.');
		process.exitCode = 1;
		return;
	}

	const apply = args.includes('--apply');
	const dryRun = args.includes('--dry-run') || !apply;
	const json = args.includes('--json');
	const sourceDir = value(args, '--source-dir');
	const packagePath = value(args, '--package');
	const ownerUserId = value(args, '--owner-user-id');
	const backupManifestPath = value(args, '--backup-manifest');
	const approvalsDir = value(args, '--approvals-dir');
	const updateScope = value(args, '--update-scope') as UpdateScope | undefined;
	const conflictResolutionsPath = value(args, '--conflict-resolutions');
	const assetPolicyRaw = value(args, '--asset-policy');
	const pruneAssets = args.includes('--prune-assets');
	const allowStalePackage = args.includes('--allow-stale-package');

	if (apply && dryRun && args.includes('--dry-run')) {
		console.error('Cannot combine --apply with --dry-run.');
		process.exitCode = 1;
		return;
	}

	// Refuse agent-style Production automation tokens as authorization.
	if (apply && process.env.CELEBRA_TASK_SCOPE) {
		console.error(
			'CONFIRMATION_REQUIRED: CELEBRA_TASK_SCOPE authorizes Preview automation only and is not Production promotion approval.',
		);
		process.exitCode = 1;
		return;
	}

	let packageInput;
	try {
		packageInput = await resolveInvitationPackageInput({
			slug,
			sourceDir,
			packagePath,
			allowStalePackage,
		});
	} catch (error) {
		const message =
			error instanceof PackageInputError
				? error.safeReason
				: error instanceof Error
					? error.message
					: String(error);
		if (json) {
			console.log(
				JSON.stringify({
					status: 'BLOCKED',
					blockCode: 'PRODUCTION_PLAN_BLOCKED',
					reason: message,
					slug,
				}),
			);
		} else {
			console.error(message);
		}
		process.exitCode = 1;
		return;
	}

	const assetPolicy = assetPolicyRaw ? parseAssetPolicy(assetPolicyRaw) : undefined;
	const conflictResolutions = conflictResolutionsPath
		? loadConflictResolutionsFile(conflictResolutionsPath)
		: undefined;

	const preflight = await runPromotionPreflight({
		packageData: packageInput.packageData,
		ownerUserId,
		approvalsDirs: approvalsDir
			? [approvalsDir, '.agent/tmp/approvals']
			: undefined,
		assetPolicy,
		pruneAssets,
		updateScope,
		conflictResolutions,
		backupManifestPath,
		requireBackup: apply,
		getProductionDbUrl: getProdDbUrl,
	});

	if (!apply) {
		if (json) console.log(JSON.stringify(preflight, null, 2));
		else printHumanReport(preflight);
		if (preflight.status === 'BLOCKED') process.exitCode = 1;
		return;
	}

	if (preflight.status === 'BLOCKED') {
		if (json) console.log(JSON.stringify(preflight, null, 2));
		else printHumanReport(preflight);
		process.exitCode = 1;
		return;
	}

	const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
	if (!interactive && !process.env.CONFIRM_PROD_MIGRATION?.trim()) {
		const blocked: PromotionPreflightReport = {
			...preflight,
			status: 'BLOCKED',
			blockCode: 'CONFIRMATION_REQUIRED',
			reason:
				'CONFIRMATION_REQUIRED: Production promotion apply requires an interactive owner TTY confirmation or CONFIRM_PROD_MIGRATION set to the exact challenge. There is no agent non-interactive promotion mode.',
		};
		if (json) console.log(JSON.stringify(blocked, null, 2));
		else printHumanReport(blocked);
		process.exitCode = 1;
		return;
	}

	if (!json) {
		printHumanReport(preflight);
		console.log('Review the Production promotion above carefully before confirming.');
		console.log('Promotion mutates only managed release-owned state.');
		console.log('Target-owned Production differences are preserved.');
		console.log('Schema migrations are never run by this command.');
	}

	const challenge = `PROMOTE ${slug} ${packageInput.packageData.packageHash}`;
	const prodHost = (() => {
		try {
			return new URL(preflight.targetDbUrl ?? '').hostname || 'production';
		} catch {
			return 'production';
		}
	})();
	await requireProductionConfirmation(prodHost, challenge);

	const applyReport: PromotionApplyReport = await runPromotionApply({
		preflight,
		packageData: packageInput.packageData,
		ownerUserId,
		assetPolicy,
		pruneAssets,
		updateScope,
		conflictResolutions,
	});

	if (json) console.log(JSON.stringify(applyReport, null, 2));
	else printHumanReport(applyReport);

	if (
		applyReport.status === 'BLOCKED' ||
		applyReport.status === 'APPLIED_BUT_VERIFICATION_FAILED'
	) {
		process.exitCode = 1;
	}
}

if (process.argv[1]?.endsWith('invitation-promote-cli.ts')) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
