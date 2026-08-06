/**
 * invitation-id-purge.ts — ID-scoped Preview invitation purge with dry-run audit.
 *
 * Deletes an incorrect invitation and its exclusive dependencies by immutable UUID only.
 * Never matches by display name or partial text. Production is rejected.
 */

import { join } from 'node:path';
import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	PROJECT_ROOT,
	redactDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { verifyPreviewWriteAuthorization } from './preview-write-auth.ts';
import {
	assertStorageOwnership,
	assessAssetHashEquivalence,
	assessMigration,
	buildDeletePlan,
	collectPurgeBlockReasons,
	executeDeleteTransaction,
	insertPurgeReceipt,
	loadAssetHashes,
	loadAuditPayload,
	loadPostconditions,
	removePreviewStorageObjects,
	writeAuditArtifact,
} from './invitation-id-purge-ops.ts';

export const INVITATION_ID_PURGE_OPERATION = 'id-purge';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface InvitationIdPurgeInput {
	incorrectInvitationId: string;
	canonicalInvitationId: string;
	/** Required exact slug assertion for the obsolete invitation. */
	expectIncorrectSlug: string;
	/** Required exact slug assertion for the canonical invitation. */
	expectCanonicalSlug: string;
	/**
	 * Required for this cleanup class: source must already be archived with inconsistent
	 * dependents. Active (non-archived) incorrect invitations are rejected.
	 */
	allowArchivedInconsistentSource?: boolean;
	/** Require canonical active assets to cover incorrect asset sha256 set (empty incorrect set passes). */
	requireCanonicalAssetHashEquivalence?: boolean;
	/** Resume Storage-only cleanup after DB already deleted (idempotent partial recovery). */
	resumeStorageCleanup?: boolean;
	apply?: boolean;
	isInteractive?: boolean;
	authToken?: string;
	env?: NodeJS.ProcessEnv;
	auditDir?: string;
}

export interface InvitationRecordSummary {
	id: string;
	slug: string;
	title: string;
	status: string;
	kind: string;
	eventType: string;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	clientName: string | null;
	environment: 'preview';
}

export interface DependencyCounts {
	events: number;
	drafts: number;
	published: number;
	assets: number;
	assetsActive: number;
	provenance: number;
	publicationIdempotency: number;
	mutationReceipts: number;
	legacyAdoption: number;
	intakeRequests: number;
	intakeSubmissions: number;
	sourcedInvitations: number;
	guests: number;
	claimCodes: number;
	memberships: number;
	guestAudit: number;
}

export interface GuestMigrationCandidate {
	id: string;
	fullName: string;
	hasEmail: boolean;
	hasPhone: boolean;
	attendanceStatus: string | null;
	classification: 'synthetic_test' | 'requires_migration_review';
}

export interface MigrationAssessment {
	required: boolean;
	blockReason: string | null;
	guestCandidates: GuestMigrationCandidate[];
	notes: string[];
}

export interface InvitationIdPurgeAudit {
	mode: 'dry_run' | 'apply';
	executedAt: string;
	environment: 'preview';
	dbUrlRedacted: string;
	incorrect: InvitationRecordSummary;
	canonical: InvitationRecordSummary;
	incorrectDependencies: DependencyCounts;
	canonicalDependencies: DependencyCounts;
	migration: MigrationAssessment;
	deletePlan: {
		tables: Array<{ table: string; action: 'delete'; count: number; reason: string }>;
		storageAssetPaths: string[];
	};
	blocked: boolean;
	blockReasons: string[];
	deletionResult:
		| 'not_executed'
		| 'deleted'
		| 'rolled_back'
		| 'blocked'
		| 'deleted_with_residual'
		| 'already_absent';
	completedSteps: string[];
	failures: string[];
	assetHashEquivalence?: {
		ok: boolean;
		incorrectHashes: string[];
		canonicalHashes: string[];
		missingOnCanonical: string[];
	};
	storageCleanup?: {
		attempted: string[];
		removed: string[];
		alreadyAbsent: string[];
		failed: Array<{ path: string; error: string }>;
	};
	postconditions?: {
		incorrectExists: boolean;
		canonicalExists: boolean;
		canonicalSlug: string | null;
		orphanChecks: Record<string, number>;
		obsoleteSlugPresent: boolean;
	};
	auditArtifactPath: string | null;
	operationReceiptId?: string | null;
}

