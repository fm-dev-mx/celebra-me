/**
 * preview-approval-service.ts — Preview release approval contract + validation.
 *
 * Storage is delegated to PreviewApprovalStore (Preview DB by default) so all
 * worktrees share one SSOT. Approval is based on direct hosted Preview checks;
 * legacy filesystem artifacts remain migration-only.
 */
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	getDefaultPreviewApprovalStore,
	type PreviewApprovalStore,
} from './preview-approval-store.ts';
import {
	PREVIEW_LIVE_CHECKLIST_KEYS,
	type PreviewLiveVerificationResult,
} from './preview-live-verification.ts';

/** Current Preview approval artifact contract. Older schemas are rejected, not migrated. */
export const PREVIEW_APPROVAL_SCHEMA_VERSION = '2.1.0' as const;

const MD5 = /^[a-f0-9]{32}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface PreviewApprovalArtifact {
	approvalState: 'pending_hosted_validation' | 'approved';
	schemaVersion: typeof PREVIEW_APPROVAL_SCHEMA_VERSION;
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	/**
	 * Canonical package projection hash (environment-neutral published content).
	 * Production release identity binds to this value.
	 */
	canonicalProjectionHash: string;
	/**
	 * Preview environment-materialized projection hash (includes Preview asset IDs/URLs).
	 * Hosted Preview validation evidence binds to this value.
	 */
	materializedProjectionHash: string;
	assetManifestHash: string;
	planId?: string;
	slug: string;
	previewProjectRef: string;
	createdAt: string;
	approvedAt?: string;
	approvedBy?: string;
	intendedProductionProjectRef?: string;
	route: string;
	expectedAssetHashes: Record<string, string>;
	hostedValidation?: {
		packageHash: string;
		previewProjectRef: string;
		route: string;
		/** Must equal artifact.materializedProjectionHash. */
		projectionHash: string;
		planId: string;
		reviewedAt: string;
		reviewedBy: string;
		intendedProductionProjectRef: string;
		checklistResults: Record<string, boolean>;
		storageHashVerification: Record<string, string>;
	};
}

/** Production / promote identity — uses the canonical package projection hash. */
export interface ApprovedReleaseIdentity {
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	/** Canonical package projection hash. */
	projectionHash: string;
	assetManifestHash: string;
	planId?: string;
	slug: string;
	route: string;
	intendedProductionProjectRef?: string;
}

export interface PreviewApprovalServiceOptions {
	store?: PreviewApprovalStore;
	now?: Date;
	liveRecheck?: PreviewLiveVerificationResult | (() => PreviewLiveVerificationResult);
}

function resolveStore(options?: PreviewApprovalServiceOptions): PreviewApprovalStore {
	return options?.store ?? getDefaultPreviewApprovalStore();
}

export function isCurrentContract(artifact: PreviewApprovalArtifact): boolean {
	return (
		artifact.schemaVersion === PREVIEW_APPROVAL_SCHEMA_VERSION &&
		SHA256.test(artifact.packageHash) &&
		SHA256.test(artifact.sourceHash) &&
		SHA256.test(artifact.metadataHash) &&
		SHA256.test(artifact.assetManifestHash) &&
		MD5.test(artifact.canonicalProjectionHash) &&
		MD5.test(artifact.materializedProjectionHash)
	);
}

function validateStorageEvidence(
	artifact: PreviewApprovalArtifact,
	evidence: NonNullable<PreviewApprovalArtifact['hostedValidation']>,
): void {
	const expectedEntries = Object.entries(artifact.expectedAssetHashes);
	if (expectedEntries.length === 0) return;
	if (!evidence.storageHashVerification || typeof evidence.storageHashVerification !== 'object') {
		throw new Error('Hosted Preview evidence is missing required storage hash verification.');
	}
	for (const [assetPath, expectedHash] of expectedEntries) {
		if (!(assetPath in evidence.storageHashVerification)) {
			throw new Error(
				`Hosted preview evidence is missing storage hash verification for asset: ${assetPath}.`,
			);
		}
		const actualHash = evidence.storageHashVerification[assetPath];
		if (typeof actualHash !== 'string' || actualHash.length === 0) {
			throw new Error(
				`Hosted preview evidence has an invalid empty storage hash for asset: ${assetPath}.`,
			);
		}
		if (actualHash !== expectedHash) {
			throw new Error(
				`Hosted preview evidence has a storage hash mismatch for asset: ${assetPath}.`,
			);
		}
	}
	if (Object.keys(evidence.storageHashVerification).length > expectedEntries.length) {
		throw new Error(
			'Hosted preview evidence contains unexpected storage hash verification entries.',
		);
	}
}

