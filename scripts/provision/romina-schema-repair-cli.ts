import {
	consumeProductionApproval,
	getProdDbUrl,
	requireProductionConfirmationSync,
	runPsql,
} from '../db/db-workflow-lib.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { evaluatePromotionBackupGate } from './invitation-promote.ts';
import {
	buildRominaSchemaRepairPlan,
	ROMINA_SCHEMA_REPAIR_OPERATION_TYPE,
	ROMINA_SCHEMA_REPAIR_SLUG,
	verifyRominaSchemaRepairOutcome,
} from './romina-schema-repair.ts';
import { applyRominaSchemaRepair } from './romina-schema-repair-service.ts';
import { readLegacyAdoptionCandidate } from './legacy-baseline-adoption.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function printPlan(plan: ReturnType<typeof buildRominaSchemaRepairPlan>): void {
	if (json) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}
	console.log('Romina schema repair — read-only dry-run');
	console.log(`Target: ${plan.target}; slug: ${plan.slug}; writes: ${plan.writes}`);
	console.log(`Changed paths: ${plan.changedPaths.join(', ')}`);
	console.log(`Before hash: ${plan.hashes.before}`);
	console.log(`After hash:  ${plan.hashes.after}`);
	console.log(`Operation fingerprint: ${plan.operationFingerprint}`);
	console.log(`Operation ID: ${plan.operationId}`);
	console.log('No database write was attempted.');
}

function readProductionPlan() {
	const candidate = readLegacyAdoptionCandidate({
		environment: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
	});
	if (!candidate?.draft.content || !candidate.published.content) {
		throw new Error(
			'ROMINA_REPAIR_PRODUCTION_UNAVAILABLE: complete Production evidence is required.',
		);
	}
	const plan = buildRominaSchemaRepairPlan({
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		draftContent: candidate.draft.content as Record<string, unknown>,
		publishedContent: candidate.published.content as Record<string, unknown>,
		draftStatus: candidate.draft.status,
		draftUpdatedAt: candidate.draft.updatedAt,
		publishedVersion: candidate.published.version,
	});
	return { candidate, plan };
}

function verifyRequiredProductionTables(dbUrl: string): void {
	const result = runPsql(
		`select table_name from information_schema.tables where table_schema = 'public' and table_name = any(array['production_authorization_receipts', 'invitation_mutation_operation_receipts']);`,
		dbUrl,
		{
			tuplesOnly: true,
			env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
		},
	);
	const present = new Set(result.stdout.trim().split(/\r?\n/).filter(Boolean));
	const missing = [
		'production_authorization_receipts',
		'invitation_mutation_operation_receipts',
	].filter((table) => !present.has(table));
	if (missing.length > 0) {
		throw new Error(
			`PRODUCTION_SCHEMA_BEHIND: required receipt table(s) missing: ${missing.join(', ')}. Run the guarded schema migration workflow, then regenerate this dry-run.`,
		);
	}
}

function applyPlan(): void {
	const backupManifestPath = value('--backup-manifest');
	if (!backupManifestPath) {
		throw new Error(
			'BACKUP_REQUIRED: pass --backup-manifest from a fresh pnpm db:prod:backup:critical run before applying the repair.',
		);
	}
	const { url: targetDbUrl } = getProdDbUrl();
	verifyRequiredProductionTables(targetDbUrl);
	const backup = evaluatePromotionBackupGate({
		manifestPath: backupManifestPath,
		productionProjectRef: SUPABASE_PROJECT_REFS.production,
		required: true,
	});
	if (!backup.acceptable) throw new Error(backup.detail);

	const { candidate, plan } = readProductionPlan();
	const requestedFingerprint = value('--operation-fingerprint');
	if (requestedFingerprint && requestedFingerprint !== plan.operationFingerprint) {
		throw new Error(
			'ROMINA_REPAIR_FINGERPRINT_MISMATCH: supplied operation fingerprint differs from the current dry-run.',
		);
	}
	const approvalToken = process.env.CELEBRA_PROD_APPROVAL_TOKEN?.trim();
	const publicKey = process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY?.trim();
	if (!approvalToken || !publicKey) {
		throw new Error(
			'PRODUCTION_AUTHORIZATION_REQUIRED: set the externally issued Ed25519 approval token and public key for this exact operation.',
		);
	}
	const productionHost = new URL(targetDbUrl).hostname;
	requireProductionConfirmationSync(
		productionHost,
		`REPAIR ${plan.slug} ${plan.operationFingerprint}`,
		{
			operationType: ROMINA_SCHEMA_REPAIR_OPERATION_TYPE,
			scope: plan.slug,
			manifestFingerprint: plan.operationFingerprint,
			operationId: plan.operationId,
			consumeApproval: (payload) =>
				consumeProductionApproval({ dbUrl: targetDbUrl, payload }),
		},
	);

	const applied = applyRominaSchemaRepair({
		plan,
		draftContent: candidate.draft.content as Record<string, unknown>,
		draftStatus: candidate.draft.status,
		draftUpdatedAt: candidate.draft.updatedAt,
		targetDbUrl,
	});
	verifyRominaSchemaRepairOutcome(plan, applied.draftContent);
	const result = {
		status: applied.status,
		result: applied.result,
		operationFingerprint: plan.operationFingerprint,
		operationId: plan.operationId,
		backupManifest: backup.manifestPath,
		transaction: 'committed',
	};
	if (json) console.log(JSON.stringify(result, null, 2));
	else
		console.log(
			`Romina schema repair applied: ${applied.status}; operation ${plan.operationId}`,
		);
}

try {
	if (apply) {
		applyPlan();
	} else {
		const { plan } = readProductionPlan();
		printPlan(plan);
	}
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
