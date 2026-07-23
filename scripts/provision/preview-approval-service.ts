import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface PreviewApprovalArtifact {
	approvalState: 'pending_hosted_validation' | 'approved';
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
	planId?: string;
	slug: string;
	previewProjectRef: string;
	createdAt: string;
	approvedAt?: string;
	approvedBy?: string;
	intendedProductionProjectRef?: string;
	route: string;
	schemaVersion?: string;
	expectedAssetHashes: Record<string, string>;
	hostedValidation?: {
		packageHash: string;
		previewProjectRef: string;
		route: string;
		projectionHash: string;
		planId: string;
		reviewedAt: string;
		reviewedBy: string;
		intendedProductionProjectRef: string;
		checklistResults: Record<string, boolean>;
		storageHashVerification: Record<string, string>;
	};
}
export interface ApprovedReleaseIdentity {
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
	planId?: string;
	slug: string;
	route: string;
	intendedProductionProjectRef?: string;
}
export function createPendingPreviewApprovalArtifact(input: {
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
	planId?: string;
	slug: string;
	previewProjectRef: string;
	route: string;
	expectedAssetHashes: Record<string, string>;
}): string {
	const path = resolve(
		process.cwd(),
		'.agent/tmp/approvals',
		`preview-approval-${input.packageHash.slice(0, 16)}.json`,
	);
	if (existsSync(path)) {
		const existing = JSON.parse(readFileSync(path, 'utf8')) as PreviewApprovalArtifact;
		if (existing.approvalState === 'approved' && existing.packageHash === input.packageHash)
			return path;
	}
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(
		path,
		JSON.stringify(
			{
				...input,
				schemaVersion: '2.0.0',
				createdAt: new Date().toISOString(),
				approvalState: 'pending_hosted_validation',
			},
			null,
			2,
		),
		'utf8',
	);
	return path;
}

function validateStorageEvidence(
	artifact: PreviewApprovalArtifact,
	evidence: NonNullable<PreviewApprovalArtifact['hostedValidation']>,
): void {
	const expectedEntries = Object.entries(artifact.expectedAssetHashes);
	// No expected assets — nothing to verify against
	if (expectedEntries.length === 0) return;
	// Evidence must carry a storageHashVerification map
	if (!evidence.storageHashVerification || typeof evidence.storageHashVerification !== 'object') {
		throw new Error('Hosted Preview evidence is missing required storage hash verification.');
	}
	// Every expected asset must be present and match
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
	// Reject unexpected extra entries
	if (Object.keys(evidence.storageHashVerification).length > expectedEntries.length) {
		throw new Error(
			'Hosted preview evidence contains unexpected storage hash verification entries.',
		);
	}
}

export function finalizePreviewApprovalArtifact(
	artifactPath: string,
	evidencePath: string,
): PreviewApprovalArtifact {
	const artifact = JSON.parse(
		readFileSync(resolve(process.cwd(), artifactPath), 'utf8'),
	) as PreviewApprovalArtifact;
	const evidence = JSON.parse(
		readFileSync(resolve(process.cwd(), evidencePath), 'utf8'),
	) as NonNullable<PreviewApprovalArtifact['hostedValidation']>;
	if (artifact.approvalState !== 'pending_hosted_validation')
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.packageHash !== artifact.packageHash)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.previewProjectRef !== artifact.previewProjectRef)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.route !== artifact.route)
		throw new Error('Hosted Preview evidence does not satisfy the pending approval artifact.');
	if (evidence.projectionHash !== artifact.projectionHash)
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
	const approved: PreviewApprovalArtifact = {
		...artifact,
		approvalState: 'approved',
		approvedAt: evidence.reviewedAt,
		approvedBy: evidence.reviewedBy.trim(),
		intendedProductionProjectRef: evidence.intendedProductionProjectRef,
		hostedValidation: evidence,
	};
	writeFileSync(resolve(process.cwd(), artifactPath), JSON.stringify(approved, null, 2), 'utf8');
	return approved;
}
function isHashFormatValid(artifact: PreviewApprovalArtifact): boolean {
	return (
		/^[a-f0-9]{64}$/.test(artifact.sourceHash) &&
		/^[a-f0-9]{64}$/.test(artifact.metadataHash) &&
		/^[a-f0-9]{64}$/.test(artifact.assetManifestHash) &&
		/^[a-f0-9]{32}$/.test(artifact.projectionHash)
	);
}

function checkArtifactHashesAndFormat(
	artifact: PreviewApprovalArtifact,
	identity: ApprovedReleaseIdentity,
): boolean {
	if (artifact.approvalState !== 'approved') return false;
	if (artifact.packageHash !== identity.packageHash) return false;
	if (artifact.sourceHash !== identity.sourceHash) return false;
	if (artifact.metadataHash !== identity.metadataHash) return false;
	if (artifact.projectionHash !== identity.projectionHash) return false;
	if (artifact.assetManifestHash !== identity.assetManifestHash) return false;
	if (artifact.slug !== identity.slug) return false;
	if (artifact.route !== identity.route) return false;
	if (!artifact.hostedValidation) return false;
	if (artifact.hostedValidation.projectionHash !== identity.projectionHash) return false;
	if (!artifact.planId || artifact.hostedValidation.planId !== artifact.planId) return false;
	if (!artifact.approvedAt || !artifact.approvedBy) return false;
	if (!artifact.intendedProductionProjectRef) return false;
	if (
		identity.intendedProductionProjectRef &&
		artifact.intendedProductionProjectRef !== identity.intendedProductionProjectRef
	)
		return false;
	return isHashFormatValid(artifact);
}

export function verifyPreviewApprovalArtifact(
	identity: ApprovedReleaseIdentity,
	approvalsDirs = ['.agent/tmp/approvals'],
	now = new Date(),
): PreviewApprovalArtifact {
	const path = approvalsDirs
		.map((dir) =>
			resolve(
				process.cwd(),
				dir,
				`preview-approval-${identity.packageHash.slice(0, 16)}.json`,
			),
		)
		.find(existsSync);
	if (!path)
		throw new Error(`No approved Preview artifact exists for package ${identity.packageHash}.`);
	const artifact = JSON.parse(readFileSync(path, 'utf8')) as PreviewApprovalArtifact;
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
