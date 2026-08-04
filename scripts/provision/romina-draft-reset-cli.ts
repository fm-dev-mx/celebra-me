import { createHash } from 'node:crypto';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { getProdDbUrl, runPsql } from '../db/db-workflow-lib.ts';
import { requireOwnerProductionApply } from '../db/owner-production-apply.ts';
import { evaluatePromotionBackupGate } from './invitation-promote.ts';
import { canonicalize } from './normalized-invitation-release.ts';
import {
	buildRominaDraftResetPlan,
	deriveRominaDraftResetFingerprint,
	isRominaDraftResetApplied,
	ROMINA_DRAFT_RESET_OPERATION_TYPE,
	ROMINA_DRAFT_RESET_SLUG,
	verifyRominaDraftResetOutcome,
} from './romina-draft-reset.ts';
import { applyRominaDraftReset, readRominaProductionState } from './romina-draft-reset-service.ts';
import {
	deriveRominaReceiptOperationId,
	deriveStableOperationId,
} from './romina-shared-helpers.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');
const acknowledged = args.includes('--acknowledge-discard-unpublished-draft');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function hash(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function printPlan(plan: ReturnType<typeof buildRominaDraftResetPlan>): void {
	if (json) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}
	console.log('Romina draft reset — read-only dry-run');
	console.log(`Target: ${plan.target}; slug: ${plan.slug}; writes: ${plan.writes}`);
	console.log(`Acknowledgement: ${plan.acknowledgement}`);
	console.log(`Published version: ${plan.publishedVersion}`);
	console.log(`Published hash: ${plan.hashes.published}`);
	console.log(`Draft before:  ${plan.hashes.draftBefore}`);
	console.log(`Draft after:   ${plan.hashes.draftAfter}`);
	console.log(`Changed paths (${plan.changedPaths.length}): ${plan.changedPaths.join(', ')}`);
	console.log(`Operation fingerprint: ${plan.operationFingerprint}`);
	console.log('Published content will not be written.');
	console.log('No database write was attempted.');
}

function readProductionState() {
	const candidate = readRominaProductionState(ROMINA_DRAFT_RESET_SLUG);
	if (!candidate?.draft.content || !candidate.published.content) {
		throw new Error(
			'ROMINA_DRAFT_RESET_PRODUCTION_UNAVAILABLE: complete Production evidence is required.',
		);
	}
	const draftContent = candidate.draft.content as Record<string, unknown>;
	const publishedContent = candidate.published.content as Record<string, unknown>;
	if (
		isRominaDraftResetApplied({
			slug: ROMINA_DRAFT_RESET_SLUG,
			draftContent,
			publishedContent,
		})
	) {
		const publishedHash = hash(publishedContent);
		const operationFingerprint = deriveRominaDraftResetFingerprint({
			slug: ROMINA_DRAFT_RESET_SLUG,
			afterContent: draftContent,
			publishedVersion: candidate.published.version,
			publishedHash,
		});
		const operationId = deriveStableOperationId({
			operationType: ROMINA_DRAFT_RESET_OPERATION_TYPE,
			targetEnv: 'production',
			scope: ROMINA_DRAFT_RESET_SLUG,
			manifestFingerprint: operationFingerprint,
		});
		return {
			candidate,
			replay: {
				operationFingerprint,
				operationId,
				receiptOperationId: deriveRominaReceiptOperationId(operationId),
				afterHash: hash(draftContent),
				publishedHash,
			},
		};
	}
	const plan = buildRominaDraftResetPlan({
		slug: ROMINA_DRAFT_RESET_SLUG,
		draftContent,
		publishedContent,
		draftStatus: candidate.draft.status,
		draftUpdatedAt: candidate.draft.updatedAt,
		publishedVersion: candidate.published.version,
	});
	return { candidate, plan };
}

function verifyRequiredProductionTables(dbUrl: string): void {
	const result = runPsql(
		`select table_name from information_schema.tables where table_schema = 'public' and table_name = 'invitation_mutation_operation_receipts';`,
		dbUrl,
		{
			tuplesOnly: true,
			env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
		},
	);
	const present = result.stdout.trim();
	if (present !== 'invitation_mutation_operation_receipts') {
		throw new Error(
			'PRODUCTION_SCHEMA_BEHIND: required table invitation_mutation_operation_receipts is missing.',
		);
	}
}

function applyPlan(): void {
	if (!acknowledged) {
		throw new Error(
			'ACKNOWLEDGEMENT_REQUIRED: pass --acknowledge-discard-unpublished-draft to confirm unpublished draft differences will be discarded.',
		);
	}
	const { url: targetDbUrl } = getProdDbUrl();
	const state = readProductionState();
	if (state.replay) {
		printReplay(state.replay);
		return;
	}
	const { candidate, plan } = state;
	const backupManifestPath = value('--backup-manifest');
	if (!backupManifestPath) {
		throw new Error(
			'BACKUP_REQUIRED: pass --backup-manifest from a fresh pnpm db:prod:backup:critical run before applying the reset.',
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
			'ROMINA_DRAFT_RESET_FINGERPRINT_MISMATCH: supplied operation fingerprint differs from the current dry-run.',
		);
	}
	requireOwnerProductionApply({
		apply: true,
		dbUrl: targetDbUrl,
		operationType: ROMINA_DRAFT_RESET_OPERATION_TYPE,
		confirmationChallenge: `RESET ${plan.slug} ${plan.operationFingerprint}`,
		summary: [
			['Mode', 'Romina draft reset'],
			['Slug', plan.slug],
			['Fingerprint', plan.operationFingerprint],
			['Operation ID', plan.operationId],
		],
	});

	const applied = applyRominaDraftReset({
		plan,
		draftContent: candidate.draft.content as Record<string, unknown>,
		publishedContent: candidate.published.content as Record<string, unknown>,
		draftStatus: candidate.draft.status,
		draftUpdatedAt: candidate.draft.updatedAt,
		targetDbUrl,
	});
	verifyRominaDraftResetOutcome(
		plan,
		applied.draftContent,
		applied.publishedContent,
	);
	const result = {
		status: applied.status,
		result: applied.result,
		operationFingerprint: plan.operationFingerprint,
		operationId: plan.operationId,
		backupManifest: backup.manifestPath,
		publishedHash: plan.hashes.published,
		draftAfter: plan.hashes.draftAfter,
		transaction: 'committed',
	};
	if (json) console.log(JSON.stringify(result, null, 2));
	else
		console.log(
			`Romina draft reset applied: ${applied.status}; operation ${plan.operationId}`,
		);
}

function printReplay(identity: {
	operationFingerprint: string;
	operationId: string;
	receiptOperationId: string;
	afterHash: string;
	publishedHash: string;
}): void {
	const replay = {
		schemaVersion: 'romina-draft-reset-v1',
		target: 'production',
		slug: ROMINA_DRAFT_RESET_SLUG,
		mode: 'idempotent-replay',
		writes: 0,
		...identity,
	};
	if (json) console.log(JSON.stringify(replay, null, 2));
	else
		console.log(
			`Romina draft reset already applied; no write required (${identity.operationId}).`,
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
