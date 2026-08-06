/**
 * preview-approval-service.ts — Preview release approval contract + validation.
 *
 * Storage is delegated to PreviewApprovalStore (Preview DB by default) so all
 * worktrees share one SSOT. Filesystem paths remain only for evidence JSON and
 * optional legacy artifact import during migration.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	getDefaultPreviewApprovalStore,
	type PreviewApprovalStore,
} from './preview-approval-store.ts';

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

function loadEvidence(
	evidencePath: string,
): NonNullable<PreviewApprovalArtifact['hostedValidation']> {
	return JSON.parse(readFileSync(resolve(process.cwd(), evidencePath), 'utf8')) as NonNullable<
		PreviewApprovalArtifact['hostedValidation']
	>;
}

function loadLegacyArtifact(artifactPath: string): PreviewApprovalArtifact {
	return JSON.parse(
		readFileSync(resolve(process.cwd(), artifactPath), 'utf8'),
	) as PreviewApprovalArtifact;
}

/**
 * Finalize a pending approval with hosted validation evidence.
 *
 * Prefer `--package-hash` (shared store). `--artifact` remains for one-time
 * import of a legacy filesystem pending artifact into the shared store.
 */
export function finalizePreviewApprovalArtifact(
	input: {
		packageHash?: string;
		artifactPath?: string;
		evidencePath: string;
	},
	options?: PreviewApprovalServiceOptions,
): PreviewApprovalArtifact {
	const store = resolveStore(options);
	let artifact: PreviewApprovalArtifact;
	if (input.packageHash) {
		const pending = store.get(input.packageHash);
		if (!pending) {
			throw new Error(
				`No pending Preview approval exists in the shared store for package ${input.packageHash}.`,
			);
		}
		artifact = pending;
	} else if (input.artifactPath) {
		const legacy = loadLegacyArtifact(input.artifactPath);
		// Import legacy pending artifact into the shared store before finalize.
		artifact =
			legacy.approvalState === 'pending_hosted_validation' ? store.upsert(legacy) : legacy;
	} else {
		throw new Error('Finalize requires --package-hash <hash> or --artifact <path>.');
	}

	const evidence = loadEvidence(input.evidencePath);
	if (!isCurrentContract(artifact)) {
		throw new Error(
			'Preview approval artifact uses an obsolete contract and must be regenerated (not migrated).',
		);
	}
	if (artifact.approvalState !== 'pending_hosted_validation')
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.packageHash !== artifact.packageHash)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.previewProjectRef !== artifact.previewProjectRef)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.route !== artifact.route)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.projectionHash !== artifact.materializedProjectionHash)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (!Object.values(evidence.checklistResults).every(Boolean))
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (!artifact.planId || evidence.planId !== artifact.planId)
		throw new Error('Hosted Preview evidence does not match the executed Preview plan.');
	if (!evidence.reviewedBy?.trim() || !Number.isFinite(Date.parse(evidence.reviewedAt)))
		throw new Error(
			'Hosted Preview evidence requires a reviewer and a valid review timestamp.',
		);
	if (!/^[a-z0-9]{8,32}$/i.test(evidence.intendedProductionProjectRef))
		throw new Error(
			'Hosted Preview evidence requires the intended Production project reference.',
		);
	validateStorageEvidence(artifact, evidence);

	return store.upsert({
		...artifact,
		approvalState: 'approved',
		approvedAt: evidence.reviewedAt,
		approvedBy: evidence.reviewedBy.trim(),
		intendedProductionProjectRef: evidence.intendedProductionProjectRef,
		hostedValidation: evidence,
	});
}

/**
 * Verify an exact approved Preview release from the shared store.
 *
 * Legacy signature `(identity, approvalsDirs?, now?)` remains for callers that
 * still pass filesystem dirs during transition; those dirs are ignored when a
 * store is configured (default Preview DB).
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
		// Optional legacy filesystem fallback only when dirs were explicitly provided.
		if (Array.isArray(approvalsDirsOrOptions) && approvalsDirsOrOptions.length > 0) {
			const path = approvalsDirsOrOptions
				.map((dir) =>
					resolve(
						process.cwd(),
						dir,
						`preview-approval-${identity.packageHash.slice(0, 16)}.json`,
					),
				)
				.find(existsSync);
			if (path) {
				const fileArtifact = JSON.parse(
					readFileSync(path, 'utf8'),
				) as PreviewApprovalArtifact;
				return assertVerifiedApproval(fileArtifact, identity, now);
			}
		}
		throw new Error(`No approved Preview artifact exists for package ${identity.packageHash}.`);
	}
	return assertVerifiedApproval(artifact, identity, now);
}

function assertVerifiedApproval(
	artifact: PreviewApprovalArtifact,
	identity: ApprovedReleaseIdentity,
	now: Date,
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
	const approvedAtMs = Date.parse(artifact.approvedAt!);
	const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
	if (
		!Number.isFinite(approvedAtMs) ||
		approvedAtMs > now.getTime() ||
		now.getTime() - approvedAtMs > maxAgeMs
	) {
		throw new Error('Preview approval artifact is stale and must be reviewed again.');
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
