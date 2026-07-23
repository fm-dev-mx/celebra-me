import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface PreviewApprovalArtifact {
	approvalState: 'pending_hosted_validation' | 'approved';
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
	slug: string;
	previewProjectRef: string;
	createdAt: string;
	route: string;
	expectedAssetHashes: Record<string, string>;
	hostedValidation?: {
		packageHash: string;
		previewProjectRef: string;
		route: string;
		projectionHash: string;
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
	slug: string;
	route: string;
}
export function createPendingPreviewApprovalArtifact(input: {
	packageHash: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
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
	validateStorageEvidence(artifact, evidence);
	const approved: PreviewApprovalArtifact = {
		...artifact,
		approvalState: 'approved',
		hostedValidation: evidence,
	};
	writeFileSync(resolve(process.cwd(), artifactPath), JSON.stringify(approved, null, 2), 'utf8');
	return approved;
}
export function verifyPreviewApprovalArtifact(
	identity: ApprovedReleaseIdentity,
	approvalsDirs = ['.agent/tmp/approvals'],
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
	if (
		artifact.approvalState !== 'approved' ||
		artifact.packageHash !== identity.packageHash ||
		artifact.sourceHash !== identity.sourceHash ||
		artifact.metadataHash !== identity.metadataHash ||
		artifact.projectionHash !== identity.projectionHash ||
		artifact.assetManifestHash !== identity.assetManifestHash ||
		artifact.slug !== identity.slug ||
		artifact.route !== identity.route ||
		!artifact.hostedValidation ||
		artifact.hostedValidation.projectionHash !== identity.projectionHash ||
		!/^[a-f0-9]{64}$/.test(artifact.sourceHash) ||
		!/^[a-f0-9]{64}$/.test(artifact.metadataHash) ||
		!/^[a-f0-9]{64}$/.test(artifact.assetManifestHash) ||
		!/^[a-f0-9]{32}$/.test(artifact.projectionHash)
	)
		throw new Error(
			'Preview approval artifact is stale, incomplete, or does not match the exact release hashes.',
		);
	validateStorageEvidence(artifact, artifact.hostedValidation);
	if (!Object.values(artifact.hostedValidation.checklistResults).every(Boolean))
		throw new Error('Preview approval evidence is incomplete.');
	return artifact;
}