function assertLiveVerificationMatches(
	artifact: PreviewApprovalArtifact,
	live: PreviewLiveVerificationResult,
): void {
	if (
		!live.ok ||
		!PREVIEW_LIVE_CHECKLIST_KEYS.every((key) => live.checklistResults[key] === true)
	) {
		throw new Error('Live Preview verification is incomplete or failed.');
	}
	if (
		live.details.packageHash !== artifact.packageHash ||
		live.details.slug !== artifact.slug ||
		live.details.route !== artifact.route ||
		live.details.previewProjectRef !== artifact.previewProjectRef ||
		live.projectionHash !== artifact.materializedProjectionHash
	) {
		throw new Error('Live Preview verification does not match the pending approval artifact.');
	}
	const verificationTime = Date.parse(live.reviewedAt);
	if (!Number.isFinite(verificationTime)) {
		throw new Error('Live Preview verification has an invalid review timestamp.');
	}
	for (const [path, expectedHash] of Object.entries(artifact.expectedAssetHashes)) {
		if (live.storageHashVerification[path] !== expectedHash) {
			throw new Error(`Live Preview storage verification failed for asset: ${path}.`);
		}
	}
}

function checkArtifactHashesAndFormat(
	artifact: PreviewApprovalArtifact,
	identity: ApprovedReleaseIdentity,
): boolean {
	if (!isCurrentContract(artifact)) return false;
	if (artifact.approvalState !== 'approved') return false;
	if (artifact.packageHash !== identity.packageHash) return false;
	if (artifact.sourceHash !== identity.sourceHash) return false;
	if (artifact.metadataHash !== identity.metadataHash) return false;
	if (artifact.canonicalProjectionHash !== identity.projectionHash) return false;
	if (artifact.assetManifestHash !== identity.assetManifestHash) return false;
	if (artifact.slug !== identity.slug) return false;
	if (artifact.route !== identity.route) return false;
	if (!artifact.hostedValidation) return false;
	if (artifact.hostedValidation.projectionHash !== artifact.materializedProjectionHash)
		return false;
	if (!artifact.planId || artifact.hostedValidation.planId !== artifact.planId) return false;
	if (!artifact.approvedAt || !artifact.approvedBy) return false;
	if (!artifact.intendedProductionProjectRef) return false;
	if (
		identity.intendedProductionProjectRef &&
		artifact.intendedProductionProjectRef !== identity.intendedProductionProjectRef
	)
		return false;
	return true;
}

/**
 * Create or reuse a pending Preview approval in the shared store.
 * Returns the stored artifact (packageHash is the durable identity).
 */
export function createPendingPreviewApprovalArtifact(
	input: {
		packageHash: string;
		sourceHash: string;
		metadataHash: string;
		canonicalProjectionHash: string;
		materializedProjectionHash: string;
		assetManifestHash: string;
		planId?: string;
		slug: string;
		previewProjectRef: string;
		route: string;
		expectedAssetHashes: Record<string, string>;
	},
	options?: PreviewApprovalServiceOptions,
): PreviewApprovalArtifact {
	if (!MD5.test(input.canonicalProjectionHash) || !MD5.test(input.materializedProjectionHash)) {
		throw new Error(
			'Preview approval requires valid MD5 canonical and materialized projection hashes.',
		);
	}
	const store = resolveStore(options);
	const existing = store.get(input.packageHash);
	if (
		existing &&
		existing.approvalState === 'approved' &&
		isCurrentContract(existing) &&
		existing.canonicalProjectionHash === input.canonicalProjectionHash &&
		existing.materializedProjectionHash === input.materializedProjectionHash
	) {
		return existing;
	}

	return store.upsert({
		...input,
		schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
		createdAt: (options?.now ?? new Date()).toISOString(),
		approvalState: 'pending_hosted_validation',
	});
}

/**
 * @deprecated Evidence scaffolds are intentionally excluded from the approval happy path.
 */
export function writePendingApprovalEvidenceScaffold(
	input: {
		packageHash: string;
		outputPath: string;
		reviewedBy?: string;
		intendedProductionProjectRef?: string;
	},
	options?: PreviewApprovalServiceOptions,
): {
	outputPath: string;
	packageHash: string;
	slug: string;
	planId: string;
} {
	void input;
	void options;
	throw new Error(
		'EVIDENCE_SCAFFOLD_REMOVED: use pnpm invitation:release -- --package-hash <hash> --approve for direct live Preview verification.',
	);
}

/**
 * Approve a pending artifact using direct, machine-generated hosted Preview results.
 */
