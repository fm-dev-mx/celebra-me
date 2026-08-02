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
	buildRominaSchemaRepairReplayIdentity,
	isRominaSchemaRepairApplied,
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

function readProductionState() {
	const candidate = readLegacyAdoptionCandidate({
		environment: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
	});
	if (!candidate?.draft.content || !candidate.published.content) {
		throw new Error(
			'ROMINA_REPAIR_PRODUCTION_UNAVAILABLE: complete Production evidence is required.',
		);
	}
	const draftContent = candidate.draft.content as Record<string, unknown>;
	const publishedContent = candidate.published.content as Record<string, unknown>;
	if (
		isRominaSchemaRepairApplied({
			slug: ROMINA_SCHEMA_REPAIR_SLUG,
			draftContent,
			publishedContent,
		})
	) {
		return {
			candidate,
			replay: buildRominaSchemaRepairReplayIdentity({
				slug: ROMINA_SCHEMA_REPAIR_SLUG,
				draftContent,
				publishedContent,
				publishedVersion: candidate.published.version,
			}),
		};
	}
	const plan = buildRominaSchemaRepairPlan({
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		draftContent,
		publishedContent,
		draftStatus: candidate.draft.status,
		draftUpdatedAt: candidate.draft.updatedAt,
		publishedVersion: candidate.published.version,
	});
	return { candidate, plan };
}

interface RominaRepairReceipt {
	command_kind: string;
	status: string;
	input_hashes: {
		operationId?: string;
		operationFingerprint?: string;
	};
	result: { afterHash?: string } | null;
}

function readRominaRepairReceipt(
	dbUrl: string,
	receiptOperationId: string,
): RominaRepairReceipt | null {
	const result = runPsql(
		`select row_to_json(r) from (select command_kind, status, input_hashes, result from public.invitation_mutation_operation_receipts where operation_id = '${receiptOperationId}'::uuid limit 1) r;`,
		dbUrl,
		{
			tuplesOnly: true,
			env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
		},
	);
	const line = result.stdout
		.trim()
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find((value) => value.startsWith('{'));
	return line ? (JSON.parse(line) as RominaRepairReceipt) : null;
}

function printReplay(identity: ReturnType<typeof buildRominaSchemaRepairReplayIdentity>): void {
	const replay = {
		schemaVersion: 'romina-schema-repair-v1',
		target: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		mode: 'idempotent-replay',
		writes: 0,
		operationFingerprint: identity.operationFingerprint,
		operationId: identity.operationId,
		receiptOperationId: identity.receiptOperationId,
		afterHash: identity.afterHash,
	};
	if (json) console.log(JSON.stringify(replay, null, 2));
	else
		console.log(
			`Romina schema repair already applied; no write required (${identity.operationId}).`,
		);
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
	const { url: targetDbUrl } = getProdDbUrl();
	const state = readProductionState();
	if (state.replay) {
		const receipt = readRominaRepairReceipt(targetDbUrl, state.replay.receiptOperationId);
		if (
			!receipt ||
			receipt.command_kind !== 'romina_schema_repair' ||
			!['applied', 'replayed'].includes(receipt.status) ||
			receipt.input_hashes.operationId !== state.replay.operationId ||
			receipt.input_hashes.operationFingerprint !== state.replay.operationFingerprint ||
			receipt.result?.afterHash !== state.replay.afterHash
		) {
			throw new Error(
				'ROMINA_REPAIR_REPLAY_RECEIPT_MISSING: repaired content exists without a matching durable operation receipt.',
			);
		}
		printReplay(state.replay);
		return;
	}
	const { candidate, plan } = state;
	const backupManifestPath = value('--backup-manifest');
	if (!backupManifestPath) {
		throw new Error(
			'BACKUP_REQUIRED: pass --backup-manifest from a fresh pnpm db:prod:backup:critical run before applying the repair.',
		);
	}
	verifyRequiredProductionTables(targetDbUrl);
	const backup = evaluatePromotionBackupGate({
		manifestPath: backupManifestPath,
		productionProjectRef: SUPABASE_PROJECT_REFS.production,
		required: true,
	});
	if (!backup.acceptable) throw new Error(backup.detail);

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
		const state = readProductionState();
		if (state.replay) printReplay(state.replay);
		else printPlan(state.plan);
	}
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