function assertUuid(value: string, label: string): string {
	const trimmed = value.trim();
	if (!UUID_RE.test(trimmed)) {
		throw new Error(`INVALID_INVITATION_ID: ${label} must be a UUID, got "${value}".`);
	}
	return trimmed.toLowerCase();
}

export function resolvePreviewPurgeDbUrl(env: NodeJS.ProcessEnv = process.env): string {
	const dbUrl = (
		env.PREVIEW_DB_URL?.trim() ||
		getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
	).trim();
	if (!dbUrl) {
		throw new Error(
			'PREVIEW_DB_URL_REQUIRED: Set PREVIEW_DB_URL or provide gitignored .env.preview.local.',
		);
	}
	const classification = classifyDbTarget(dbUrl);
	if (classification.target === 'production') {
		throw new Error('INVITATION_ID_PURGE_PRODUCTION_REJECTED: Production targets are never allowed.');
	}
	if (classification.target !== 'preview') {
		throw new Error(
			`INVITATION_ID_PURGE_TARGET_REJECTED: Expected preview, got ${classification.target}.`,
		);
	}
	return dbUrl;
}

function emptyDependencyCounts(): DependencyCounts {
	return {
		events: 0,
		drafts: 0,
		published: 0,
		assets: 0,
		assetsActive: 0,
		provenance: 0,
		publicationIdempotency: 0,
		mutationReceipts: 0,
		legacyAdoption: 0,
		intakeRequests: 0,
		intakeSubmissions: 0,
		sourcedInvitations: 0,
		guests: 0,
		claimCodes: 0,
		memberships: 0,
		guestAudit: 0,
	};
}

function assertRequiredSlugPins(input: InvitationIdPurgeInput): {
	expectIncorrectSlug: string;
	expectCanonicalSlug: string;
} {
	const expectIncorrectSlug = input.expectIncorrectSlug.trim();
	const expectCanonicalSlug = input.expectCanonicalSlug.trim();
	if (!expectIncorrectSlug || !expectCanonicalSlug) {
		throw new Error(
			'SLUG_ASSERTIONS_REQUIRED: Both expectIncorrectSlug and expectCanonicalSlug are required.',
		);
	}
	return { expectIncorrectSlug, expectCanonicalSlug };
}