export function approvePreviewArtifactFromLiveVerification(
	input: {
		packageHash: string;
		reviewedBy: string;
		intendedProductionProjectRef?: string;
		live: PreviewLiveVerificationResult;
	},
	options?: PreviewApprovalServiceOptions,
): PreviewApprovalArtifact {
	const store = resolveStore(options);
	const pending = store.get(input.packageHash);
	if (!pending) {
		throw new Error(
			`No pending Preview approval exists in the shared store for package ${input.packageHash}.`,
		);
	}
	if (!isCurrentContract(pending)) {
		throw new Error(
			'Preview approval artifact uses an obsolete contract and must be regenerated (not migrated).',
		);
	}
	if (pending.approvalState !== 'pending_hosted_validation') {
		throw new Error('Live Preview verification requires a pending approval artifact.');
	}
	if (!pending.planId) {
		throw new Error('Pending Preview approval is missing the executed plan ID.');
	}
	const reviewedBy = input.reviewedBy.trim();
	if (!reviewedBy || !Number.isFinite(Date.parse(input.live.reviewedAt))) {
		throw new Error('Live Preview approval requires a reviewer and a valid review timestamp.');
	}
	const intendedProductionProjectRef =
		input.intendedProductionProjectRef ?? SUPABASE_PROJECT_REFS.production;
	if (!/^[a-z0-9]{8,32}$/i.test(intendedProductionProjectRef)) {
		throw new Error(
			'Live Preview approval requires the intended Production project reference.',
		);
	}
	assertLiveVerificationMatches(pending, input.live);
	const hostedValidation: NonNullable<PreviewApprovalArtifact['hostedValidation']> = {
		packageHash: pending.packageHash,
		previewProjectRef: pending.previewProjectRef,
		route: pending.route,
		projectionHash: input.live.projectionHash!,
		planId: pending.planId,
		reviewedAt: input.live.reviewedAt,
		reviewedBy,
		intendedProductionProjectRef,
		checklistResults: { ...input.live.checklistResults },
		storageHashVerification: { ...input.live.storageHashVerification },
	};
	validateStorageEvidence(pending, hostedValidation);

	return store.upsert({
		...pending,
		approvalState: 'approved',
		approvedAt: input.live.reviewedAt,
		approvedBy: reviewedBy,
		intendedProductionProjectRef,
		hostedValidation,
	});
}

/**
 * @deprecated Filesystem evidence finalization was replaced by direct live verification.
 */
export function finalizePreviewApprovalArtifact(
	input: {
		packageHash?: string;
		artifactPath?: string;
		evidencePath: string;
	},
	options?: PreviewApprovalServiceOptions,
): PreviewApprovalArtifact {
	void input;
	void options;
	throw new Error(
		'EVIDENCE_FINALIZE_REMOVED: use pnpm invitation:release -- --package-hash <hash> --approve for direct live Preview verification.',
	);
}

/**
 * Verify an exact approved Preview release from the shared store.
 *
 * Legacy signature `(identity, approvalsDirs?, now?)` remains for call-site
 * compatibility; filesystem dirs are no longer consulted. Pass `{ store }` in
 * tests. Runtime SSOT is Preview DB.
 */
export function verifyPreviewApprovalArtifact(
	identity: ApprovedReleaseIdentity,
	approvalsDirsOrOptions: string[] | PreviewApprovalServiceOptions = {},
	nowArg?: Date,
): PreviewApprovalArtifact {
	const options: PreviewApprovalServiceOptions = Array.isArray(approvalsDirsOrOptions)
		? { now: nowArg }
		: { ...approvalsDirsOrOptions, now: approvalsDirsOrOptions.now ?? nowArg };
	const store = resolveStore(options);
	const now = options.now ?? new Date();

	const artifact = store.get(identity.packageHash);
	if (!artifact) {
		throw new Error(`No approved Preview artifact exists for package ${identity.packageHash}.`);
	}
	return assertVerifiedApproval(artifact, identity, now, options);
}

function assertVerifiedApproval(
	artifact: PreviewApprovalArtifact,
	identity: ApprovedReleaseIdentity,
	now: Date,
	options: PreviewApprovalServiceOptions,
): PreviewApprovalArtifact {
	if (!isCurrentContract(artifact)) {
		throw new Error(
			'Preview approval artifact uses an obsolete contract and must be regenerated (not migrated).',
		);
	}
	if (!checkArtifactHashesAndFormat(artifact, identity)) {
		throw new Error(
			'Preview approval artifact is stale, incomplete, or does not match the exact release hashes.',
		);
	}
	const liveRecheck =
		typeof options.liveRecheck === 'function' ? options.liveRecheck() : options.liveRecheck;
	if (liveRecheck) {
		assertLiveVerificationMatches(artifact, liveRecheck);
		const reviewedAtMs = Date.parse(liveRecheck.reviewedAt);
		if (reviewedAtMs > now.getTime()) {
			throw new Error('Live Preview verification timestamp is in the future.');
		}
	} else {
		const approvedAtMs = Date.parse(artifact.approvedAt!);
		const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
		if (
			!Number.isFinite(approvedAtMs) ||
			approvedAtMs > now.getTime() ||
			now.getTime() - approvedAtMs > maxAgeMs
		) {
			throw new Error(
				'Preview approval artifact is stale and requires a live Preview recheck.',
			);
		}
	}
	if (identity.planId && artifact.planId && artifact.planId !== identity.planId) {
		throw new Error(
			`Preview approval artifact plan ID mismatch: artifact has "${artifact.planId}", release has "${identity.planId}".`,
		);
	}
	validateStorageEvidence(artifact, artifact.hostedValidation!);
	if (!Object.values(artifact.hostedValidation!.checklistResults).every(Boolean))
		throw new Error('Preview approval evidence is incomplete.');
	return artifact;
}
