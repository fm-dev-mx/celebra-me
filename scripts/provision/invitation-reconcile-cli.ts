#!/usr/bin/env node
/** Public, managed reconciliation entrypoint. Production is intentionally unsupported. */
import { readFileSync } from 'node:fs';
import { planAndApplyLocalContent } from './invitation-content-apply.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import { runImportEngine } from './invitation-import-engine.ts';
import { runPreviewApply } from './preview-apply.ts';
import { getSecretFromEnvOrFiles, PREVIEW_SECRET_FILES } from '../db/db-workflow-lib.ts';
import { parseMutationTargets } from './invitation-update-options.ts';
import { verifyPreviewWriteAuthorization } from './preview-write-auth.ts';
import { runGuidedReconciliation } from './reconciliation-cli.ts';
import {
	buildReconciliationManagedApplyPlan,
} from './reconciliation-persist.ts';
import type { ReconciliationDecisionOutcome } from './reconciliation-state.ts';
import type { SemanticDelta } from './semantic-delta.ts';

interface DecisionsFile {
	decisions: Record<string, ReconciliationDecisionOutcome>;
	deltas: Array<Partial<SemanticDelta> & { path: string }>;
	canonicalPackageHash?: string;
}

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function readDecisionsFile(path: string): DecisionsFile {
	const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
	if (!parsed || typeof parsed !== 'object') throw new Error('DECISIONS_INVALID: Expected a JSON object.');
	const record = parsed as Record<string, unknown>;
	if (!record.decisions || typeof record.decisions !== 'object' || !Array.isArray(record.deltas)) {
		throw new Error(
			'DECISIONS_INVALID: Expected { "decisions": { "<path>": "KEEP_CANONICAL"|"KEEP_ENVIRONMENT"|"DEFER" }, "deltas": [...] }.',
		);
	}
	return record as unknown as DecisionsFile;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes('--help') || argv.includes('-h')) {
		console.log(`
invitation:reconcile — Managed invitation reconciliation

Usage:
  pnpm invitation:reconcile -- --slug <slug> --targets local|preview --decisions <file.json> --dry-run
  pnpm invitation:reconcile -- --slug <slug> --targets local|preview --decisions <file.json> --package <path> --apply --non-interactive

The decisions file contains managed semantic deltas and decisions. Production and --targets all are rejected.
Preview apply requires CELEBRA_TASK_SCOPE=preview:<slug>:apply.
`);
		return;
	}

	const slug = value(argv, '--slug');
	const targets = parseMutationTargets(value(argv, '--targets'));
	const decisionsPath = value(argv, '--decisions');
	const packagePath = value(argv, '--package');
	const apply = argv.includes('--apply');
	const dryRun = argv.includes('--dry-run');
	const nonInteractive = argv.includes('--non-interactive');
	const isInteractive = !nonInteractive && Boolean(process.stdout.isTTY);
	if (!slug || targets.length === 0 || !decisionsPath || (apply === dryRun)) {
		throw new Error(
			'Usage requires --slug, --targets local|preview, --decisions <file.json>, and exactly one of --dry-run or --apply.',
		);
	}

	const decisionInput = readDecisionsFile(decisionsPath);
	const reconciliation = await runGuidedReconciliation({
		slug,
		targetEnvironment: targets[0] === 'preview' ? 'preview' : 'local',
		deltas: decisionInput.deltas,
		canonicalPackageHash: decisionInput.canonicalPackageHash ?? 'unverified-package',
		providedDecisions: decisionInput.decisions,
		isInteractive,
	});
	const managedPlan = buildReconciliationManagedApplyPlan(reconciliation.summary.decisions);

	if (!apply) {
		console.log(JSON.stringify({ ...reconciliation, managedPlan }, null, 2));
		return;
	}
	if (!packagePath) {
		throw new Error(
			'RECONCILIATION_PACKAGE_REQUIRED: KEEP_CANONICAL persistence requires --package <path> from the managed source.',
		);
	}
	if (reconciliation.summary.unresolvedPaths.length > 0 || reconciliation.summary.sourceUpdatePlan) {
		throw new Error(
			'RECONCILIATION_DECISIONS_INCOMPLETE: Resolve DEFER and source-update decisions before managed persistence.',
		);
	}

	const packageInput = await resolveInvitationPackageInput({ slug, packagePath });
	for (const target of targets) {
		if (target === 'local') {
			await planAndApplyLocalContent({
				slug,
				apply: true,
				conflictResolutions: managedPlan.conflictResolutions,
			});
			continue;
		}

		verifyPreviewWriteAuthorization({
			slug,
			targets,
			apply: true,
			isInteractive,
			operation: 'apply',
		});
		const targetDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		const planned = await runImportEngine({
			packageData: packageInput.packageData,
			target: 'preview',
			targetDbUrl,
			dryRun: true,
			conflictResolutions: managedPlan.conflictResolutions,
		});
		if (!planned.plan) throw new Error('RECONCILIATION_PLAN_MISSING: Preview managed plan was not created.');
		await runPreviewApply({
			packageData: packageInput.packageData,
			targetDbUrl,
			plan: planned.plan,
			conflictResolutions: managedPlan.conflictResolutions,
		});
	}
	console.log(JSON.stringify({ ...reconciliation, managedPlan, appliedTargets: targets }, null, 2));
}

if (process.argv[1]?.endsWith('invitation-reconcile-cli.ts')) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