async function handleAbsentIncorrectPurge(
	input: InvitationIdPurgeInput,
	dbUrl: string,
	canonicalId: string,
	incorrectId: string,
	expectIncorrectSlug: string,
	expectCanonicalSlug: string,
	auditDir: string,
	completedSteps: string[],
): Promise<InvitationIdPurgeAudit> {
	const apply = input.apply === true;
	const env = input.env ?? process.env;
	const failures: string[] = [];

	const canonicalOnly = runPsql(
		`select row_to_json(t) from (
      select id::text, slug, title, status, kind, event_type as "eventType",
             archived_at as "archivedAt", created_at as "createdAt", updated_at as "updatedAt",
             client_name as "clientName"
      from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid
    ) t;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: true },
	).stdout.trim();
	if (!canonicalOnly) {
		throw new Error('CANONICAL_NOT_FOUND: Canonical invitation is required for idempotent purge replay.');
	}
	const canonical = {
		...(JSON.parse(canonicalOnly) as Omit<InvitationRecordSummary, 'environment'>),
		environment: 'preview' as const,
	};
	if (canonical.slug !== expectCanonicalSlug) {
		throw new Error(
			`CANONICAL_SLUG_MISMATCH: expected ${expectCanonicalSlug}, got ${canonical.slug}.`,
		);
	}
	const residualStoragePrefix = `managed/${expectIncorrectSlug}/`;
	const audit: InvitationIdPurgeAudit = {
		mode: apply ? 'apply' : 'dry_run',
		executedAt: new Date().toISOString(),
		environment: 'preview',
		dbUrlRedacted: redactDbUrl(dbUrl),
		incorrect: {
			id: incorrectId,
			slug: expectIncorrectSlug,
			title: '',
			status: 'absent',
			kind: 'client',
			eventType: '',
			archivedAt: null,
			createdAt: '',
			updatedAt: '',
			clientName: null,
			environment: 'preview',
		},
		canonical,
		incorrectDependencies: emptyDependencyCounts(),
		canonicalDependencies: emptyDependencyCounts(),
		migration: { required: false, blockReason: null, guestCandidates: [], notes: [] },
		deletePlan: { tables: [], storageAssetPaths: [] },
		blocked: false,
		blockReasons: [],
		deletionResult: 'already_absent',
		completedSteps: [...completedSteps, 'idempotent_absent'],
		failures: [],
		auditArtifactPath: null,
	};

	if (apply) {
		verifyPreviewWriteAuthorization({
			slug: expectIncorrectSlug,
			targets: ['preview'],
			apply: true,
			isInteractive: input.isInteractive,
			authToken: input.authToken,
			operation: INVITATION_ID_PURGE_OPERATION,
		});
		audit.completedSteps.push('preview_auth_checked');

		const resumePaths = input.resumeStorageCleanup
			? (env.CELEBRA_PURGE_RESUME_STORAGE_PATHS ?? '')
					.split(',')
					.map((path) => path.trim())
					.filter(Boolean)
			: [];
		if (resumePaths.length > 0) {
			const foreign = assertStorageOwnership(resumePaths, expectIncorrectSlug);
			if (foreign.length > 0) {
				audit.blocked = true;
				failures.push(`STORAGE_OWNERSHIP_VIOLATION: ${foreign.join(', ')}`);
				audit.deletionResult = 'deleted_with_residual';
			} else {
				audit.storageCleanup = await removePreviewStorageObjects(resumePaths, env);
				audit.completedSteps.push('storage_resume_attempted');
				if (audit.storageCleanup.failed.length > 0) {
					audit.blocked = true;
					audit.deletionResult = 'deleted_with_residual';
					failures.push('STORAGE_RESUME_PARTIAL');
				}
			}
		} else {
			audit.completedSteps.push(`db_absent_storage_manual_if_needed:${residualStoragePrefix}`);
		}
		try {
			audit.operationReceiptId = insertPurgeReceipt(dbUrl, canonicalId, incorrectId, {
				...audit,
				failures,
				completedSteps: audit.completedSteps,
			});
			audit.completedSteps.push('receipt_recorded');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`RECEIPT_INSERT_FAILED: ${message}`);
			audit.blocked = true;
		}
	}
	audit.failures = failures;
	audit.auditArtifactPath = writeAuditArtifact(audit, auditDir);
	return audit;
}

async function executePurgeApplySteps(
	audit: InvitationIdPurgeAudit,
	dbUrl: string,
	incorrectId: string,
	canonicalId: string,
	incorrectSlug: string,
	canonicalSlug: string,
	storageAssetPaths: string[],
	env: NodeJS.ProcessEnv,
): Promise<void> {
	if (audit.blocked) {
		audit.deletionResult = 'blocked';
		audit.failures.push(...audit.blockReasons);
		return;
	}

	const tx = executeDeleteTransaction(dbUrl, incorrectId, canonicalId, incorrectSlug, canonicalSlug);
	if (!tx.ok) {
		audit.deletionResult = 'rolled_back';
		audit.blocked = true;
		audit.blockReasons.push(`TRANSACTION_ROLLED_BACK: ${tx.error}`);
		audit.failures.push(tx.error);
		audit.completedSteps.push('db_rolled_back');
		return;
	}

	audit.deletionResult = 'deleted';
	audit.completedSteps.push('db_deleted');
	audit.storageCleanup = await removePreviewStorageObjects(storageAssetPaths, env);
	audit.completedSteps.push('storage_cleanup_attempted');

	if (audit.storageCleanup.failed.length > 0) {
		audit.deletionResult = 'deleted_with_residual';
		audit.blocked = true;
		const storageFailure = `STORAGE_CLEANUP_PARTIAL: ${audit.storageCleanup.failed.length} object(s) failed`;
		audit.blockReasons.push(storageFailure);
		audit.failures.push(storageFailure);
	}

	audit.postconditions = loadPostconditions(dbUrl, incorrectId, canonicalId, incorrectSlug);
	audit.completedSteps.push('postconditions_verified');

	if (
		audit.postconditions.incorrectExists ||
		!audit.postconditions.canonicalExists ||
		audit.postconditions.obsoleteSlugPresent ||
		Object.values(audit.postconditions.orphanChecks).some((count) => count > 0)
	) {
		audit.blocked = true;
		audit.blockReasons.push('POSTCONDITION_FAILED: Unexpected residual state after delete.');
		audit.deletionResult = 'deleted_with_residual';
		audit.failures.push('POSTCONDITION_FAILED');
	}

	try {
		audit.operationReceiptId = insertPurgeReceipt(dbUrl, canonicalId, incorrectId, audit);
		audit.completedSteps.push('receipt_recorded');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		audit.failures.push(`RECEIPT_INSERT_FAILED: ${message}`);
		audit.blockReasons.push(`RECEIPT_INSERT_FAILED: ${message}`);
		audit.blocked = true;
		audit.deletionResult = 'deleted_with_residual';
	}
}

export async function runInvitationIdPurge(
	input: InvitationIdPurgeInput,
): Promise<InvitationIdPurgeAudit> {
	const incorrectInvitationId = assertUuid(input.incorrectInvitationId, 'incorrectInvitationId');
	const canonicalInvitationId = assertUuid(input.canonicalInvitationId, 'canonicalInvitationId');
	if (incorrectInvitationId === canonicalInvitationId) {
		throw new Error('INVITATION_IDS_COLLIDE: incorrect and canonical IDs must differ.');
	}
	const { expectIncorrectSlug, expectCanonicalSlug } = assertRequiredSlugPins(input);

	const apply = input.apply === true;
	const env = input.env ?? process.env;
	const dbUrl = resolvePreviewPurgeDbUrl(env);
	const auditDir = input.auditDir ?? join(PROJECT_ROOT, '.tmp', 'invitation-purge-audits');
	const completedSteps = ['target_classified', 'slug_assertions_bound'];

	const incorrectExists = runPsql(
		`select exists(select 1 from public.invitations where id = ${sqlLiteral(incorrectInvitationId)}::uuid);`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: true },
	).stdout.trim();

	if (incorrectExists === 'f' || incorrectExists === 'false') {
		return handleAbsentIncorrectPurge(
			input,
			dbUrl,
			canonicalInvitationId,
			incorrectInvitationId,
			expectIncorrectSlug,
			expectCanonicalSlug,
			auditDir,
			completedSteps,
		);
	}

	const loaded = loadAuditPayload(dbUrl, incorrectInvitationId, canonicalInvitationId);
	completedSteps.push('audit_loaded');
	const migration = assessMigration(loaded.guests, loaded.incorrectDependencies);
	const assetHashEquivalence = assessAssetHashEquivalence(
		loadAssetHashes(dbUrl, incorrectInvitationId),
		loadAssetHashes(dbUrl, canonicalInvitationId),
	);
	completedSteps.push('asset_hashes_compared');
	const blockReasons = collectPurgeBlockReasons(
		input,
		loaded,
		migration,
		assetHashEquivalence,
		expectIncorrectSlug,
		expectCanonicalSlug,
	);

	verifyPreviewWriteAuthorization({
		slug: loaded.incorrect.slug,
		targets: ['preview'],
		apply,
		isInteractive: input.isInteractive,
		authToken: input.authToken,
		operation: INVITATION_ID_PURGE_OPERATION,
	});
	completedSteps.push('preview_auth_checked');

	const audit: InvitationIdPurgeAudit = {
		mode: apply ? 'apply' : 'dry_run',
		executedAt: new Date().toISOString(),
		environment: 'preview',
		dbUrlRedacted: redactDbUrl(dbUrl),
		incorrect: loaded.incorrect,
		canonical: loaded.canonical,
		incorrectDependencies: loaded.incorrectDependencies,
		canonicalDependencies: loaded.canonicalDependencies,
		migration,
		deletePlan: buildDeletePlan(loaded.incorrectDependencies, loaded.storageAssetPaths),
		blocked: blockReasons.length > 0,
		blockReasons,
		deletionResult: 'not_executed',
		completedSteps,
		failures: [],
		assetHashEquivalence,
		auditArtifactPath: null,
		operationReceiptId: null,
	};

	if (apply) {
		await executePurgeApplySteps(
			audit,
			dbUrl,
			incorrectInvitationId,
			canonicalInvitationId,
			loaded.incorrect.slug,
			loaded.canonical.slug,
			loaded.storageAssetPaths,
			env,
		);
	}

	audit.auditArtifactPath = writeAuditArtifact(audit, auditDir);
	return audit;
}
